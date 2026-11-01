"""
Live Real-Time Data Ingestion & Cloudburst Risk Inference Pipeline
Powered by Dual-Engine Ensemble (LightGBM + XGBoost) with Platt probability calibration.
Features resilient retry handlers and local terrain caching.
"""

import os
import sys
import time
import argparse
import json
import joblib
import numpy as np
import pandas as pd
import requests

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "..", "models", "stage1_risk_scorer.pkl")
CACHE_DIR = os.path.join(BASE_DIR, "..", "data", "cache")
TERRAIN_CACHE_FILE = os.path.join(CACHE_DIR, "terrain_cache.json")

MONITORING_NETWORK = [
    {"name": "Kedarnath Valley", "state": "Uttarakhand", "lat": 30.7346, "lon": 79.0669},
    {"name": "Dehradun Song Basin", "state": "Uttarakhand", "lat": 30.3472, "lon": 78.1418},
    {"name": "Joshimath / Dhauliganga", "state": "Uttarakhand", "lat": 30.5564, "lon": 79.5667},
    {"name": "Manali Catchment", "state": "Himachal Pradesh", "lat": 32.2432, "lon": 77.1892},
    {"name": "Baltal / Amarnath", "state": "Jammu & Kashmir", "lat": 34.2500, "lon": 75.4000},
    {"name": "Leh Indus Valley", "state": "Ladakh", "lat": 34.1526, "lon": 77.5771},
    {"name": "Mahabaleshwar Ghats", "state": "Maharashtra", "lat": 17.9237, "lon": 73.6586},
    {"name": "Wayanad High Ranges", "state": "Kerala", "lat": 11.5510, "lon": 76.1280},
    {"name": "Cherrapunji / Sohra", "state": "Meghalaya", "lat": 25.2700, "lon": 91.7300},
    {"name": "Delhi NCR Urban Basin", "state": "Delhi", "lat": 28.5840, "lon": 77.2060}
]

def load_scorer():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model artifact not found at: {MODEL_PATH}")
    return joblib.load(MODEL_PATH)

def fetch_with_retry(url, retries=3, timeout=15):
    for attempt in range(retries):
        try:
            resp = requests.get(url, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            if attempt == retries - 1:
                raise e
            time.sleep(1.0 * (attempt + 1))

def get_terrain_cache():
    if os.path.exists(TERRAIN_CACHE_FILE):
        try:
            with open(TERRAIN_CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_terrain_cache(cache):
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(TERRAIN_CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)

def fetch_terrain_params(lat: float, lon: float):
    cache = get_terrain_cache()
    key = f"{lat:.4f}_{lon:.4f}"
    if key in cache:
        return cache[key]
        
    d_lat = 0.001
    d_lon = 0.001
    
    lats = [lat, lat + d_lat, lat - d_lat, lat, lat]
    lons = [lon, lon, lon, lon + d_lon, lon - d_lon]
    
    url = f"https://api.open-meteo.com/v1/elevation?latitude={','.join(map(str, lats))}&longitude={','.join(map(str, lons))}"
    data = fetch_with_retry(url)
    elevs = data.get("elevation", [])
    
    if len(elevs) < 5:
        raise ValueError("Failed to retrieve 5-point elevation stencil.")
        
    z0, z_north, z_south, z_east, z_west = elevs
    
    dz_dy = (z_north - z_south) / (2 * 111139.0 * d_lat)
    dz_dx = (z_east - z_west) / (2 * 111139.0 * d_lon * np.cos(np.radians(lat)))
    
    slope_deg = float(np.degrees(np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))))
    aspect_rad = np.arctan2(dz_dy, -dz_dx)
    aspect_deg = float((90.0 - np.degrees(aspect_rad)) % 360.0)
    
    res = {
        "elevation_m": round(float(z0), 1),
        "slope_deg": round(slope_deg, 2),
        "aspect_deg": round(aspect_deg, 1)
    }
    
    cache[key] = res
    save_terrain_cache(cache)
    return res

