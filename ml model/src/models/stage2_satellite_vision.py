"""
Stage 2 Multi-Modal Satellite IR Cloud Vision Module
Processes 2D Thermal Infrared (11 um) Brightness Temperature grids (e.g., NOAA GridSat-B1 / INSAT-3D)
to detect rapid overshooting cloud tops, deep convective cores (< -50 C), and cold anvil cloud expansion.
Fuses Stage 1 (Thermodynamic & Flow-Blocking Engine) with Stage 2 (Satellite Vision) for unified risk assessment.
"""

import os
import sys
import numpy as np
import pandas as pd

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def extract_satellite_features(ir_grid_kelvin: np.ndarray) -> dict:
    """
    Extracts spatial convective morphological features from a 2D 11 um Thermal IR grid.
    Grid is typically a 15x15 box (~0.5 deg x 0.5 deg, ~50km x 50km centered on the station).
    """
    grid = np.array(ir_grid_kelvin, dtype=np.float32)
    # Mask out invalid/missing values (e.g. out of range or NaN)
    valid_mask = ~np.isnan(grid) & (grid > 150.0) & (grid < 350.0)
    
    if not np.any(valid_mask):
        return {
            "tb_min_c": 15.0,
            "tb_mean_c": 20.0,
            "cold_cloud_fraction_40c": 0.0,
            "deep_core_fraction_55c": 0.0,
            "spatial_gradient_k": 0.0,
            "satellite_convective_score": 0.0,
            "convective_signature": "NO_DATA_OR_CLEAR"
        }
        
    valid_pixels = grid[valid_mask]
    tb_min_k = float(np.min(valid_pixels))
    tb_min_c = tb_min_k - 273.15
    tb_mean_c = float(np.mean(valid_pixels)) - 273.15
    
    # 1. Cold Cloud Fraction (< -40 C / 233.15 K - High Cumulonimbus Anvil)
    ccf_40 = float(np.mean(valid_pixels < 233.15))
    
    # 2. Deep Convective Core Fraction (< -55 C / 218.15 K - Severe Updraft Penetration)
    dccf_55 = float(np.mean(valid_pixels < 218.15))
    
    # 3. Spatial Gradient of Brightness Temperature (Storm Edge Shear)
    # Filled grid for gradient
    filled_grid = np.where(valid_mask, grid, np.nanmean(valid_pixels))
    gy, gx = np.gradient(filled_grid)
    grad_mag = np.sqrt(gx**2 + gy**2)
    mean_grad = float(np.nanmean(grad_mag))
    
    # 4. Satellite Convective Intensity Score (0 to 100%)
    # Climatological scoring:
    # Tb_min < -60 C -> 100% convective intensity
    # Tb_min > -15 C -> 0% convective intensity
    if tb_min_c <= -60.0:
        base_score = 1.0
    elif tb_min_c >= -15.0:
        base_score = 0.0
    else:
        # Linear scale from -15 C (0.0) to -60 C (1.0)
        base_score = (-15.0 - tb_min_c) / 45.0
        
    # Area coverage boost
    area_boost = min(ccf_40 * 1.5, 0.4)
    core_boost = min(dccf_55 * 2.5, 0.4)
    sat_score = float(np.clip(base_score * 0.7 + area_boost + core_boost, 0.0, 1.0) * 100.0)
    
    # Signature classification
    if tb_min_c <= -50.0 and ccf_40 >= 0.15:
        signature = "SEVERE_OVERSHOOTING_CUMULONIMBUS"
    elif tb_min_c <= -40.0:
        signature = "ACTIVE_CONVECTIVE_CELL"
    elif tb_min_c <= -20.0:
        signature = "MODERATE_STRATIFORM_OR_MID_CLOUD"
    else:
        signature = "WARM_LOW_CLOUD_OR_CLEAR"
        
    return {
        "tb_min_c": round(tb_min_c, 2),
        "tb_mean_c": round(tb_mean_c, 2),
        "cold_cloud_fraction_40c": round(ccf_40, 3),
        "deep_core_fraction_55c": round(dccf_55, 3),
        "spatial_gradient_k": round(mean_grad, 2),
        "satellite_convective_score": round(sat_score, 1),
        "convective_signature": signature
    }

