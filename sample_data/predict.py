"""
Churn prediction inference script.
Uses the pre-trained model in churn_model.joblib.

Usage:
    python predict.py                          # runs on customer_churn_demo.csv
    python predict.py --file path/to/data.csv  # run on your own CSV
    python predict.py --single                 # predict one customer interactively

Requirements:
    pip install scikit-learn pandas joblib
"""

import argparse
import json
import sys
from pathlib import Path

import joblib
import pandas as pd

MODEL_PATH = Path(__file__).parent / "churn_model.joblib"
META_PATH  = Path(__file__).parent / "churn_model_metadata.json"
DATA_PATH  = Path(__file__).parent / "customer_churn_demo.csv"

FEATURES = ["age", "tenure_months", "monthly_spend",
            "support_tickets", "last_login_days", "nps_score",
            "region", "plan_type"]


def load_model():
    if not MODEL_PATH.exists():
        sys.exit(f"Model not found at {MODEL_PATH}")
    return joblib.load(MODEL_PATH)


def predict_batch(model, csv_path: Path):
    df = pd.read_csv(csv_path)
    # Normalise mixed case (same as training)
    if "region" in df.columns:
        df["region"] = df["region"].str.title().str.strip()
    if "plan_type" in df.columns:
        df["plan_type"] = df["plan_type"].str.lower().str.strip()

    X = df[FEATURES]
    probs = model.predict_proba(X)[:, 1]
    preds = model.predict(X)

    df["churn_probability"] = probs.round(3)
    df["churn_prediction"] = ["yes" if p == 1 else "no" for p in preds]

    # Summary
    n = len(df)
    flagged = (preds == 1).sum()
    print(f"\n{'─'*50}")
    print(f"  Dataset : {csv_path.name}")
    print(f"  Rows    : {n}")
    print(f"  At-risk : {flagged} customers ({flagged/n*100:.1f}%)")
    print(f"{'─'*50}")

    # Top 10 highest risk
    top = df.nlargest(10, "churn_probability")[
        ["customer_id", "churn_probability", "plan_type", "tenure_months", "nps_score"]
    ] if "customer_id" in df.columns else df.nlargest(10, "churn_probability")[
        ["churn_probability", "plan_type", "tenure_months", "nps_score"]
    ]
    print("\nTop 10 highest-risk customers:")
    print(top.to_string(index=False))

    out_path = csv_path.parent / (csv_path.stem + "_predictions.csv")
    df.to_csv(out_path, index=False)
    print(f"\nFull results saved → {out_path}\n")


def predict_single(model):
    print("\nEnter customer details (press Enter to use median/default):\n")
    defaults = {
        "age": 35, "tenure_months": 18, "monthly_spend": 89.0,
        "support_tickets": 2, "last_login_days": 10, "nps_score": 6.5,
        "region": "North America", "plan_type": "pro",
    }
    data = {}
    for feat, default in defaults.items():
        val = input(f"  {feat} [{default}]: ").strip()
        if val == "":
            data[feat] = default
        else:
            try:
                data[feat] = float(val) if "." in val or feat in ("monthly_spend", "nps_score") else int(val)
            except ValueError:
                data[feat] = val

    X = pd.DataFrame([data])
    X["region"] = X["region"].str.title().str.strip()
    X["plan_type"] = X["plan_type"].str.lower().str.strip()

    prob = model.predict_proba(X)[0, 1]
    pred = "WILL CHURN" if prob >= 0.5 else "will NOT churn"
    risk = "HIGH" if prob >= 0.6 else "MEDIUM" if prob >= 0.35 else "LOW"

    print(f"\n{'─'*40}")
    print(f"  Churn probability : {prob:.1%}")
    print(f"  Prediction        : {pred}")
    print(f"  Risk level        : {risk}")
    print(f"{'─'*40}\n")


def print_metadata():
    if META_PATH.exists():
        meta = json.loads(META_PATH.read_text())
        perf = meta["performance"]
        print(f"\nModel: {meta['model_type']}")
        print(f"Trained on: {meta['trained_on']}  ({meta['training_rows']} rows)")
        print(f"Accuracy: {perf['accuracy']:.1%}   ROC-AUC: {perf['roc_auc']:.3f}   CV-AUC: {perf['cv_auc_mean']:.3f} ± {perf['cv_auc_std']:.3f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Datrix churn prediction demo")
    parser.add_argument("--file", type=Path, default=DATA_PATH)
    parser.add_argument("--single", action="store_true", help="Predict a single customer interactively")
    args = parser.parse_args()

    print_metadata()
    model = load_model()

    if args.single:
        predict_single(model)
    else:
        predict_batch(model, args.file)
