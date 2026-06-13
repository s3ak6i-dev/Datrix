"""
Benchmark executor — evaluates ML candidates on a fixed dataset with a
consistent eval protocol, running each candidate in a parallel thread.
"""
from __future__ import annotations

import time
import threading
from typing import Optional

import numpy as np
import polars as pl

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.model_selection import (
    StratifiedKFold, KFold, train_test_split,
    cross_validate, learning_curve, GridSearchCV,
)
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.svm import SVC, SVR
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    r2_score, mean_absolute_error, mean_squared_error, confusion_matrix,
)

try:
    from xgboost import XGBClassifier, XGBRegressor
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

from app.models.store import store, BenchmarkJob
from app.services.storage import get_storage


# ── Preprocessing ─────────────────────────────────────────────────────

def _build_preprocessor(X_df: pl.DataFrame) -> ColumnTransformer:
    numeric_types = (pl.Float64, pl.Float32, pl.Int64, pl.Int32, pl.Int16, pl.Int8, pl.UInt64, pl.UInt32, pl.UInt16, pl.UInt8)
    numeric_cols = [c for c in X_df.columns if X_df[c].dtype in numeric_types]
    cat_cols = [c for c in X_df.columns if c not in numeric_cols]

    transformers = []
    if numeric_cols:
        transformers.append(('num', Pipeline([
            ('imp', SimpleImputer(strategy='median')),
            ('scl', StandardScaler()),
        ]), numeric_cols))
    if cat_cols:
        transformers.append(('cat', Pipeline([
            ('imp', SimpleImputer(strategy='most_frequent')),
            ('enc', OneHotEncoder(handle_unknown='ignore', sparse_output=False)),
        ]), cat_cols))

    return ColumnTransformer(transformers, remainder='drop')


# ── Model factory ─────────────────────────────────────────────────────

def _build_model(model_type: str, preset: str, task_type: str) -> object:
    is_clf = task_type == 'classification'

    if model_type == 'xgboost' and not HAS_XGB:
        model_type = 'random_forest'

    PRESETS: dict = {
        'logistic_regression': {
            'default': LogisticRegression(C=1.0, max_iter=1000, random_state=42),
            'tuned':   LogisticRegression(C=0.1, max_iter=2000, solver='saga', random_state=42),
            'grid_search': (
                LogisticRegression(max_iter=1000, random_state=42),
                {'C': [0.01, 0.1, 1.0, 10.0]},
            ),
        },
        'random_forest': {
            'default': (RandomForestClassifier if is_clf else RandomForestRegressor)(
                n_estimators=100, random_state=42),
            'tuned': (RandomForestClassifier if is_clf else RandomForestRegressor)(
                n_estimators=200, max_depth=15, min_samples_split=5, random_state=42),
            'grid_search': (
                (RandomForestClassifier if is_clf else RandomForestRegressor)(random_state=42),
                {'n_estimators': [50, 100, 200], 'max_depth': [None, 10, 20]},
            ),
        },
        'xgboost': {
            'default': (XGBClassifier if is_clf else XGBRegressor)(
                n_estimators=100, learning_rate=0.1, random_state=42, verbosity=0,
                eval_metric='logloss' if is_clf else 'rmse'),
            'tuned': (XGBClassifier if is_clf else XGBRegressor)(
                n_estimators=200, learning_rate=0.05, max_depth=6, random_state=42, verbosity=0,
                eval_metric='logloss' if is_clf else 'rmse'),
            'grid_search': (
                (XGBClassifier if is_clf else XGBRegressor)(random_state=42, verbosity=0),
                {'n_estimators': [100, 200], 'learning_rate': [0.05, 0.1], 'max_depth': [4, 6]},
            ),
        },
        'svm': {
            'default': (SVC(C=1.0, kernel='rbf', probability=is_clf, random_state=42)
                        if is_clf else SVR(C=1.0, kernel='rbf')),
            'tuned':   (SVC(C=10.0, kernel='rbf', gamma='scale', probability=is_clf, random_state=42)
                        if is_clf else SVR(C=10.0, kernel='rbf', gamma='scale')),
            'grid_search': (
                (SVC(probability=is_clf, random_state=42) if is_clf else SVR()),
                {'C': [0.1, 1.0, 10.0], 'kernel': ['rbf', 'linear']},
            ),
        },
        'mlp': {
            'default': (MLPClassifier if is_clf else MLPRegressor)(
                hidden_layer_sizes=(100,), max_iter=500, random_state=42),
            'tuned': (MLPClassifier if is_clf else MLPRegressor)(
                hidden_layer_sizes=(200, 100), max_iter=1000,
                learning_rate='adaptive', random_state=42),
            'grid_search': (
                (MLPClassifier if is_clf else MLPRegressor)(max_iter=500, random_state=42),
                {'hidden_layer_sizes': [(100,), (200,), (100, 50)], 'alpha': [0.0001, 0.001]},
            ),
        },
    }

    entry = PRESETS[model_type][preset]
    if isinstance(entry, tuple):
        estimator, param_grid = entry
        cv = (StratifiedKFold(3, shuffle=True, random_state=42)
              if is_clf else KFold(3, shuffle=True, random_state=42))
        return GridSearchCV(estimator, param_grid, cv=cv, n_jobs=-1, refit=True)
    return entry