def fuse_multimodal_advisory(stage1_result: dict, stage2_satellite: dict) -> dict:
    """
    Fuses Stage 1 (Thermodynamics + Froude flow-blocking) with Stage 2 (Satellite 11 um IR Vision).
    Implements physics-informed verification rules:
    - If Stage 1 Watch + Stage 2 Severe Overshooting Cloud -> Escalate to RED SEVERE WARNING.
    - If Stage 1 Warning + Stage 2 Confirmed Clear/Warm Skies -> Suppress to GREEN / YELLOW WATCH (eliminates false alarm).
    - If Stage 1 & 2 align -> Maximum confidence alert.
    """
    cri_thermo = stage1_result.get("convective_risk_index_pct", 0.0)
    sat_score = stage2_satellite.get("satellite_convective_score", 0.0)
    tb_min = stage2_satellite.get("tb_min_c", 20.0)
    sig = stage2_satellite.get("convective_signature", "WARM_LOW_CLOUD_OR_CLEAR")
    
    # Weighted fusion score: 55% Stage 1 (Precursor Physics) + 45% Stage 2 (Real-Time Cloud Vision)
    fused_risk = 0.55 * cri_thermo + 0.45 * sat_score
    
    # Rule 1: High Conv Updraft Confirmation
    if tb_min <= -48.0 and cri_thermo >= 30.0:
        fused_risk = max(fused_risk, 85.0)
        fusion_note = "CONFIRMED: Satellite verifies extreme overshooting cumulonimbus atop unstable mountain valley."
        tier = "RED_WARNING"
        tier_label = "HIGH CONVECTIVE WARNING (SATELLITE CONFIRMED)"
    # Rule 2: False Alarm Suppression (Clear / Warm Cloud top)
    elif tb_min >= -10.0 and cri_thermo >= 40.0:
        fused_risk = min(fused_risk, 25.0)
        fusion_note = "FALSE ALARM SUPPRESSED: Surface moisture elevated, but satellite verifies warm/clear skies with zero deep convective clouds."
        tier = "GREEN_NORMAL"
        tier_label = "NORMAL (SATELLITE VERIFIED NO CLOUD TOPS)"
    # Default tiered rules
    elif fused_risk >= 65.0:
        tier = "RED_WARNING"
        tier_label = "HIGH CONVECTIVE WARNING"
        fusion_note = "Severe convective trigger conditions supported by atmospheric state and cloud structure."
    elif fused_risk >= 30.0:
        tier = "YELLOW_WATCH"
        tier_label = "CLOUDBURST WATCH"
        fusion_note = "Elevated moisture convergence and convective cell expansion."
    else:
        tier = "GREEN_NORMAL"
        tier_label = "NORMAL / LOW RISK"
        fusion_note = "Standard seasonal conditions. No convective threat detected."
        
    fused_result = {
        "station_name": stage1_result.get("station_name", "Target"),
        "coordinates": stage1_result.get("coordinates", {}),
        "stage1_thermodynamic_cri": cri_thermo,
        "stage2_satellite_convective_score": sat_score,
        "fused_risk_index_pct": round(fused_risk, 1),
        "advisory_tier": tier,
        "advisory_label": tier_label,
        "satellite_verification": {
            "min_cloud_top_temp_c": tb_min,
            "cold_cloud_fraction": stage2_satellite.get("cold_cloud_fraction_40c", 0.0),
            "cloud_signature": sig
        },
        "meteorological_reasoning": fusion_note
    }
    return fused_result

if __name__ == "__main__":
    import xarray as xr
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sample_nc = os.path.join(base_dir, "data", "raw", "satellite_ir", "EVT_002_gridsat_ir.nc")
    
    if os.path.exists(sample_nc):
        ds = xr.open_dataset(sample_nc)
        grid = ds["irwin_cdr"].values[0]
        sat_feat = extract_satellite_features(grid)
        print("\n--- Tested on Kedarnath 2013 Cloudburst Satellite Grid ---")
        for k, v in sat_feat.items():
            print(f"  {k:30s}: {v}")
            
        dummy_stage1 = {
            "station_name": "Kedarnath Valley",
            "coordinates": {"lat": 30.7346, "lon": 79.0669},
            "convective_risk_index_pct": 95.0
        }
        fused = fuse_multimodal_advisory(dummy_stage1, sat_feat)
        print("\n--- Fused Multi-Modal Decision Output ---")
        for k, v in fused.items():
            print(f"  {k:30s}: {v}")

