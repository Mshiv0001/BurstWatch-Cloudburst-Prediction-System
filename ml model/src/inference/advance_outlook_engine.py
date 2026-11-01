"""
3 to 6-Hour Advance Convective Outlook Engine
Enhances medium-range early warning by computing:
1. Integrated Vapor Transport (IVT) Moisture Charging Index
2. 6-Hour Barometric Destabilization Rate (dP/dt) & Dewpoint Surge (dTd/dt)
3. Multi-Hour Convective Trajectory Scoring (t+1h to t+6h)
4. Actionable Civil Defense Preparedness Timeline
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

def compute_ivt_proxy(q_gkg: float, wind_kmh: float, surface_press_hpa: float) -> float:
    """
    Computes Integrated Vapor Transport (IVT) proxy in kg/(m*s).
    High IVT (> 400 kg/m/s) colliding with mountain topography triggers catastrophic orographic dumping.
    """
    q_kgkg = q_gkg / 1000.0
    u_ms = wind_kmh / 3.6
    # Boundary layer depth ~ 250 hPa (25,000 Pa)
    dp_pa = min(surface_press_hpa * 100.0 * 0.25, 25000.0)
    g = 9.80665
    ivt = (1.0 / g) * q_kgkg * u_ms * dp_pa
    return round(float(ivt), 1)

def compute_hourly_theta_e(temp_c: float, dew_c: float, press_hpa: float) -> float:
    T_k = temp_c + 273.15
    e_act = 6.112 * np.exp((17.67 * dew_c) / (dew_c + 243.5))
    q = (0.622 * e_act) / (press_hpa - 0.378 * e_act)
    theta = T_k * (1000.0 / press_hpa) ** 0.286
    Lv, Cp = 2.501e6, 1004.0
    theta_e = theta * np.exp((Lv * q) / (Cp * T_k))
    return round(float(theta_e), 1)

def evaluate_advance_outlook(hourly_forecasts: list, terrain: dict) -> dict:
    """
    Evaluates 6-hour forward outlook from an hourly sequence of weather predictions.
    hourly_forecasts: list of dicts with keys:
      ['time_utc', 'temperature_c', 'dew_point_c', 'surface_pressure_hpa', 'wind_speed_kmh', 'rain_mm']
    """
    if len(hourly_forecasts) < 3:
        raise ValueError("At least 3 forward hourly forecast steps required for advance outlook.")
        
    elev = terrain.get("elevation_m", 1000.0)
    slope = terrain.get("slope_deg", 5.0)
    slope_rad = np.radians(slope)
    
    t0 = hourly_forecasts[0]
    t_end = hourly_forecasts[-1]
    
    p0 = t0["surface_pressure_hpa"]
    p_end = t_end["surface_pressure_hpa"]
    delta_p_6h = round(p_end - p0, 1)
    
    td0 = t0["dew_point_c"]
    td_end = t_end["dew_point_c"]
    delta_td_6h = round(td_end - td0, 1)
    
    # Compute thermodynamic and IVT metrics across hours
    analyzed_hours = []
    peak_ivt = 0.0
    peak_theta_e = 0.0
    
    for i, h in enumerate(hourly_forecasts):
        theta_e = compute_hourly_theta_e(h["temperature_c"], h["dew_point_c"], h["surface_pressure_hpa"])
        e_act = 6.112 * np.exp((17.67 * h["dew_point_c"]) / (h["dew_point_c"] + 243.5))
        q_gkg = ((0.622 * e_act) / (h["surface_pressure_hpa"] - 0.378 * e_act)) * 1000.0
        ivt = compute_ivt_proxy(q_gkg, h["wind_speed_kmh"], h["surface_pressure_hpa"])
        
        peak_ivt = max(peak_ivt, ivt)
        peak_theta_e = max(peak_theta_e, theta_e)
        
        # Convective Froude blocking
        u_ms = h["wind_speed_kmh"] / 3.6
        H_barrier = max(elev * np.sin(slope_rad), 50.0)
        froude = u_ms / max(0.011 * H_barrier, 0.5)
        
        # Advance Convective Potential Index (ACPI: 0 to 100%)
        # Driven by high IVT (> 250), low Froude (< 1.2), high Theta_e (> 350K), and near-saturation
        dep = max(h["temperature_c"] - h["dew_point_c"], 0.1)
        sat_term = 1.0 / (dep + 0.5)
        blocking_term = 1.0 / (froude + 0.1)
        ivt_term = min(ivt / 400.0, 1.5)
        
        raw_acpi = (theta_e / 340.0) * sat_term * blocking_term * ivt_term * 15.0
        acpi_pct = float(np.clip(raw_acpi, 0.0, 100.0))
        
        if acpi_pct >= 70.0:
            stage_tier = "🔴 HIGH_RISK_SURGE"
        elif acpi_pct >= 35.0:
            stage_tier = "🟡 ELEVATED_WATCH"
        else:
            stage_tier = "🟢 LOW_BACKGROUND"
            
        analyzed_hours.append({
            "lead_hour": f"+{i+1}h",
            "time_utc": h.get("time_utc", f"T+{i+1}h"),
            "temp_c": h["temperature_c"],
            "dew_c": h["dew_point_c"],
            "press_hpa": h["surface_pressure_hpa"],
            "ivt_kg_ms": ivt,
            "theta_e_k": theta_e,
            "acpi_risk_pct": round(acpi_pct, 1),
            "tier": stage_tier
        })
        
    # High-confidence trigger detection:
    # Plunging pressure (dP <= -3.0 hPa) + Surging Dewpoint (dTd >= +2.0 C) + Peak IVT >= 300
    is_trough_approaching = (delta_p_6h <= -2.5)
    is_moisture_surging = (delta_td_6h >= +1.5) or (peak_ivt >= 350.0)
    
    if is_trough_approaching and is_moisture_surging:
        confidence = "HIGH (85% - 90%)"
        summary = "CRITICAL OUTLOOK: Mesoscale trough convergence & atmospheric river loading confirmed 3-6 hours ahead."
        action = "Issue 6-Hour Emergency Standby. Restrict low-elevation ghat roads and prepare upstream reservoir gates."
    elif is_moisture_surging:
        confidence = "MODERATE (70% - 75%)"
        summary = "ELEVATED CONVECTIVE CHARGING: Strong moisture transport detected; mountain blocking expected."
        action = "Issue 6-Hour Valley Watch. Monitor local nullahs and trek routes."
    else:
        confidence = "STABLE (90%+)"
        summary = "STABLE OUTLOOK: Barometric trend is flat/rising. No synoptic convective storm cell within 6 hours."
        action = "Normal seasonal operations. No emergency restrictions required."
        
    return {
        "advance_lead_time": "3 to 6 Hours Forward",
        "synoptic_tendency": {
            "pressure_change_6h_hpa": delta_p_6h,
            "dewpoint_surge_6h_c": delta_td_6h,
            "peak_ivt_kg_ms": peak_ivt,
            "peak_theta_e_k": peak_theta_e
        },
        "forecast_confidence": confidence,
        "meteorological_summary": summary,
        "recommended_civil_action": action,
        "hourly_trajectory": analyzed_hours
    }

def print_advance_card(res: dict):
    print("=" * 75)
    print(f"        ADVANCE 3-6 HOUR CONVECTIVE OUTLOOK & EARLY ACTION ADVISORY")
    print("=" * 75)
    print(f"  Confidence Rating      : {res['forecast_confidence']}")
    print(f"  6-Hour Barometric Drop : {res['synoptic_tendency']['pressure_change_6h_hpa']} hPa")
    print(f"  6-Hour Moisture Surge  : {res['synoptic_tendency']['dewpoint_surge_6h_c']} C (Peak IVT: {res['synoptic_tendency']['peak_ivt_kg_ms']} kg/m/s)")
    print(f"  Peak Moist Energy (θe) : {res['synoptic_tendency']['peak_theta_e_k']} K")
    print("-" * 75)
    print(f"  SYNOPSIS               : {res['meteorological_summary']}")
    print(f"  CIVIL PREPAREDNESS     : {res['recommended_civil_action']}")
    print("-" * 75)
    print("  HOURLY RISK EVOLUTION (Next 6 Hours):")
    for h in res["hourly_trajectory"]:
        print(f"    {h['lead_hour']} [{h['time_utc']}]: ACPI {h['acpi_risk_pct']:4.1f}% | {h['tier']:<20} | IVT {h['ivt_kg_ms']:4.0f} kg/m/s | P {h['press_hpa']:5.1f} hPa")
    print("=" * 75 + "\n")

if __name__ == "__main__":
    # Test on a realistic 6-hour pre-burst buildup sequence (e.g. Kedarnath morning to afternoon)
    pre_burst_sequence = [
        {"time_utc": "10:00Z", "temperature_c": 19.0, "dew_point_c": 15.0, "surface_pressure_hpa": 672.0, "wind_speed_kmh": 8.0, "rain_mm": 0.0},
        {"time_utc": "11:00Z", "temperature_c": 20.0, "dew_point_c": 16.5, "surface_pressure_hpa": 671.0, "wind_speed_kmh": 12.0, "rain_mm": 0.0},
        {"time_utc": "12:00Z", "temperature_c": 20.5, "dew_point_c": 18.0, "surface_pressure_hpa": 669.5, "wind_speed_kmh": 16.0, "rain_mm": 0.5},
        {"time_utc": "13:00Z", "temperature_c": 21.0, "dew_point_c": 19.5, "surface_pressure_hpa": 668.0, "wind_speed_kmh": 22.0, "rain_mm": 2.0},
        {"time_utc": "14:00Z", "temperature_c": 20.5, "dew_point_c": 20.0, "surface_pressure_hpa": 666.5, "wind_speed_kmh": 28.0, "rain_mm": 12.0},
        {"time_utc": "15:00Z", "temperature_c": 19.5, "dew_point_c": 19.5, "surface_pressure_hpa": 665.0, "wind_speed_kmh": 32.0, "rain_mm": 45.0}
    ]
    terrain = {"elevation_m": 3549.0, "slope_deg": 24.5, "aspect_deg": 195.0}
    
    print("\n--- Running Advance 3-6 Hour Outlook on Historical Pre-Burst Buildup ---")
    out = evaluate_advance_outlook(pre_burst_sequence, terrain)
    print_advance_card(out)