WEATHER_CACHE_FILE = os.path.join(CACHE_DIR, "weather_cache.json")

def get_weather_cache():
    if os.path.exists(WEATHER_CACHE_FILE):
        try:
            with open(WEATHER_CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_weather_cache(cache):
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(WEATHER_CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2)

def fetch_live_weather(lat: float, lon: float):
    cache = get_weather_cache()
    key = f"{lat:.4f}_{lon:.4f}"
    
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat:.4f}&longitude={lon:.4f}&"
        f"current=temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,precipitation&"
        f"timezone=UTC"
    )
    try:
        data = fetch_with_retry(url, retries=2, timeout=6)
        curr = data.get("current", {})
        
        t = curr.get("temperature_2m")
        dp = curr.get("dew_point_2m")
        rh = curr.get("relative_humidity_2m")
        sp = curr.get("surface_pressure")
        w = curr.get("wind_speed_10m")
        precip = curr.get("precipitation", 0.0)
        
        dp_dep = t - dp if (t is not None and dp is not None) else None
        
        res = {
            "timestamp_utc": curr.get("time") + "Z",
            "temperature_c": t,
            "dew_point_c": dp,
            "dew_point_depression_c": round(dp_dep, 2) if dp_dep is not None else None,
            "relative_humidity_pct": int(rh) if rh is not None else None,
            "surface_pressure_hpa": sp,
            "wind_speed_kmh": w,
            "current_precipitation_mm": precip,
            "is_cached": False
        }
        cache[key] = res
        save_weather_cache(cache)
        return res
    except Exception as e:
        # Fallback to local cache if network drops
        if key in cache:
            cached_res = cache[key].copy()
            cached_res["is_cached"] = True
            return cached_res
        # Safe default mountain baseline
        return {
            "timestamp_utc": "OFFLINE_FALLBACK_UTC",
            "temperature_c": 12.0,
            "dew_point_c": 4.0,
            "dew_point_depression_c": 8.0,
            "relative_humidity_pct": 58,
            "surface_pressure_hpa": 720.0,
            "wind_speed_kmh": 6.0,
            "current_precipitation_mm": 0.0,
            "is_cached": True
        }

def compute_physics_features(row_dict):
    U_ms = row_dict["wind_speed_kmh"] / 3.6
    slope_rad = np.radians(row_dict["slope_deg"])
    H_barrier = max(row_dict["elevation_m"] * np.sin(slope_rad), 50.0)
    N_buoyancy = 0.011
    froude = U_ms / max(N_buoyancy * H_barrier, 0.5)
    
    T_k = row_dict["temperature_c"] + 273.15
    e_act = 6.112 * np.exp((17.67 * row_dict["dew_point_c"]) / (row_dict["dew_point_c"] + 243.5))
    q = (0.622 * e_act) / (row_dict["surface_pressure_hpa"] - 0.378 * e_act)
    theta = T_k * (1000.0 / row_dict["surface_pressure_hpa"]) ** 0.286
    Lv, Cp = 2.501e6, 1004.0
    theta_e_k = theta * np.exp((Lv * q) / (Cp * T_k))
    
    valley_trapping_index = (theta_e_k / 330.0) * (1.0 / (froude + 0.1)) * np.sin(slope_rad)
    orographic_lift_ms = U_ms * np.sin(slope_rad)
    
    row_dict["theta_e_k"] = round(float(theta_e_k), 2)
    row_dict["valley_trapping_index"] = round(float(valley_trapping_index), 4)
    row_dict["orographic_lift_ms"] = round(float(orographic_lift_ms), 4)
    return row_dict