# ── Metrics ───────────────────────────────────────────────────────────

def _compute_metrics(y_true, y_pred, y_prob, task_type: str, n_classes: int) -> dict:
    if task_type == 'classification':
        avg = 'binary' if n_classes == 2 else 'macro'
        out = {
            'accuracy':    round(float(accuracy_score(y_true, y_pred)), 4),
            'f1':          round(float(f1_score(y_true, y_pred, average=avg, zero_division=0)), 4),
            'f1_weighted': round(float(f1_score(y_true, y_pred, average='weighted', zero_division=0)), 4),
            'precision':   round(float(precision_score(y_true, y_pred, average=avg, zero_division=0)), 4),
            'recall':      round(float(recall_score(y_true, y_pred, average=avg, zero_division=0)), 4),
        }
        if y_prob is not None and n_classes == 2:
            try:
                from sklearn.metrics import roc_auc_score
                out['roc_auc'] = round(float(roc_auc_score(y_true, y_prob[:, 1])), 4)
            except Exception:
                pass
    else:
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        out = {
            'r2':   round(float(r2_score(y_true, y_pred)), 4),
            'mae':  round(float(mean_absolute_error(y_true, y_pred)), 4),
            'rmse': round(rmse, 4),
        }
        # MAPE — guard against zero targets
        try:
            mask = y_true != 0
            if mask.sum() > 0:
                out['mape'] = round(float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100), 2)
        except Exception:
            pass
    return out


def _get_feature_importances(clf, feature_names: list) -> list:
    est = getattr(clf, 'best_estimator_', clf)
    importances = None
    if hasattr(est, 'feature_importances_'):
        importances = est.feature_importances_
    elif hasattr(est, 'coef_'):
        coef = np.array(est.coef_)
        importances = np.abs(coef).mean(axis=0) if coef.ndim > 1 else np.abs(coef)

    if importances is None or len(importances) != len(feature_names):
        return []

    return sorted(
        [{'feature': f, 'importance': round(float(v), 4)} for f, v in zip(feature_names, importances)],
        key=lambda x: x['importance'], reverse=True,
    )[:15]


# ── Candidate runner ──────────────────────────────────────────────────

