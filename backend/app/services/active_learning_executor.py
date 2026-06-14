"""
Active learning execution engine.
Handles: initial batch sampling, model training, metric computation,
plain-English explanations, and next-batch selection.
"""
from __future__ import annotations

import random
import traceback
from typing import Optional

import joblib
import numpy as np
import polars as pl
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline as SKPipeline
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.metrics import confusion_matrix
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.svm import SVC, SVR
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.tree import DecisionTreeClassifier

from app.core.config import DATA_DIR
from app.models.store import store, ALSession
from app.services.storage import get_storage

try:
    from xgboost import XGBClassifier, XGBRegressor
    _HAS_XGB = True
except ImportError:
    _HAS_XGB = False

MODELS_DIR = DATA_DIR / "al_models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


# ── Model factory ─────────────────────────────────────────────────────

def _build_classifier(model_type: str):
    if model_type == "logistic_regression":
        return LogisticRegression(max_iter=1000, random_state=42)
    if model_type == "random_forest":
        return RandomForestClassifier(n_estimators=100, random_state=42)
    if model_type == "xgboost":
        if _HAS_XGB:
            return XGBClassifier(n_estimators=100, random_state=42, eval_metric="logloss", verbosity=0)
        return RandomForestClassifier(n_estimators=100, random_state=42)
    if model_type == "svm":
        return SVC(probability=True, random_state=42)
    if model_type == "mlp":
        return MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=500, random_state=42)
    return RandomForestClassifier(n_estimators=100, random_state=42)


def _build_regressor(model_type: str):
    if model_type == "logistic_regression":
        return Ridge(random_state=42)
    if model_type == "random_forest":
        return RandomForestRegressor(n_estimators=100, random_state=42)
    if model_type == "xgboost":
        if _HAS_XGB:
            return XGBRegressor(n_estimators=100, random_state=42, verbosity=0)
        return RandomForestRegressor(n_estimators=100, random_state=42)
    if model_type == "svm":
        return SVR()
    if model_type == "mlp":
        return MLPRegressor(hidden_layer_sizes=(128, 64), max_iter=500, random_state=42)
    return RandomForestRegressor(n_estimators=100, random_state=42)


# ── Preprocessing ─────────────────────────────────────────────────────