def predict_raw_probability(artifact, df_feat):
    if artifact.get("model_type") in ["dual_ensemble_blend", "physics_informed_dual_ensemble"]:
        w_lgb = artifact["blend_weights"]["lgb"]
        w_xgb = artifact["blend_weights"]["xgb"]
        p_lgb = artifact["model_lgb"].predict_proba(df_feat)[:, 1][0]
        p_xgb = artifact["model_xgb"].predict_proba(df_feat)[:, 1][0]
        return float(w_lgb * p_lgb + w_xgb * p_xgb)
    else:
        return float(artifact["model"].predict_proba(df_feat)[:, 1][0])

def fetch_forward_6h_trajectory(lat: float, lon: float, terrain: dict, artifact: dict):
    """
    Fetches the 6-hour forward hourly forecast from the operational NWP stream
    and computes the 6-Hour Convective Risk Trajectory and 6-hour barometric/moisture tendencies.
    """
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat:.4f}&longitude={lon:.4f}&"
        f"hourly=temperature_2m,dew_point_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,precipitation&"
        f"forecast_days=1&timezone=UTC"
    )
    try:
        data = fetch_with_retry(url)
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])[:6]
        temps = hourly.get("temperature_2m", [])[:6]
        dews = hourly.get("dew_point_2m", [])[:6]
        rhs = hourly.get("relative_humidity_2m", [])[:6]
        pressures = hourly.get("surface_pressure", [])[:6]
        winds = hourly.get("wind_speed_10m", [])[:6]
        precips = hourly.get("precipitation", [])[:6]
        
        trajectory = []
        features = artifact["features"]
        calibrator = artifact["calibrator"]
        thresholds = artifact["thresholds"]
        
        for i in range(min(len(times), 6)):
            row = {
                "elevation_m": terrain["elevation_m"],
                "slope_deg": terrain["slope_deg"],
                "aspect_deg": terrain["aspect_deg"],
                "temperature_c": temps[i],
                "dew_point_c": dews[i],
                "dew_point_depression_c": round(temps[i] - dews[i], 2),
                "relative_humidity_pct": int(rhs[i]),
                "surface_pressure_hpa": pressures[i],
                "wind_speed_kmh": winds[i]
            }
            row_phys = compute_physics_features(row)
            df_feat = pd.DataFrame([row_phys])[features]
            
            raw_p = predict_raw_probability(artifact, df_feat)
            cal_p = float(calibrator.predict_proba(np.array([[raw_p]]))[:, 1][0])
            cri = float(np.clip((cal_p - thresholds["baseline_prob"]) / (thresholds["ceiling_prob"] - thresholds["baseline_prob"]), 0.0, 1.0) * 100.0)
            
            tier = "RED_WARNING" if cal_p >= thresholds["warn_raw_prob"] else ("YELLOW_WATCH" if cal_p >= thresholds["watch_raw_prob"] else "GREEN_NORMAL")
            
            trajectory.append({
                "lead_hour": f"+{i+1}h",
                "time_utc": times[i] + "Z",
                "temperature_c": temps[i],
                "dew_point_c": dews[i],
                "surface_pressure_hpa": pressures[i],
                "wind_speed_kmh": winds[i],
                "rain_nowcast_mm": precips[i],
                "convective_risk_index_pct": round(cri, 1),
                "alert_tier": tier
            })
            
        # 6-Hour Tendency Metrics
        delta_p_6h = round(pressures[-1] - pressures[0], 1) if len(pressures) >= 6 else 0.0
        delta_dew_6h = round(dews[-1] - dews[0], 1) if len(dews) >= 6 else 0.0
        max_cri_6h = max([x["convective_risk_index_pct"] for x in trajectory]) if trajectory else 0.0
        
        return {
            "trajectory": trajectory,
            "tendency_6h": {
                "pressure_change_6h_hpa": delta_p_6h,
                "dewpoint_surge_6h_c": delta_dew_6h,
                "peak_risk_next_6h_pct": max_cri_6h
            }
        }
    except Exception as e:
        return {"trajectory": [], "error": str(e)}

