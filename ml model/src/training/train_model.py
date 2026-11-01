"""
Stage 1 Physics-Informed Dual-Engine Calibrated Cloudburst Risk Scorer
Integrates Orographic Flow-Blocking Physics (Convective Froude Number, Valley Trapping Index,
Equivalent Potential Temperature Theta_e, and Orographic Mechanical Lift)
with a Dual-Engine Ensemble (LightGBM + XGBoost) and Out-Of-Fold Platt calibration.
Exports production model artifact to models/stage1_risk_scorer.pkl.
"""

import os
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
    precision_score,
    recall_score,
    confusion_matrix
)
from sklearn.linear_model import LogisticRegression
import lightgbm as lgb
from xgboost import XGBClassifier

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "..", "dataset", "master_cloudburst_550.csv")
if not os.path.exists(DATA_PATH):
    DATA_PATH = os.path.join(BASE_DIR, "..", "data", "processed", "master_cloudburst_550.csv")
MODEL_DIR = os.path.join(BASE_DIR, "..", "models")
MODEL_OUT = os.path.join(MODEL_DIR, "stage1_risk_scorer.pkl")

PHYSICS_FEATURES = [
    "elevation_m",
    "slope_deg",
    "aspect_deg",
    "temperature_c",
    "dew_point_c",
    "dew_point_depression_c",
    "relative_humidity_pct",
    "surface_pressure_hpa",
    "wind_speed_kmh",
    "theta_e_k",
    "valley_trapping_index",
    "orographic_lift_ms"
]

def compute_physics_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    U_ms = df["wind_speed_kmh"] / 3.6
    slope_rad = np.radians(df["slope_deg"])
    H_barrier = np.maximum(df["elevation_m"] * np.sin(slope_rad), 50.0)
    N_buoyancy = 0.011  # Moist adiabatic Brunt-Vaisala buoyancy frequency
    
    # 1. Convective Froude Number (Fr = U / (N * H))
    froude = U_ms / np.maximum(N_buoyancy * H_barrier, 0.5)
    
    # 2. Equivalent Potential Temperature Theta_e (Bolton formulation)
    T_k = df["temperature_c"] + 273.15
    e_act = 6.112 * np.exp((17.67 * df["dew_point_c"]) / (df["dew_point_c"] + 243.5))
    q = (0.622 * e_act) / (df["surface_pressure_hpa"] - 0.378 * e_act)
    theta = T_k * (1000.0 / df["surface_pressure_hpa"]) ** 0.286
    Lv, Cp = 2.501e6, 1004.0
    df["theta_e_k"] = theta * np.exp((Lv * q) / (Cp * T_k))
    
    # 3. Valley Convective Trapping Index (Flow blocking + high Theta_e + steep relief)
    df["valley_trapping_index"] = (df["theta_e_k"] / 330.0) * (1.0 / (froude + 0.1)) * np.sin(slope_rad)
    
    # 4. Orographic Mechanical Lift (m/s)
    df["orographic_lift_ms"] = U_ms * np.sin(slope_rad)
    
    return df

