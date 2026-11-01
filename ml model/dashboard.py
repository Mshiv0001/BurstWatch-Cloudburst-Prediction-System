"""
Interactive Cloudburst Early Warning & Prediction Dashboard
Built with Streamlit for civil defense, meteorologists, and field operators.
"""

import os
import sys
import numpy as np
import pandas as pd
import streamlit as st

# Setup paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.inference.live_feed_ingest import (
    load_scorer, assess_live_risk, fetch_terrain_params,
    MONITORING_NETWORK
)
from src.inference.advance_outlook_engine import evaluate_advance_outlook

# Page config
st.set_page_config(
    page_title="Pan-India Cloudburst Early Warning System",
    page_icon="🏔️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Load Model
@st.cache_resource
def get_model():
    return load_scorer()

artifact = get_model()

# Header
st.title("🏔️ Pan-India Cloudburst Early Warning System")
st.caption("Physics-Informed Dual-Engine Ensemble (LightGBM + XGBoost) with 3-6 Hour Advance Outlook")

# Sidebar
st.sidebar.title("Operational Controls")
mode = st.sidebar.radio(
    "Navigation Mode",
    ["📡 Live Station Risk Monitor", "⏱️ 3-6h Advance Convective Outlook", "🏛️ Historical Disaster Replay", "🧪 Interactive Custom Simulation"]
)

# Pre-defined station catalog
STATION_CHOICES = {st["name"]: st for st in MONITORING_NETWORK}
STATION_CHOICES["Custom Coordinates"] = None

# Tab 1: Live Station Risk Monitor
if mode == "📡 Live Station Risk Monitor":
    st.subheader("Live Operational Station Surveillance")
    
    col1, col2 = st.columns([1, 2])
    with col1:
        selected_station = st.selectbox("Select Station / Monitoring Basin", list(STATION_CHOICES.keys()))
        
        if selected_station == "Custom Coordinates":
            lat = st.number_input("Latitude (°N)", value=30.7346, format="%.4f")
            lon = st.number_input("Longitude (°E)", value=79.0669, format="%.4f")
            station_name = st.text_input("Location Name", value="Custom Target")
        else:
            info = STATION_CHOICES[selected_station]
            lat = info["lat"]
            lon = info["lon"]
            station_name = info["name"]
            st.info(f"**State / Region:** {info['state']}\n\n**Coordinates:** {lat:.4f}°N, {lon:.4f}°E")
        
        run_btn = st.button("🔄 Evaluate Live Risk", type="primary", use_container_width=True)

    with col2:
        if run_btn or selected_station:
            with st.spinner("Analyzing real-time atmospheric stream & 30m DEM terrain..."):
                res = assess_live_risk(lat, lon, station_name, artifact)
            
            cri = res["convective_risk_index_cri"]
            cal_prob = res["calibrated_cloudburst_prob"]
            tier = res["early_warning_tier"]
            color = res["advisory_color"]
            
            # Metric row
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Convective Risk (CRI)", f"{cri:.1f}%")
            m2.metric("Calibrated Probability", f"{cal_prob:.1f}%")
            m3.metric("Elevation", f"{res['elevation_m']} m")
            m4.metric("Terrain Slope", f"{res['slope_deg']}°")
            
            # Advisory Card
            if color == "RED":
                st.error(f"### 🔴 {tier}\n**Civil Action:** {res['civil_action_advisory']}")
            elif color == "YELLOW":
                st.warning(f"### 🟡 {tier}\n**Civil Action:** {res['civil_action_advisory']}")
            else:
                st.success(f"### 🟢 {tier}\n**Civil Action:** {res['civil_action_advisory']}")
            
            # Physical diagnostics
            st.markdown("#### Atmospheric & Orographic Physics Diagnostics")
            d1, d2, d3, d4 = st.columns(4)
            d1.metric("Temp / Dewpoint", f"{res['temperature_c']}°C / {res['dew_point_c']}°C")
            d2.metric("Dewpoint Dep.", f"{res['dew_point_depression_c']}°C")
            d3.metric("Surface Pressure", f"{res['surface_pressure_hpa']} hPa")
            d4.metric("Moist Energy (θe)", f"{res['theta_e_k']} K")

    # Map of all monitoring network stations
    st.markdown("---")
    st.markdown("#### Pan-India Active Monitoring Network")
    df_net = pd.DataFrame(MONITORING_NETWORK)
    st.map(df_net, latitude="lat", longitude="lon", size=25, zoom=4)

# Tab 2: 3-6h Advance Outlook
elif mode == "⏱️ 3-6h Advance Convective Outlook":
    st.subheader("Medium-Range (3 to 6-Hour) Convective Tendency & IVT Outlook")
    st.markdown("Forecasts moisture convergence and barometric troughs hours before clouds reach peak convective height.")
    
    col1, col2 = st.columns([1, 2])
    with col1:
        st_name = st.selectbox("Select Target Valley", [s["name"] for s in MONITORING_NETWORK])
        st_info = [s for s in MONITORING_NETWORK if s["name"] == st_name][0]
        terrain = fetch_terrain_params(st_info["lat"], st_info["lon"])
        
        st.write(f"**Elevation:** {terrain['elevation_m']} m")
        st.write(f"**Slope:** {terrain['slope_deg']}°")
        
        # Scenario toggle
        scenario = st.radio("Simulation Scenario", ["Current Real-Time NWP Trend", "Approaching Monsoon Trough (+3-6h Surge)"])
        
    with col2:
        if scenario == "Approaching Monsoon Trough (+3-6h Surge)":
            sample_seq = [
                {"time_utc": "T+1h", "temperature_c": 21.0, "dew_point_c": 17.0, "surface_pressure_hpa": 745.0, "wind_speed_kmh": 12.0, "rain_mm": 0.0},
                {"time_utc": "T+2h", "temperature_c": 21.5, "dew_point_c": 18.5, "surface_pressure_hpa": 743.0, "wind_speed_kmh": 18.0, "rain_mm": 1.0},
                {"time_utc": "T+3h", "temperature_c": 21.8, "dew_point_c": 20.0, "surface_pressure_hpa": 741.0, "wind_speed_kmh": 26.0, "rain_mm": 5.0},
                {"time_utc": "T+4h", "temperature_c": 21.0, "dew_point_c": 20.5, "surface_pressure_hpa": 738.5, "wind_speed_kmh": 34.0, "rain_mm": 18.0},
                {"time_utc": "T+5h", "temperature_c": 20.2, "dew_point_c": 20.1, "surface_pressure_hpa": 736.0, "wind_speed_kmh": 42.0, "rain_mm": 35.0},
                {"time_utc": "T+6h", "temperature_c": 19.5, "dew_point_c": 19.5, "surface_pressure_hpa": 734.0, "wind_speed_kmh": 48.0, "rain_mm": 80.0},
            ]
        else:
            # Gentle baseline
            sample_seq = [
                {"time_utc": f"T+{i+1}h", "temperature_c": 18.0 + i*0.5, "dew_point_c": 10.0 + i*0.2, "surface_pressure_hpa": 750.0 - i*0.2, "wind_speed_kmh": 8.0, "rain_mm": 0.0}
                for i in range(6)
            ]
            
        outlook = evaluate_advance_outlook(sample_seq, terrain)
        
        o1, o2, o3 = st.columns(3)
        o1.metric("6h Pressure Tendency", f"{outlook['delta_p_6h']} hPa")
        o2.metric("6h Dewpoint Surge", f"{outlook['delta_td_6h']} °C")
        o3.metric("Peak Moisture Flux (IVT)", f"{outlook['peak_ivt']} kg/(m·s)")
        
        st.markdown(f"**Confidence Rating:** `{outlook['confidence_rating']}`")
        st.markdown(f"**Synopsis:** {outlook['synopsis']}")
        st.info(f"**Civil Action Preparedness:** {outlook['civil_preparedness_action']}")
        
        # Hourly table
        df_traj = pd.DataFrame(outlook["hourly_trajectory"])
        st.dataframe(df_traj[["lead_hour", "temp_c", "dew_c", "press_hpa", "ivt_kg_ms", "theta_e_k", "acpi_risk_pct", "tier"]], use_container_width=True)

# Tab 3: Historical Disaster Replay
elif mode == "🏛️ Historical Disaster Replay":
    st.subheader("Historical Landmark Cloudburst Disasters (Verification Suite)")
    
    HISTORICAL_CASES = {
        "Kedarnath Valley Disaster (June 2013)": {
            "elev": 3549.0, "slope": 28.5, "aspect": 185.0, "temp": 20.0, "dew": 19.5, "p": 653.6, "wind": 28.0, "rain": 95.0,
            "desc": "Catastrophic breach and debris flow in Mandakini valley."
        },
        "Amarnath Cave Disaster (July 2022)": {
            "elev": 3894.0, "slope": 32.0, "aspect": 190.0, "temp": 20.0, "dew": 19.1, "p": 625.0, "wind": 30.0, "rain": 72.0,
            "desc": "Intense localized cloudburst above the cave shrines."
        },
        "Dharamshala Bhagsunag Burst (July 2021)": {
            "elev": 2557.0, "slope": 24.0, "aspect": 210.0, "temp": 20.0, "dew": 19.9, "p": 741.5, "wind": 25.0, "rain": 85.0,
            "desc": "Sudden orographic burst washing away parked vehicles."
        },
        "Dehradun Maldeota Burst (August 2022)": {
            "elev": 861.0, "slope": 14.5, "aspect": 170.0, "temp": 20.0, "dew": 19.9, "p": 914.0, "wind": 22.0, "rain": 90.0,
            "desc": "Foothills flash flood and bridge collapse."
        },
        "Shimla Heavy Monsoon (Non-Burst Control)": {
            "elev": 1930.0, "slope": 18.0, "aspect": 180.0, "temp": 20.0, "dew": 16.1, "p": 801.9, "wind": 12.0, "rain": 25.0,
            "desc": "Continuous heavy rainfall without convective cloudburst."
        }
    }
    
    selected_case = st.selectbox("Select Historical Event", list(HISTORICAL_CASES.keys()))
    case_data = HISTORICAL_CASES[selected_case]
    st.write(f"*{case_data['desc']}*")
    
    from src.inference.live_feed_ingest import compute_physics_features, predict_raw_probability
    
    row = {
        "elevation_m": case_data["elev"],
        "slope_deg": case_data["slope"],
        "aspect_deg": case_data["aspect"],
        "temperature_c": case_data["temp"],
        "dew_point_c": case_data["dew"],
        "dew_point_depression_c": case_data["temp"] - case_data["dew"],
        "relative_humidity_pct": 98 if case_data["temp"] - case_data["dew"] < 1.0 else 80,
        "surface_pressure_hpa": case_data["p"],
        "wind_speed_kmh": case_data["wind"],
        "precipitation_mm": case_data["rain"],
        "moisture_flux_proxy": (case_data["dew"] + 20.0) * case_data["wind"],
        "convective_froude_number": (case_data["wind"] / 3.6) / max(0.011 * case_data["elev"] * np.sin(np.radians(case_data["slope"])), 0.5)
    }
    row = compute_physics_features(row)
    df_feat = pd.DataFrame([row])[artifact["features"]]
    p_raw = predict_raw_probability(artifact, df_feat)
    p_cal = float(artifact["calibrator"].predict_proba(np.array([[p_raw]]))[:, 1][0])
    cri = float(np.clip((p_cal - 0.05) / (0.40 - 0.05) * 100.0, 0.0, 100.0))
    
    r1, r2, r3 = st.columns(3)
    r1.metric("Predicted CRI Risk", f"{cri:.1f}%")
    r2.metric("Calibrated Prob.", f"{p_cal*100:.1f}%")
    if cri >= 66.0:
        r3.error("🔴 RED: HIGH CONVECTIVE WARNING")
    elif cri >= 31.0:
        r3.warning("🟡 YELLOW: CLOUDBURST WATCH")
    else:
        r3.success("🟢 GREEN: NORMAL MONSOON")

# Tab 4: Interactive Custom Simulation
elif mode == "🧪 Interactive Custom Simulation":
    st.subheader("Interactive Convective Parameter Simulator")
    st.markdown("Adjust meteorological and topographical sliders to test the model's physics engine.")
    
    c1, c2, c3 = st.columns(3)
    with c1:
        s_elev = st.slider("Elevation (m)", 0, 4500, 2200, 50)
        s_slope = st.slider("Terrain Slope (°)", 0.0, 45.0, 18.0, 0.5)
        s_wind = st.slider("Wind Speed (km/h)", 0.0, 80.0, 24.0, 1.0)
    with c2:
        s_temp = st.slider("Temperature (°C)", 5.0, 45.0, 22.0, 0.5)
        s_dew = st.slider("Dew Point (°C)", 0.0, 35.0, 21.0, 0.5)
        s_dep = max(round(s_temp - s_dew, 1), 0.0)
        st.write(f"Dew Point Depression: **{s_dep}°C**")
    with c3:
        s_press = st.slider("Surface Pressure (hPa)", 550.0, 1020.0, 780.0, 5.0)
        s_rain = st.slider("1-Hour Rain (mm)", 0.0, 120.0, 15.0, 1.0)

    from src.inference.live_feed_ingest import compute_physics_features, predict_raw_probability
    sim_row = {
        "elevation_m": float(s_elev),
        "slope_deg": float(s_slope),
        "aspect_deg": 180.0,
        "temperature_c": float(s_temp),
        "dew_point_c": float(s_dew),
        "dew_point_depression_c": float(s_dep),
        "relative_humidity_pct": int(100 - (s_dep * 5)),
        "surface_pressure_hpa": float(s_press),
        "wind_speed_kmh": float(s_wind),
        "precipitation_mm": float(s_rain),
        "moisture_flux_proxy": (s_dew + 20.0) * s_wind,
        "convective_froude_number": (s_wind / 3.6) / max(0.011 * s_elev * np.sin(np.radians(s_slope)), 0.5)
    }
    sim_row = compute_physics_features(sim_row)
    df_feat = pd.DataFrame([sim_row])[artifact["features"]]
    p_raw = predict_raw_probability(artifact, df_feat)
    p_cal = float(artifact["calibrator"].predict_proba(np.array([[p_raw]]))[:, 1][0])
    cri = float(np.clip((p_cal - 0.05) / (0.40 - 0.05) * 100.0, 0.0, 100.0))
    
    st.markdown("---")
    res_c1, res_c2, res_c3 = st.columns(3)
    res_c1.metric("Simulated CRI Score", f"{cri:.1f}%")
    res_c2.metric("Calibrated Probability", f"{p_cal*100:.1f}%")
    res_c3.metric("Valley Trapping Index (VTI)", f"{sim_row['valley_trapping_index']:.3f}")
    
    if cri >= 66.0:
        st.error("### 🔴 Alert Tier: RED (HIGH CONVECTIVE WARNING)\nConditions indicate extreme localized moisture trapping and catastrophic bursting potential.")
    elif cri >= 31.0:
        st.warning("### 🟡 Alert Tier: YELLOW (CLOUDBURST WATCH)\nModerate convective instability detected. Monitor mountain stream flow and radar.")
    else:
        st.success("### 🟢 Alert Tier: GREEN (NORMAL MONSOON / LOW RISK)\nAtmosphere is stable or moisture depression is too wide for severe bursting.")