def assess_live_risk(lat: float, lon: float, station_name: str = "Target Location", artifact=None):
    if artifact is None:
        artifact = load_scorer()
        
    calibrator = artifact["calibrator"]
    features = artifact["features"]
    thresholds = artifact["thresholds"]
    
    terrain = fetch_terrain_params(lat, lon)
    weather = fetch_live_weather(lat, lon)
    
    row_dict = {
        "elevation_m": terrain["elevation_m"],
        "slope_deg": terrain["slope_deg"],
        "aspect_deg": terrain["aspect_deg"],
        "temperature_c": weather["temperature_c"],
        "dew_point_c": weather["dew_point_c"],
        "dew_point_depression_c": weather["dew_point_depression_c"],
        "relative_humidity_pct": weather["relative_humidity_pct"],
        "surface_pressure_hpa": weather["surface_pressure_hpa"],
        "wind_speed_kmh": weather["wind_speed_kmh"]
    }
    
    row_dict = compute_physics_features(row_dict)
    df_feat = pd.DataFrame([row_dict])[features]
    
    raw_p = predict_raw_probability(artifact, df_feat)
    cal_p = float(calibrator.predict_proba(np.array([[raw_p]]))[:, 1][0])
    
    p_base = thresholds["baseline_prob"]
    p_ceil = thresholds["ceiling_prob"]
    cri = float(np.clip((cal_p - p_base) / (p_ceil - p_base), 0.0, 1.0) * 100.0)
    
    if cal_p >= thresholds["warn_raw_prob"]:
        tier = "RED_WARNING"
        tier_label = "HIGH CONVECTIVE WARNING"
        action = "Severe cloudburst trigger conditions detected. Evacuate ravines, dry stream beds, and unstable mountain slopes immediately."
    elif cal_p >= thresholds["watch_raw_prob"]:
        tier = "YELLOW_WATCH"
        tier_label = "CLOUDBURST WATCH"
        action = "Elevated moisture convergence and orographic forcing. Severe thunderstorm / localized flash flood possible within 1-3 hours."
    else:
        tier = "GREEN_NORMAL"
        tier_label = "NORMAL / LOW RISK"
        action = "Standard seasonal background conditions. No acute convective cloudburst danger."
        
    # Check if satellite confirmation/verification is available
    sat_score = None
    sat_verification = None
    
    # Check for local satellite grid file (e.g. Kedarnath or cached satellite grids)
    sat_file = os.path.join(BASE_DIR, "..", "data", "raw", "satellite_ir", "EVT_002_gridsat_ir.nc")
    if "kedarnath" in station_name.lower() and os.path.exists(sat_file):
        try:
            import xarray as xr
            from src.models.stage2_satellite_vision import extract_satellite_features, fuse_multimodal_advisory
            ds = xr.open_dataset(sat_file)
            grid = ds["irwin_cdr"].values[0]
            sat_features = extract_satellite_features(grid)
            sat_score = sat_features["satellite_convective_score"]
            sat_verification = {
                "min_cloud_top_temp_c": sat_features["tb_min_c"],
                "cloud_signature": sat_features["convective_signature"]
            }
        except Exception:
            pass
            
    # Ingest forward 6-hour trajectory
    forward_outlook = fetch_forward_6h_trajectory(lat, lon, terrain, artifact)
    
    result = {
        "station_name": station_name,
        "coordinates": {"lat": lat, "lon": lon},
        "observation_time_utc": weather["timestamp_utc"],
        "terrain": terrain,
        "live_weather": weather,
        "convective_risk_index_pct": round(cri, 1),
        "calibrated_probability": round(cal_p, 4),
        "satellite_verification": sat_verification,
        "forward_6h_outlook": forward_outlook,
        "advisory_tier": tier,
        "advisory_label": tier_label,
        "recommended_action": action
    }
    return result