def _run_candidate(job_id: str, candidate: dict, df_base: pl.DataFrame) -> None:
    job = store.get_benchmark_job(job_id)
    if not job:
        return

    store.patch_benchmark_result(job_id, candidate['id'], status='running')
    t0 = time.time()

    try:
        # ── Resolve data source ────────────────────────────────────────
        al_session_id = candidate.get('al_session_id')
        ds_override   = candidate.get('dataset_id')

        if al_session_id:
            session = store.get_al_session(al_session_id)
            if not session or not session.labels:
                raise ValueError("AL session has no labels")
            src_ds = store.get_dataset(session.dataset_id)
            df_src = pl.read_csv(get_storage().local_path(src_ds.file_path))
            indices = sorted([int(k) for k in session.labels.keys()])
            df = df_src[indices]
            label_vals = [session.labels[str(i)] for i in indices]
            df = df.with_columns(pl.Series(job.target_column, label_vals))
        elif ds_override and ds_override != job.dataset_id:
            src_ds = store.get_dataset(ds_override)
            if not src_ds:
                raise ValueError("Override dataset not found")
            df = pl.read_csv(get_storage().local_path(src_ds.file_path))
        else:
            df = df_base

        df = df.filter(pl.col(job.target_column).is_not_null())
        if len(df) < 10:
            raise ValueError(f"Too few rows ({len(df)}) after filtering nulls in target")

        exclude      = set(candidate.get('exclude_columns', []))
        feature_cols = [c for c in df.columns if c != job.target_column and c not in exclude]
        X_df         = df.select(feature_cols)
        y_raw        = df[job.target_column].to_list()

        # ── Encode target ──────────────────────────────────────────────
        is_clf = job.task_type == 'classification'
        le = None
        label_classes: list = []

        if is_clf:
            le = LabelEncoder()
            y  = le.fit_transform([str(v) for v in y_raw])
            label_classes = [str(c) for c in le.classes_]
        else:
            y = np.array([float(v) for v in y_raw], dtype=np.float64)

        n_classes = len(label_classes) if is_clf else 0
        X_pd = X_df.to_pandas()

        # ── Build pipeline ─────────────────────────────────────────────
        prep      = _build_preprocessor(X_df)
        estimator = _build_model(candidate['model_type'], candidate['preset'], job.task_type)
        pipeline  = Pipeline([('prep', prep), ('clf', estimator)])

        # ── Evaluate ───────────────────────────────────────────────────
        proto = job.eval_protocol
        cm: Optional[list] = None

        if proto in ('holdout_80', 'holdout_90'):
            test_size = 0.2 if proto == 'holdout_80' else 0.1
            stratify  = y if is_clf and n_classes >= 2 else None
            X_tr, X_te, y_tr, y_te = train_test_split(
                X_pd, y, test_size=test_size, random_state=42, stratify=stratify)
            pipeline.fit(X_tr, y_tr)
            y_pred = pipeline.predict(X_te)
            y_prob = (pipeline.predict_proba(X_te)
                      if is_clf and hasattr(pipeline, 'predict_proba') else None)
            metrics = _compute_metrics(y_te, y_pred, y_prob, job.task_type, n_classes)
            if is_clf:
                cm = confusion_matrix(y_te, y_pred).tolist()
        else:
            n_splits = 5 if proto == 'kfold_5' else 10
            cv = (StratifiedKFold(n_splits, shuffle=True, random_state=42)
                  if is_clf else KFold(n_splits, shuffle=True, random_state=42))

            if is_clf:
                scoring = ['accuracy', 'f1_macro', 'f1_weighted', 'precision_macro', 'recall_macro']
            else:
                scoring = ['r2', 'neg_mean_absolute_error', 'neg_root_mean_squared_error']

            cv_res = cross_validate(pipeline, X_pd, y, cv=cv, scoring=scoring)

            if is_clf:
                metrics = {
                    'accuracy':      round(float(cv_res['test_accuracy'].mean()), 4),
                    'f1':            round(float(cv_res['test_f1_macro'].mean()), 4),
                    'f1_weighted':   round(float(cv_res['test_f1_weighted'].mean()), 4),
                    'precision':     round(float(cv_res['test_precision_macro'].mean()), 4),
                    'recall':        round(float(cv_res['test_recall_macro'].mean()), 4),
                    'accuracy_std':  round(float(cv_res['test_accuracy'].std()), 4),
                    'f1_std':        round(float(cv_res['test_f1_macro'].std()), 4),
                }
            else:
                metrics = {
                    'r2':      round(float(cv_res['test_r2'].mean()), 4),
                    'mae':     round(float(-cv_res['test_neg_mean_absolute_error'].mean()), 4),
                    'rmse':    round(float(-cv_res['test_neg_root_mean_squared_error'].mean()), 4),
                    'r2_std':  round(float(cv_res['test_r2'].std()), 4),
                }

            # Refit full data for confusion matrix + importances
            pipeline.fit(X_pd, y)
            y_pred_full = pipeline.predict(X_pd)
            if is_clf:
                cm = confusion_matrix(y, y_pred_full).tolist()

        training_time_ms = int((time.time() - t0) * 1000)

        # ── Feature importances ────────────────────────────────────────
        try:
            raw_names     = pipeline.named_steps['prep'].get_feature_names_out()
            clean_names   = [n.split('__')[-1] for n in raw_names]
        except Exception:
            clean_names = feature_cols

        feature_importances = _get_feature_importances(pipeline.named_steps['clf'], clean_names)

        # ── Learning curve ─────────────────────────────────────────────
        lc_data: list = []
        try:
            lc_cv = (StratifiedKFold(3, shuffle=True, random_state=42)
                     if is_clf else KFold(3, shuffle=True, random_state=42))
            n = len(X_pd)
            sizes = sorted(set([max(int(n * p), 10) for p in (0.2, 0.4, 0.6, 0.8, 1.0)]))

            # Use default preset for speed
            simple_est  = _build_model(candidate['model_type'], 'default', job.task_type)
            simple_pipe = Pipeline([('prep', _build_preprocessor(X_df)), ('clf', simple_est)])
            score_key   = 'accuracy' if is_clf else 'r2'

            tr_sz, tr_sc, val_sc = learning_curve(
                simple_pipe, X_pd, y,
                train_sizes=sizes, cv=lc_cv, scoring=score_key, n_jobs=1,
            )
            lc_data = [
                {'train_size': int(ts),
                 'train_score': round(float(tr.mean()), 4),
                 'val_score':   round(float(vs.mean()), 4)}
                for ts, tr, vs in zip(tr_sz, tr_sc, val_sc)
            ]
        except Exception:
            pass

        store.patch_benchmark_result(job_id, candidate['id'],
            status='complete',
            metrics=metrics,
            confusion_matrix=cm,
            feature_importances=feature_importances,
            learning_curve=lc_data,
            training_time_ms=training_time_ms,
            label_classes=label_classes,
        )

    except Exception as exc:
        store.patch_benchmark_result(job_id, candidate['id'],
            status='failed',
            error_message=str(exc),
            training_time_ms=int((time.time() - t0) * 1000),
        )