def train_and_export():
    print(f"Loading master dataset from: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    print(f"Total instances: {len(df)} | Extreme Bursts (1): {sum(df['label'] == 1)} | Hard Negatives (0): {sum(df['label'] == 0)}")
    
    # Enrich with Orographic & Thermodynamic Physics
    df_physics = compute_physics_features(df)
    
    X = df_physics[PHYSICS_FEATURES]
    y = df_physics["label"]
    
    print(f"Physics Features ({len(PHYSICS_FEATURES)}): {PHYSICS_FEATURES}")
    
    # 5-Fold Stratified Cross-Validation for Out-of-Fold Blending & Calibration
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    oof_lgb = np.zeros(len(df))
    oof_xgb = np.zeros(len(df))
    fold_aucs = []
    
    print("\nRunning 5-Fold Cross Validation on Physics-Informed Dual Ensemble (LGBM + XGB)...")
    for fold, (tr_idx, val_idx) in enumerate(skf.split(X, y)):
        X_tr, y_tr = X.iloc[tr_idx], y.iloc[tr_idx]
        X_va, y_va = X.iloc[val_idx], y.iloc[val_idx]
        
        clf_lgb = lgb.LGBMClassifier(
            scale_pos_weight=11.6,
            n_estimators=90,
            max_depth=4,
            learning_rate=0.04,
            random_state=42 + fold,
            verbose=-1
        )
        clf_xgb = XGBClassifier(
            scale_pos_weight=10.0,
            n_estimators=75,
            max_depth=3,
            learning_rate=0.04,
            subsample=0.85,
            colsample_bytree=0.85,
            random_state=42 + fold,
            eval_metric="logloss"
        )
        
        clf_lgb.fit(X_tr, y_tr)
        clf_xgb.fit(X_tr, y_tr)
        
        p_lgb = clf_lgb.predict_proba(X_va)[:, 1]
        p_xgb = clf_xgb.predict_proba(X_va)[:, 1]
        
        oof_lgb[val_idx] = p_lgb
        oof_xgb[val_idx] = p_xgb
        
        blend_fold = 0.5 * p_lgb + 0.5 * p_xgb
        fold_aucs.append(roc_auc_score(y_va, blend_fold))
        
    oof_blend = 0.5 * oof_lgb + 0.5 * oof_xgb
    pr_auc = average_precision_score(y, oof_blend)
    print(f"5-Fold CV ROC-AUC: {np.mean(fold_aucs):.4f} (+/- {np.std(fold_aucs):.4f})")
    print(f"Precision-Recall AUC (PR-AUC): {pr_auc:.4f}")
    
    # Fit Platt Scaler on Out-of-Fold Blended probabilities
    calibrator = LogisticRegression(C=1.0, solver="lbfgs")
    calibrator.fit(oof_blend.reshape(-1, 1), y)
    oof_cal = calibrator.predict_proba(oof_blend.reshape(-1, 1))[:, 1]
    
    brier = brier_score_loss(y, oof_cal)
    print(f"Calibrated Brier Score Loss: {brier:.4f} (Optimal -> 0.0)")
    
    # Evaluate Operational Thresholds
    watch_th = 0.10   # Watch threshold
    warn_th = 0.18    # Severe warning threshold
    
    watch_preds = (oof_cal >= watch_th).astype(int)
    warn_preds = (oof_cal >= warn_th).astype(int)
    
    def get_csi(y_true, y_pred):
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
        return tp / (tp + fp + fn) if (tp + fp + fn) > 0 else 0.0
    
    tn_w, fp_w, fn_w, tp_w = confusion_matrix(y, watch_preds).ravel()
    tn_s, fp_s, fn_s, tp_s = confusion_matrix(y, warn_preds).ravel()
    
    print("\nOperational Advisory Performance:")
    print(f"[Watch Threshold (>= {watch_th*100:.0f}% Calibrated Risk)]")
    print(f"  Recall (Capture Rate): {recall_score(y, watch_preds)*100:.1f}% ({tp_w}/{tp_w+fn_w} bursts)")
    print(f"  Precision:             {precision_score(y, watch_preds)*100:.1f}%")
    print(f"  False Alarms:          {fp_w}/{tn_w+fp_w} ({(fp_w/(tn_w+fp_w))*100:.1f}%)")
    print(f"  Critical Success Index:{get_csi(y, watch_preds):.3f}")
    
    print(f"\n[Severe Warning Threshold (>= {warn_th*100:.0f}% Calibrated Risk)]")
    print(f"  Recall:                {recall_score(y, warn_preds)*100:.1f}% ({tp_s}/{tp_s+fn_s} bursts)")
    print(f"  Precision:             {precision_score(y, warn_preds)*100:.1f}%")
    print(f"  False Alarms:          {fp_s}/{tn_s+fp_s} ({(fp_s/(tn_s+fp_s))*100:.1f}%)")
    print(f"  Critical Success Index:{get_csi(y, warn_preds):.3f}")
    
    # Train final models on full 557 dataset
    print("\nTraining final dual models on full 557-event dataset with physics features...")
    final_lgb = lgb.LGBMClassifier(
        scale_pos_weight=11.6,
        n_estimators=90,
        max_depth=4,
        learning_rate=0.04,
        random_state=42,
        verbose=-1
    )
    final_xgb = XGBClassifier(
        scale_pos_weight=10.0,
        n_estimators=75,
        max_depth=3,
        learning_rate=0.04,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        eval_metric="logloss"
    )
    final_lgb.fit(X, y)
    final_xgb.fit(X, y)
    
    # Package into clean deployment artifact
    artifact = {
        "model_type": "physics_informed_dual_ensemble",
        "model_lgb": final_lgb,
        "model_xgb": final_xgb,
        "blend_weights": {"lgb": 0.5, "xgb": 0.5},
        "calibrator": calibrator,
        "features": PHYSICS_FEATURES,
        "thresholds": {
            "watch_raw_prob": watch_th,
            "warn_raw_prob": warn_th,
            "baseline_prob": 0.04,
            "ceiling_prob": 0.28
        },
        "metrics": {
            "cv_auc_mean": float(np.mean(fold_aucs)),
            "pr_auc": float(pr_auc),
            "brier_score": float(brier),
            "watch_recall": float(recall_score(y, watch_preds)),
            "watch_precision": float(precision_score(y, watch_preds)),
            "warn_recall": float(recall_score(y, warn_preds)),
            "warn_precision": float(precision_score(y, warn_preds)),
            "csi_watch": float(get_csi(y, watch_preds)),
            "csi_warning": float(get_csi(y, warn_preds))
        }
    }
    
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(artifact, MODEL_OUT)
    print(f"\nSuccessfully exported physics-informed ensemble artifact to: {MODEL_OUT}")

if __name__ == "__main__":
    train_and_export()
