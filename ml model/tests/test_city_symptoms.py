"""
Test Model Response on Indore, Delhi, and Mumbai:
Compares Normal Monsoon conditions vs Severe Convective Burst Symptoms
"""

import os
import sys
import joblib
import numpy as np
import pandas as pd

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "stage1_risk_scorer.pkl")

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

def run_city_test():
    artifact = joblib.load(MODEL_PATH)
    calibrator = artifact["calibrator"]
    features = artifact["features"]
    thresholds = artifact["thresholds"]
    
    def predict(row_dict):
        df_phys = compute_physics(pd.DataFrame([row_dict]))
        if artifact.get("model_type") in ["dual_ensemble_blend", "physics_informed_dual_ensemble"]:
            w1 = artifact["blend_weights"]["lgb"]
            w2 = artifact["blend_weights"]["xgb"]
            p_raw = w1 * artifact["model_lgb"].predict_proba(df_phys[features])[:, 1][0] + w2 * artifact["model_xgb"].predict_proba(df_phys[features])[:, 1][0]
        else:
            p_raw = artifact["model"].predict_proba(df_phys[features])[:, 1][0]
            
        p_cal = float(calibrator.predict_proba(np.array([[p_raw]]))[:, 1][0])
        p_base = thresholds["baseline_prob"]
        p_ceil = thresholds["ceiling_prob"]
        cri = float(np.clip((p_cal - p_base) / (p_ceil - p_base), 0.0, 1.0) * 100.0)
        
        if p_cal >= thresholds["warn_raw_prob"]:
            status = "RED (HIGH CONVECTIVE WARNING)"
        elif p_cal >= thresholds["watch_raw_prob"]:
            status = "YELLOW (CLOUDBURST WATCH)"
        else:
            status = "GREEN (NORMAL / LOW RISK)"
        return cri, p_cal, status

    cities = [
        {
            "name": "Mumbai (Coastal Plains / Santacruz)",
            "elev": 10.0, "slope": 0.5, "aspect": 270.0, "base_press": 1005.0,
            # Normal rainy day in Mumbai
            "normal_temp": 28.0, "normal_dew": 24.0, "normal_press": 1005.0, "normal_wind": 14.0,
            # 26 July 2005 Disaster Symptoms (944mm downpour): Deep atmospheric depression, extreme moisture saturation
            "burst_temp": 26.5, "burst_dew": 26.3, "burst_press": 992.0, "burst_wind": 38.0
        },
        {
            "name": "Delhi NCR (Northern Urban Basin / Yamuna)",
            "elev": 213.0, "slope": 0.3, "aspect": 0.0, "base_press": 988.0,
            # Normal rainy day in Delhi
            "normal_temp": 31.0, "normal_dew": 24.5, "normal_press": 988.0, "normal_wind": 8.0,
            # Severe Urban Downpour / Cloudburst symptoms: Sudden moisture surge, localized low-pressure trough, squall
            "burst_temp": 27.5, "burst_dew": 27.2, "burst_press": 978.0, "burst_wind": 32.0
        },
        {
            "name": "Indore (Central Malwa Plateau)",
            "elev": 553.0, "slope": 1.2, "aspect": 180.0, "base_press": 950.0,
            # Normal rainy day in Indore
            "normal_temp": 27.0, "normal_dew": 21.0, "normal_press": 950.0, "normal_wind": 10.0,
            # Severe Monsoon Depression Cloudburst symptoms: Saturated boundary layer, steep barometric plunge
            "burst_temp": 24.8, "burst_dew": 24.5, "burst_press": 938.0, "burst_wind": 30.0
        }
    ]

    print("\n" + "=" * 90)
    print("      TESTING MODEL ALERT BEHAVIOR: INDORE, DELHI & MUMBAI")
    print("=" * 90)

    for c in cities:
        print(f"\n📍 {c['name'].upper()} (Elevation: {c['elev']}m, Slope: {c['slope']} deg)")
        print("-" * 90)
        
        # 1. Normal Weather
        norm_row = {
            "elevation_m": c["elev"], "slope_deg": c["slope"], "aspect_deg": c["aspect"],
            "temperature_c": c["normal_temp"], "dew_point_c": c["normal_dew"],
            "dew_point_depression_c": c["normal_temp"] - c["normal_dew"],
            "relative_humidity_pct": 78, "surface_pressure_hpa": c["normal_press"],
            "wind_speed_kmh": c["normal_wind"]
        }
        cri_n, p_n, stat_n = predict(norm_row)
        print(f"  [NORMAL MONSOON RAIN]    : Temp {c['normal_temp']}C | Dew {c['normal_dew']}C (Dep {c['normal_temp']-c['normal_dew']:.1f}C) | Press {c['normal_press']}hPa")
        print(f"    -> Convective Risk (CRI): {cri_n:5.1f}% | Calibrated Prob: {p_n*100:4.1f}% | Alert: {stat_n}")
        
        # 2. Severe Cloudburst Symptoms
        burst_row = {
            "elevation_m": c["elev"], "slope_deg": c["slope"], "aspect_deg": c["aspect"],
            "temperature_c": c["burst_temp"], "dew_point_c": c["burst_dew"],
            "dew_point_depression_c": round(c["burst_temp"] - c["burst_dew"], 2),
            "relative_humidity_pct": 98, "surface_pressure_hpa": c["burst_press"],
            "wind_speed_kmh": c["burst_wind"]
        }
        cri_b, p_b, stat_b = predict(burst_row)
        print(f"  [CLOUDBURST SYMPTOMS]    : Temp {c['burst_temp']}C | Dew {c['burst_dew']}C (Dep {c['burst_temp']-c['burst_dew']:.1f}C) | Press {c['burst_press']}hPa | Wind {c['burst_wind']}km/h")
        print(f"    -> Convective Risk (CRI): {cri_b:5.1f}% | Calibrated Prob: {p_b*100:4.1f}% | Alert: {stat_b}")

    print("\n" + "=" * 90 + "\n")

if __name__ == "__main__":
    run_city_test()

