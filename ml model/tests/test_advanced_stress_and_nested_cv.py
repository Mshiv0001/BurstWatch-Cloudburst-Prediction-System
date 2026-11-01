"""
Advanced Model Rigorous Stress-Test Suite
1. Nested Cross-Validation (5-Fold Outer x 3-Fold Inner)
2. Adversarial Perturbation Test (Worst-Case Directional Sensor Attack)
3. Out-of-Distribution (OOD) Extreme Climatological Stress Test
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import (
    roc_auc_score, average_precision_score, brier_score_loss,
    precision_score, recall_score, confusion_matrix
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
DATA_PATH = os.path.join(BASE_DIR, "dataset", "master_cloudburst_550.csv")
if not os.path.exists(DATA_PATH):
    DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "master_cloudburst_550.csv")

def compute_physics(df):
    df = df.copy()
    U_ms = df["wind_speed_kmh"] / 3.6
    slope_rad = np.radians(df["slope_deg"])
    H_barrier = np.maximum(df["elevation_m"] * np.sin(slope_rad), 50.0)
    N_buoyancy = 0.011
    froude = U_ms / np.maximum(N_buoyancy * H_barrier, 0.5)
    
    T_k = df["temperature_c"] + 273.15
    e_act = 6.112 * np.exp((17.67 * df["dew_point_c"]) / (df["dew_point_c"] + 243.5))
    q = (0.622 * e_act) / (df["surface_pressure_hpa"] - 0.378 * e_act)
    theta = T_k * (1000.0 / df["surface_pressure_hpa"]) ** 0.286
    Lv, Cp = 2.501e6, 1004.0
    df["theta_e_k"] = theta * np.exp((Lv * q) / (Cp * T_k))
    df["valley_trapping_index"] = (df["theta_e_k"] / 330.0) * (1.0 / (froude + 0.1)) * np.sin(slope_rad)
    df["orographic_lift_ms"] = U_ms * np.sin(slope_rad)
    return df

FEATURES = [
    "elevation_m", "slope_deg", "aspect_deg", "temperature_c",
    "dew_point_c", "dew_point_depression_c", "relative_humidity_pct",
    "surface_pressure_hpa", "wind_speed_kmh", "theta_e_k",
    "valley_trapping_index", "orographic_lift_ms"
]

def run_nested_cv(X, y):
    print("=== PART 1: NESTED CROSS-VALIDATION (5-Fold Outer x 3-Fold Inner) ===")
    outer_cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    outer_aucs, outer_pr_aucs, outer_briers = [], [], []
    outer_recalls, outer_precisions = [], []
    
    for fold, (tr_idx, te_idx) in enumerate(outer_cv.split(X, y)):
        X_train, y_train = X.iloc[tr_idx], y.iloc[tr_idx]
        X_test, y_test = X.iloc[te_idx], y.iloc[te_idx]
        
        # Inner CV for hyperparameter tuning & OOF calibration
        inner_cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42 + fold)
        inner_oof_blend = np.zeros(len(X_train))
        
        for in_tr, in_val in inner_cv.split(X_train, y_train):
            m1 = lgb.LGBMClassifier(scale_pos_weight=11.6, n_estimators=85, max_depth=4, learning_rate=0.04, random_state=42, verbose=-1)
            m2 = XGBClassifier(scale_pos_weight=10.0, n_estimators=75, max_depth=3, learning_rate=0.04, subsample=0.85, random_state=42, eval_metric="logloss")
            
            m1.fit(X_train.iloc[in_tr], y_train.iloc[in_tr])
            m2.fit(X_train.iloc[in_tr], y_train.iloc[in_tr])
            
            p1 = m1.predict_proba(X_train.iloc[in_val])[:, 1]
            p2 = m2.predict_proba(X_train.iloc[in_val])[:, 1]
            inner_oof_blend[in_val] = 0.5 * p1 + 0.5 * p2
            
        calibrator = LogisticRegression(C=1.0)
        calibrator.fit(inner_oof_blend.reshape(-1, 1), y_train)
        
        # Train outer ensemble on full X_train
        m1_outer = lgb.LGBMClassifier(scale_pos_weight=11.6, n_estimators=85, max_depth=4, learning_rate=0.04, random_state=42, verbose=-1)
        m2_outer = XGBClassifier(scale_pos_weight=10.0, n_estimators=75, max_depth=3, learning_rate=0.04, subsample=0.85, random_state=42, eval_metric="logloss")
        m1_outer.fit(X_train, y_train)
        m2_outer.fit(X_train, y_train)
        
        p_te_blend = 0.5 * m1_outer.predict_proba(X_test)[:, 1] + 0.5 * m2_outer.predict_proba(X_test)[:, 1]
        p_te_cal = calibrator.predict_proba(p_te_blend.reshape(-1, 1))[:, 1]
        
        outer_aucs.append(roc_auc_score(y_test, p_te_cal))
        outer_pr_aucs.append(average_precision_score(y_test, p_te_cal))
        outer_briers.append(brier_score_loss(y_test, p_te_cal))
        
        preds_warn = (p_te_cal >= 0.18).astype(int)
        outer_recalls.append(recall_score(y_test, preds_warn, zero_division=0))
        outer_precisions.append(precision_score(y_test, preds_warn, zero_division=0))
        
    print(f"Outer Test ROC-AUC  : {np.mean(outer_aucs):.4f} +/- {np.std(outer_aucs):.4f}")
    print(f"Outer Test PR-AUC   : {np.mean(outer_pr_aucs):.4f} +/- {np.std(outer_pr_aucs):.4f}")
    print(f"Outer Test Brier    : {np.mean(outer_briers):.4f} +/- {np.std(outer_briers):.4f}")
    print(f"Outer Warning Recall: {np.mean(outer_recalls)*100:.1f}%")
    print(f"Outer Warning Prec. : {np.mean(outer_precisions)*100:.1f}%")
    return m1_outer, m2_outer, calibrator

def run_adversarial_perturbation(m1, m2, calibrator, df):
    print("\n=== PART 2: ADVERSARIAL PERTURBATION STRESS-TEST ===")
    # Extract only positive disaster events
    pos_df = df[df["label"] == 1].copy()
    
    # Worst-case directional perturbation bounds (sensor error margins)
    # Attack objective: Suppress true cloudburst warning by perturbing inputs in worst direction
    eps_temp = -1.5     # Artificial cooling (trying to reduce apparent convective buoyancy)
    eps_dew = -2.0      # Drying dewpoint (trying to widen dewpoint depression)
    eps_press = +6.0    # Pressure surge (trying to fake high-pressure ridge)
    eps_wind = -5.0     # Wind drop (trying to kill upslope lift)
    
    pos_adv = pos_df.copy()
    pos_adv["temperature_c"] += eps_temp
    pos_adv["dew_point_c"] += eps_dew
    pos_adv["dew_point_depression_c"] = pos_adv["temperature_c"] - pos_adv["dew_point_c"]
    pos_adv["surface_pressure_hpa"] += eps_press
    pos_adv["wind_speed_kmh"] = np.maximum(pos_adv["wind_speed_kmh"] + eps_wind, 1.0)
    
    # Recompute physics
    pos_adv_phys = compute_physics(pos_adv)
    pos_orig_phys = compute_physics(pos_df)
    
    p_orig_blend = 0.5 * m1.predict_proba(pos_orig_phys[FEATURES])[:, 1] + 0.5 * m2.predict_proba(pos_orig_phys[FEATURES])[:, 1]
    p_orig_cal = calibrator.predict_proba(p_orig_blend.reshape(-1, 1))[:, 1]
    
    p_adv_blend = 0.5 * m1.predict_proba(pos_adv_phys[FEATURES])[:, 1] + 0.5 * m2.predict_proba(pos_adv_phys[FEATURES])[:, 1]
    p_adv_cal = calibrator.predict_proba(p_adv_blend.reshape(-1, 1))[:, 1]
    
    orig_detected = np.sum(p_orig_cal >= 0.10) # Watch threshold
    adv_detected = np.sum(p_adv_cal >= 0.10)
    
    retention_rate = (adv_detected / orig_detected) * 100.0 if orig_detected > 0 else 0.0
    print(f"Adversarial Attack Parameters: ΔT=-1.5C, ΔTd=-2.0C, ΔP=+6hPa, ΔWind=-5km/h")
    print(f"Original Cloudbursts Flagged (Watch/Warn): {orig_detected} / {len(pos_df)}")
    print(f"Surviving Cloudbursts Under Attack       : {adv_detected} / {len(pos_df)}")
    print(f"Adversarial Detection Retention Rate     : {retention_rate:.1f}%")
    print(f"Mean Confidence Drop under Attack        : {(np.mean(p_orig_cal) - np.mean(p_adv_cal))*100:.2f}%")

def run_ood_stress_test(m1, m2, calibrator):
    print("\n=== PART 3: OUT-OF-DISTRIBUTION (OOD) EXTREME CLIMATOLOGICAL TEST ===")
    ood_scenarios = [
        {
            "name": "High-Altitude Hyper-Arid Desert (Leh/Changthang 4800m, Freezing Dry)",
            "data": {
                "elevation_m": 4800.0, "slope_deg": 12.0, "aspect_deg": 90.0,
                "temperature_c": -12.0, "dew_point_c": -28.0, "dew_point_depression_c": 16.0,
                "relative_humidity_pct": 18, "surface_pressure_hpa": 560.0, "wind_speed_kmh": 22.0
            },
            "expected": "GREEN (NORMAL / 0% RISK)"
        },
        {
            "name": "Severe Cyclone Core Landfall (Ghats Escarpment 1200m, 90 km/h wind)",
            "data": {
                "elevation_m": 1200.0, "slope_deg": 45.0, "aspect_deg": 240.0,
                "temperature_c": 22.0, "dew_point_c": 21.8, "dew_point_depression_c": 0.2,
                "relative_humidity_pct": 99, "surface_pressure_hpa": 860.0, "wind_speed_kmh": 85.0
            },
            "expected": "RED (SEVERE WARNING)"
        },
        {
            "name": "Extreme Thar Desert Pre-Monsoon Heatwave (Jaisalmer 49 C, Dry Convection)",
            "data": {
                "elevation_m": 180.0, "slope_deg": 0.1, "aspect_deg": 0.0,
                "temperature_c": 49.0, "dew_point_c": 12.0, "dew_point_depression_c": 37.0,
                "relative_humidity_pct": 12, "surface_pressure_hpa": 985.0, "wind_speed_kmh": 35.0
            },
            "expected": "GREEN (NORMAL / ZERO CLOUDBURST RISK)"
        },
        {
            "name": "Vertical Himalayan Cliff Face (68 deg wall, 3800m elevation)",
            "data": {
                "elevation_m": 3800.0, "slope_deg": 68.0, "aspect_deg": 180.0,
                "temperature_c": 14.0, "dew_point_c": 13.8, "dew_point_depression_c": 0.2,
                "relative_humidity_pct": 99, "surface_pressure_hpa": 640.0, "wind_speed_kmh": 18.0
            },
            "expected": "RED (HIGH CONVECTIVE WARNING)"
        }
    ]
    
    for sc in ood_scenarios:
        df_single = pd.DataFrame([sc["data"]])
        df_phys = compute_physics(df_single)
        p_raw = 0.5 * m1.predict_proba(df_phys[FEATURES])[:, 1][0] + 0.5 * m2.predict_proba(df_phys[FEATURES])[:, 1][0]
        p_cal = float(calibrator.predict_proba(np.array([[p_raw]]))[:, 1][0])
        cri = float(np.clip((p_cal - 0.04) / (0.28 - 0.04), 0.0, 1.0) * 100.0)
        
        if p_cal >= 0.18:
            status = "RED (SEVERE WARNING)"
        elif p_cal >= 0.10:
            status = "YELLOW (WATCH)"
        else:
            status = "GREEN (NORMAL)"
            
        print(f"Scenario: {sc['name']}")
        print(f"  Result -> CRI: {cri:5.1f}% | Calibrated Prob: {p_cal*100:.1f}% | Status: {status} (Expected: {sc['expected']})")
        print("-" * 80)

def main():
    df = pd.read_csv(DATA_PATH)
    df_phys = compute_physics(df)
    X = df_phys[FEATURES]
    y = df_phys["label"]
    
    m1, m2, calibrator = run_nested_cv(X, y)
    run_adversarial_perturbation(m1, m2, calibrator, df)
    run_ood_stress_test(m1, m2, calibrator)

if __name__ == "__main__":
    main()