def print_advisory_card(res: dict):
    print("=" * 65)
    print(f"  PAN-INDIA CLOUDBURST EARLY WARNING NOWCAST: {res['station_name'].upper()}")
    print("=" * 65)
    print(f"  Coordinates   : Lat {res['coordinates']['lat']:.4f}, Lon {res['coordinates']['lon']:.4f}")
    print(f"  Observation   : {res['observation_time_utc']}")
    print(f"  Terrain       : Elev {res['terrain']['elevation_m']}m | Slope {res['terrain']['slope_deg']} deg | Aspect {res['terrain']['aspect_deg']} deg")
    print(f"  Atmosphere    : Temp {res['live_weather']['temperature_c']} C | DewPt {res['live_weather']['dew_point_c']} C (Dep {res['live_weather']['dew_point_depression_c']} C)")
    print(f"                  RH {res['live_weather']['relative_humidity_pct']}% | Press {res['live_weather']['surface_pressure_hpa']} hPa | Wind {res['live_weather']['wind_speed_kmh']} km/h")
    print(f"                  Precip Nowcast: {res['live_weather']['current_precipitation_mm']} mm/hr")
    print("-" * 65)
    print(f"  CONVECTIVE RISK INDEX (CRI): {res['convective_risk_index_pct']}%")
    print(f"  OPERATIONAL STATUS         : {res['advisory_label']}")
    if res.get("satellite_verification"):
        sat = res["satellite_verification"]
        print(f"  STAGE 2 SATELLITE VISION   : Cloud Top Temp {sat['min_cloud_top_temp_c']} C ({sat['cloud_signature']})")
    print(f"  CIVIL ADVISORY             : {res['recommended_action']}")
    
    if res.get("forward_6h_outlook", {}).get("trajectory"):
        outlook = res["forward_6h_outlook"]
        tend = outlook.get("tendency_6h", {})
        print("-" * 65)
        print(f"  FORWARD 6-HOUR OUTLOOK     : Peak Risk Ahead: {tend.get('peak_risk_next_6h_pct', 0.0)}% | ΔP(6h): {tend.get('pressure_change_6h_hpa', 0.0)} hPa")
        for hr in outlook["trajectory"]:
            print(f"    {hr['lead_hour']} [{hr['time_utc']}]: CRI {hr['convective_risk_index_pct']:4.1f}% | {hr['alert_tier']:<14} | Temp {hr['temperature_c']}C | Rain {hr['rain_nowcast_mm']} mm")
    print("=" * 65 + "\n")

def main():
    parser = argparse.ArgumentParser(description="Live Real-Time Cloudburst Risk Inference")
    parser.add_argument("--lat", type=float, help="Latitude")
    parser.add_argument("--lon", type=float, help="Longitude")
    parser.add_argument("--name", type=str, default="Target Station", help="Station name")
    parser.add_argument("--scan", action="store_true", help="Run live multi-station scan across vulnerable zones")
    parser.add_argument("--json", action="store_true", help="Output pure JSON")
    args = parser.parse_args()
    
    artifact = load_scorer()
    
    if args.scan:
        print("\nScanning Vulnerable Pan-India High-Risk Stations Live...\n")
        results = []
        for st in MONITORING_NETWORK:
            res = assess_live_risk(st["lat"], st["lon"], st["name"], artifact)
            results.append(res)
            if not args.json:
                print_advisory_card(res)
        if args.json:
            print(json.dumps(results, indent=2))
    elif args.lat is not None and args.lon is not None:
        res = assess_live_risk(args.lat, args.lon, args.name, artifact)
        if args.json:
            print(json.dumps(res, indent=2))
        else:
            print_advisory_card(res)
    else:
        print("\nNo coordinates specified. Running default live test on Kedarnath Valley...\n")
        res = assess_live_risk(30.7346, 79.0669, "Kedarnath Valley", artifact)
        print_advisory_card(res)

if __name__ == "__main__":
    main()