def _build_preprocessor(df: pl.DataFrame, feature_cols: list[str]) -> ColumnTransformer:
    num_cols = [c for c in feature_cols if df[c].dtype in (pl.Float32, pl.Float64, pl.Int8, pl.Int16, pl.Int32, pl.Int64, pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64)]
    cat_cols = [c for c in feature_cols if c not in num_cols]

    transformers = []
    if num_cols:
        transformers.append(("num", SKPipeline([
            ("imp", SimpleImputer(strategy="median")),
            ("scl", StandardScaler()),
        ]), num_cols))
    if cat_cols:
        transformers.append(("cat", SKPipeline([
            ("imp", SimpleImputer(strategy="constant", fill_value="missing")),
            ("enc", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]), cat_cols))

    return ColumnTransformer(transformers, remainder="drop")


def _get_feature_names(preprocessor: ColumnTransformer, feature_cols: list[str], df: pl.DataFrame) -> list[str]:
    num_cols = [c for c in feature_cols if df[c].dtype in (pl.Float32, pl.Float64, pl.Int8, pl.Int16, pl.Int32, pl.Int64, pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64)]
    cat_cols = [c for c in feature_cols if c not in num_cols]
    names = list(num_cols)
    for t_name, transformer, cols in preprocessor.transformers_:
        if t_name == "cat":
            try:
                enc = transformer.named_steps["enc"]
                names += [f"{col}_{val}" for col, vals in zip(cols, enc.categories_) for val in vals]
            except Exception:
                names += cat_cols
    return names


# ── Load dataset ──────────────────────────────────────────────────────

def _load_dataset(session: ALSession) -> pl.DataFrame:
    ds = store.get_dataset(session.dataset_id)
    if not ds:
        raise ValueError(f"Dataset {session.dataset_id} not found")
    return pl.read_csv(get_storage().local_path(ds.file_path))


# ── Initial batch ─────────────────────────────────────────────────────

def get_initial_batch(session_id: str) -> list[int]:
    session = store.get_al_session(session_id)
    if not session:
        raise ValueError("Session not found")

    df = _load_dataset(session)
    all_indices = list(range(len(df)))
    rng = random.Random(42)
    batch = rng.sample(all_indices, min(session.batch_size, len(all_indices)))

    session.next_batch = batch
    store.update_al_session(session)
    return batch


# ── Sampling strategies ───────────────────────────────────────────────

def _sample_next_batch(
    session: ALSession,
    pipeline: SKPipeline,
    df: pl.DataFrame,
    feature_cols: list[str],
    labeled_indices: set[int],
    batch_size: int,
) -> list[int]:
    unlabeled = [i for i in range(len(df)) if i not in labeled_indices]
    if len(unlabeled) <= batch_size:
        return unlabeled

    strategy = session.sampling_strategy
    X_unlabeled = df[unlabeled].select(feature_cols).to_pandas()

    if strategy == "random":
        rng = random.Random()
        return rng.sample(unlabeled, batch_size)

    if strategy in ("least_confidence", "margin", "entropy"):
        if session.task_type == "classification":
            try:
                probs = pipeline.predict_proba(X_unlabeled)
            except Exception:
                return random.sample(unlabeled, batch_size)

            if strategy == "least_confidence":
                scores = 1.0 - np.max(probs, axis=1)
            elif strategy == "margin":
                sorted_probs = np.sort(probs, axis=1)[:, ::-1]
                scores = 1.0 - (sorted_probs[:, 0] - sorted_probs[:, 1])
            else:  # entropy
                eps = 1e-10
                scores = -np.sum(probs * np.log(probs + eps), axis=1)
        else:
            # Regression: use bootstrap variance
            scores = _bootstrap_uncertainty(pipeline, X_unlabeled)

        top_k_local = np.argsort(scores)[::-1][:batch_size]
        return [unlabeled[i] for i in top_k_local]

    if strategy == "coreset":
        return _coreset_sample(pipeline, df, feature_cols, labeled_indices, unlabeled, batch_size)

    if strategy == "committee":
        return _committee_sample(df, feature_cols, labeled_indices, unlabeled, batch_size, session)

    return random.sample(unlabeled, batch_size)


def _bootstrap_uncertainty(pipeline: SKPipeline, X) -> np.ndarray:
    """Bootstrap variance estimate for regression uncertainty."""
    try:
        base_pred = pipeline.predict(X)
        preds = []
        for seed in range(10):
            rng = np.random.RandomState(seed)
            idx = rng.choice(len(X), size=len(X), replace=True)
            preds.append(base_pred[idx] if hasattr(idx, '__len__') else base_pred)
        return np.var(np.array(preds), axis=0)
    except Exception:
        return np.ones(len(X))


def _coreset_sample(
    pipeline: SKPipeline,
    df: pl.DataFrame,
    feature_cols: list[str],
    labeled_indices: set[int],
    unlabeled: list[int],
    batch_size: int,
) -> list[int]:
    """k-means coreset: pick unlabeled points farthest from labeled centers."""
    try:
        from sklearn.preprocessing import normalize
        preprocessor = pipeline.named_steps.get("pre") or pipeline[0]

        X_labeled = df[list(labeled_indices)].select(feature_cols).to_pandas()
        X_unlabeled = df[unlabeled].select(feature_cols).to_pandas()

        labeled_transformed = preprocessor.transform(X_labeled)
        unlabeled_transformed = preprocessor.transform(X_unlabeled)

        labeled_transformed = normalize(labeled_transformed)
        unlabeled_transformed = normalize(unlabeled_transformed)

        selected = []
        remaining = list(range(len(unlabeled)))
        centers = labeled_transformed

        for _ in range(batch_size):
            if not remaining:
                break
            dists = np.min(
                np.linalg.norm(unlabeled_transformed[remaining][:, None, :] - centers[None, :, :], axis=2),
                axis=1
            )
            pick = remaining[int(np.argmax(dists))]
            selected.append(unlabeled[pick])
            centers = np.vstack([centers, unlabeled_transformed[pick]])
            remaining.remove(pick)

        return selected
    except Exception:
        return random.sample(unlabeled, batch_size)


def _committee_sample(
    df: pl.DataFrame,
    feature_cols: list[str],
    labeled_indices: set[int],
    unlabeled: list[int],
    batch_size: int,
    session: ALSession,
) -> list[int]:
    """Query by committee: disagreement among 3 weak classifiers."""
    try:
        labeled_list = sorted(labeled_indices)
        X_labeled = df[labeled_list].select(feature_cols).to_pandas()
        y_labeled = np.array([session.labels[str(i)] for i in labeled_list])
        X_unlabeled = df[unlabeled].select(feature_cols).to_pandas()

        preprocessor = _build_preprocessor(df, feature_cols)
        X_labeled_t = preprocessor.fit_transform(X_labeled)
        X_unlabeled_t = preprocessor.transform(X_unlabeled)

        members = [
            DecisionTreeClassifier(max_depth=5, random_state=0),
            DecisionTreeClassifier(max_depth=5, random_state=1),
            DecisionTreeClassifier(max_depth=5, random_state=2),
        ]
        le = LabelEncoder()
        y_enc = le.fit_transform(y_labeled)

        preds = []
        for m in members:
            m.fit(X_labeled_t, y_enc)
            preds.append(m.predict(X_unlabeled_t))

        preds_arr = np.array(preds)
        # Vote entropy
        n_classes = len(np.unique(y_enc))
        scores = np.zeros(len(unlabeled))
        for j in range(len(unlabeled)):
            votes = preds_arr[:, j]
            for c in range(n_classes):
                p = np.sum(votes == c) / len(members)
                if p > 0:
                    scores[j] -= p * np.log(p)

        top_k_local = np.argsort(scores)[::-1][:batch_size]
        return [unlabeled[i] for i in top_k_local]
    except Exception:
        return random.sample(unlabeled, min(batch_size, len(unlabeled)))


# ── Explanation generator ─────────────────────────────────────────────

def _generate_explanation(
    session: ALSession,
    metrics: dict,
    prev_metrics: Optional[dict],
    feature_names: list[str],
    importances: Optional[list[float]],
    confusion: Optional[list[list[int]]],
    label_classes: list[str],
) -> str:
    lines = []

    if session.task_type == "classification":
        acc = metrics.get("accuracy", 0)
        f1 = metrics.get("f1", 0)
        prec = metrics.get("precision", 0)
        rec = metrics.get("recall", 0)

        # Quality headline
        if acc >= 0.9:
            lines.append(f"Excellent round — the model is {acc*100:.1f}% accurate, which means it correctly identifies nearly 9 out of 10 examples.")
        elif acc >= 0.75:
            lines.append(f"Good progress — the model is {acc*100:.1f}% accurate, correctly classifying about {int(acc*10)} out of 10 examples.")
        elif acc >= 0.6:
            lines.append(f"The model is developing — at {acc*100:.1f}% accuracy it's performing better than random but still has room to improve.")
        else:
            lines.append(f"Early stage — the model is at {acc*100:.1f}% accuracy. This is expected with few labels; keep annotating.")

        # Metric explanations
        lines.append(f"\n**Precision ({prec*100:.1f}%):** When the model says something belongs to a class, it's right {prec*100:.1f}% of the time.")
        lines.append(f"**Recall ({rec*100:.1f}%):** The model catches {rec*100:.1f}% of all actual examples in each class.")
        lines.append(f"**F1 Score ({f1*100:.1f}%):** The balanced combination of precision and recall — a more complete picture than accuracy alone.")

        # Delta from previous round
        if prev_metrics:
            prev_acc = prev_metrics.get("accuracy", 0)
            delta = acc - prev_acc
            if delta > 0.02:
                lines.append(f"\n**Round improvement:** Accuracy improved by +{delta*100:.1f}% since last round — the new labels helped significantly.")
            elif delta > 0:
                lines.append(f"\n**Round improvement:** Small gain of +{delta*100:.1f}% — steady progress, keep labeling.")
            elif delta < -0.02:
                lines.append(f"\n**Round change:** Accuracy dipped by {delta*100:.1f}% — this can happen when new labels reveal harder patterns. It should recover.")
            else:
                lines.append("\n**Round change:** Performance stayed roughly the same — the model may be converging.")

        # Confusion matrix insight
        if confusion and len(label_classes) == 2:
            cm = confusion
            _tn, fp, fn, _tp = cm[0][0], cm[0][1], cm[1][0], cm[1][1]
            if fn > fp * 1.5:
                lines.append(f"\n**Confusion insight:** The model misses {fn} true positives (false negatives) — it's being too conservative. Label more positive examples.")
            elif fp > fn * 1.5:
                lines.append(f"\n**Confusion insight:** The model over-predicts positives ({fp} false positives) — it's being too aggressive. Label more negative examples.")
            else:
                lines.append(f"\n**Confusion insight:** Errors are fairly balanced between false positives ({fp}) and false negatives ({fn}).")

        # Per-class weakness (multi-class)
        if confusion and len(label_classes) > 2:
            cm_arr = np.array(confusion)
            class_recalls = cm_arr.diagonal() / (cm_arr.sum(axis=1) + 1e-10)
            weakest_idx = int(np.argmin(class_recalls))
            if class_recalls[weakest_idx] < 0.6 and weakest_idx < len(label_classes):
                weakest = label_classes[weakest_idx]
                lines.append(f"\n**Weakest class:** '{weakest}' has only {class_recalls[weakest_idx]*100:.0f}% recall — consider labeling more examples of this class.")

    else:
        # Regression
        mae = metrics.get("mae", 0)
        rmse = metrics.get("rmse", 0)
        r2 = metrics.get("r2", 0)

        if r2 >= 0.85:
            lines.append(f"Strong regression model — R² of {r2:.3f} means {r2*100:.1f}% of variance in the target is explained.")
        elif r2 >= 0.6:
            lines.append(f"Decent fit — R² of {r2:.3f}. The model captures most patterns but some variance remains unexplained.")
        elif r2 >= 0.3:
            lines.append(f"Moderate fit — R² of {r2:.3f}. The relationship is being learned but more labels will help substantially.")
        else:
            lines.append(f"Early stage — R² of {r2:.3f}. With more labeled data the model should improve significantly.")

        lines.append(f"\n**MAE ({mae:.4f}):** On average, predictions are off by {mae:.4f} units from the true value.")
        lines.append(f"**RMSE ({rmse:.4f}):** The root mean squared error penalizes large mistakes — {rmse:.4f} here.")
        lines.append(f"**R² ({r2:.3f}):** Explains {r2*100:.1f}% of the target variance (1.0 is perfect).")

        if prev_metrics:
            prev_r2 = prev_metrics.get("r2", 0)
            delta = r2 - prev_r2
            if delta > 0.05:
                lines.append(f"\n**Round improvement:** R² improved by +{delta:.3f} — great batch of labels.")
            elif delta > 0:
                lines.append(f"\n**Round improvement:** Small R² gain of +{delta:.3f} — keep going.")
            elif delta < -0.05:
                lines.append(f"\n**Round change:** R² dipped by {delta:.3f} — new labels may be revealing tougher patterns.")

    # Feature importance
    if importances and feature_names:
        paired = sorted(zip(importances, feature_names), reverse=True)[:5]
        top_str = ", ".join(f"**{name}** ({imp*100:.1f}%)" for imp, name in paired if imp > 0.01)
        if top_str:
            lines.append(f"\n**Top features driving predictions:** {top_str}.")

    # Actionable recommendation
    labeled_count = len(session.labels)
    if session.task_type == "classification":
        acc = metrics.get("accuracy", 0)
        if acc < 0.7 and labeled_count < 100:
            lines.append(f"\n**Recommendation:** With only {labeled_count} labeled examples and {acc*100:.0f}% accuracy, label at least 2–3 more rounds to stabilize the model.")
        elif acc >= 0.85:
            lines.append("\n**Recommendation:** The model is performing well. Consider stopping or running 1–2 more rounds to confirm stability.")
        else:
            lines.append("\n**Recommendation:** Continuing to label will help — focus on examples the model is uncertain about (already selected for you).")
    else:
        r2 = metrics.get("r2", 0)
        if r2 < 0.7:
            lines.append(f"\n**Recommendation:** R² of {r2:.2f} suggests more labels will meaningfully improve the model.")
        else:
            lines.append("\n**Recommendation:** The regression model is solid. Continue if you need higher precision.")

    return "\n".join(lines)


# ── Main training function ────────────────────────────────────────────

def train_and_get_next_batch(session_id: str) -> None:
    session = store.get_al_session(session_id)
    if not session:
        return

    session.status = "training"
    store.update_al_session(session)

    try:
        df = _load_dataset(session)

        # Build labeled set
        labeled_indices = sorted([int(k) for k in session.labels.keys()])
        if not labeled_indices:
            raise ValueError("No labels provided yet")

        # Features
        exclude = set(session.exclude_columns) | {session.target_column}
        feature_cols = [c for c in df.columns if c not in exclude]
        if not feature_cols:
            raise ValueError("No feature columns available")

        X_df = df[labeled_indices].select(feature_cols).to_pandas()
        y_raw = [session.labels[str(i)] for i in labeled_indices]

        is_cls = session.task_type == "classification"

        # Encode labels
        le = None
        if is_cls:
            le = LabelEncoder()
            y = le.fit_transform(y_raw)
            label_classes_enc = list(le.classes_)
        else:
            y = np.array([float(v) for v in y_raw])
            label_classes_enc = []

        # Build preprocessor + model pipeline
        preprocessor = _build_preprocessor(df, feature_cols)
        estimator = _build_classifier(session.model_type) if is_cls else _build_regressor(session.model_type)

        pipeline = SKPipeline([("pre", preprocessor), ("clf", estimator)])

        # Cross-validation metrics
        n_splits = min(5, len(labeled_indices))
        metrics = {}
        confusion = None

        if is_cls and n_splits >= 2:
            unique_classes = np.unique(y)
            if len(unique_classes) >= 2:
                cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
                scoring = ["accuracy", "precision_weighted", "recall_weighted", "f1_weighted"]
                cv_res = cross_validate(pipeline, X_df, y, cv=cv, scoring=scoring, error_score="raise")
                metrics = {
                    "accuracy": float(np.mean(cv_res["test_accuracy"])),
                    "precision": float(np.mean(cv_res["test_precision_weighted"])),
                    "recall": float(np.mean(cv_res["test_recall_weighted"])),
                    "f1": float(np.mean(cv_res["test_f1_weighted"])),
                }
            else:
                metrics = {"accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0}
        elif not is_cls and n_splits >= 2:
            from sklearn.model_selection import KFold
            cv = KFold(n_splits=n_splits, shuffle=True, random_state=42)
            scoring = ["neg_mean_absolute_error", "neg_root_mean_squared_error", "r2"]
            cv_res = cross_validate(pipeline, X_df, y, cv=cv, scoring=scoring, error_score="raise")
            metrics = {
                "mae": float(-np.mean(cv_res["test_neg_mean_absolute_error"])),
                "rmse": float(-np.mean(cv_res["test_neg_root_mean_squared_error"])),
                "r2": float(np.mean(cv_res["test_r2"])),
            }
        else:
            if is_cls:
                metrics = {"accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0}
            else:
                metrics = {"mae": 0.0, "rmse": 0.0, "r2": 0.0}

        # Fit on all labeled data
        pipeline.fit(X_df, y)

        # Confusion matrix (classification)
        if is_cls and len(np.unique(y)) >= 2:
            y_pred = pipeline.predict(X_df)
            cm = confusion_matrix(y, y_pred)
            confusion = cm.tolist()

        # Feature importances
        importances = None
        feature_names_out = []
        try:
            feature_names_out = _get_feature_names(preprocessor, feature_cols, df)
            clf = pipeline.named_steps["clf"]
            if hasattr(clf, "feature_importances_"):
                importances = clf.feature_importances_.tolist()
            elif hasattr(clf, "coef_"):
                coef = clf.coef_
                if coef.ndim > 1:
                    importances = np.abs(coef).mean(axis=0).tolist()
                else:
                    importances = np.abs(coef).tolist()
        except Exception:
            pass

        # Save model
        model_path = str(MODELS_DIR / f"{session_id}_round{session.current_round}.pkl")
        joblib.dump({"pipeline": pipeline, "label_encoder": le, "feature_cols": feature_cols}, model_path)

        # Previous round metrics
        prev_metrics = None
        if session.rounds:
            prev_metrics = session.rounds[-1].get("metrics")

        # Explanation
        explanation = _generate_explanation(
            session=session,
            metrics=metrics,
            prev_metrics=prev_metrics,
            feature_names=feature_names_out,
            importances=importances,
            confusion=confusion,
            label_classes=label_classes_enc if is_cls else [],
        )

        # Top feature importances list (for UI)
        feature_importance_list = []
        if importances and feature_names_out:
            paired = sorted(zip(importances, feature_names_out), reverse=True)[:10]
            feature_importance_list = [{"feature": n, "importance": float(imp)} for imp, n in paired]

        # Build round result
        round_result = {
            "round": session.current_round,
            "labeled_count": len(labeled_indices),
            "metrics": metrics,
            "confusion_matrix": confusion,
            "feature_importances": feature_importance_list,
            "explanation": explanation,
            "label_classes": label_classes_enc if is_cls else [],
        }

        # Select next batch
        labeled_set = set(labeled_indices)
        next_batch = _sample_next_batch(
            session=session,
            pipeline=pipeline,
            df=df,
            feature_cols=feature_cols,
            labeled_indices=labeled_set,
            batch_size=session.batch_size,
        )

        # Check stopping conditions
        should_stop = False
        if is_cls and session.target_accuracy and metrics.get("accuracy", 0) >= session.target_accuracy:
            should_stop = True
        if session.current_round >= session.max_rounds:
            should_stop = True
        if not next_batch:
            should_stop = True

        session.rounds.append(round_result)
        session.model_path = model_path
        session.next_batch = next_batch
        session.current_round += 1
        session.status = "complete" if should_stop else "annotating"
        store.update_al_session(session)

    except Exception as exc:
        traceback.print_exc()
        session.status = "annotating"  # allow retry
        store.update_al_session(session)
        raise exc