# ── Job runner ────────────────────────────────────────────────────────

def _determine_winner(job: BenchmarkJob) -> Optional[str]:
    complete = [r for r in job.results if r.get('status') == 'complete']
    if not complete:
        return None

    def _score(r: dict) -> float:
        m = r.get('metrics', {})
        if job.task_type == 'classification':
            return m.get('f1', 0.0) * 0.6 + m.get('accuracy', 0.0) * 0.4
        return m.get('r2', -999.0)

    return max(complete, key=_score).get('candidate_id')


def run_benchmark(job_id: str) -> None:
    job = store.get_benchmark_job(job_id)
    if not job:
        return

    job.status = 'running'
    store.update_benchmark_job(job)

    ds = store.get_dataset(job.dataset_id)
    if not ds:
        job.status = 'failed'
        job.error_message = 'Dataset not found'
        store.update_benchmark_job(job)
        return

    try:
        df_full = pl.read_csv(get_storage().local_path(ds.file_path))
    except Exception as e:
        job.status = 'failed'
        job.error_message = str(e)
        store.update_benchmark_job(job)
        return

    # Initialise all results as pending
    job.results = [
        {'candidate_id': c['id'], 'status': 'pending', 'metrics': {},
         'confusion_matrix': None, 'feature_importances': [],
         'learning_curve': [], 'training_time_ms': 0,
         'error_message': None, 'label_classes': []}
        for c in job.candidates
    ]
    store.update_benchmark_job(job)

    # Run candidates in parallel
    threads = [
        threading.Thread(
            target=_run_candidate,
            args=(job_id, c, df_full),
            daemon=True,
        )
        for c in job.candidates
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Finalise
    job = store.get_benchmark_job(job_id)
    from datetime import datetime, timezone
    job.status = 'complete'
    job.winner_candidate_id = _determine_winner(job)
    job.completed_at = datetime.now(timezone.utc).isoformat()
    store.update_benchmark_job(job)
