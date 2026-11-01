"""Feature extraction & plan builder:
Supports both the new Physics-Informed Dual Ensemble (12 physics & terrain features)
and legacy daily aggregates.
"""
from __future__ import annotations

import datetime as dt
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd

CALENDAR_FEATURES = ("month", "day_of_year", "year")
HOURS_GE_FEATURES = {"hours_ge_5mm": 5.0, "hours_ge_10mm": 10.0}
HOURS_GE_SOURCE = "precipitation"
AGG_SUFFIXES = {"_mean": "mean", "_min": "min", "_max": "max", "_sum": "sum"}

PHYSICS_FEATURES = {
    "elevation_m", "slope_deg", "aspect_deg", "temperature_c", "dew_point_c",
    "dew_point_depression_c", "relative_humidity_pct", "surface_pressure_hpa",
    "wind_speed_kmh", "theta_e_k", "valley_trapping_index", "orographic_lift_ms"
}

# feature -> (kind, hourly source variable, argument)
FeaturePlan = Dict[str, Tuple[str, Optional[str], object]]


def compute_physics_features(row_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Computes non-linear atmospheric physics: Froude number, theta_e,
    valley trapping index, and orographic lift."""
    row = dict(row_dict)
    u_ms = float(row.get("wind_speed_kmh") or 0.0) / 3.6
    slope_deg = float(row.get("slope_deg") or 0.0)
    slope_rad = np.radians(slope_deg)
    h_barrier = max(float(row.get("elevation_m") or 0.0) * np.sin(slope_rad), 50.0)
    n_buoyancy = 0.011
    froude = u_ms / max(n_buoyancy * h_barrier, 0.5)

    temp_c = float(row.get("temperature_c") if row.get("temperature_c") is not None else 15.0)
    dew_c = float(row.get("dew_point_c") if row.get("dew_point_c") is not None else 10.0)
    pres_hpa = max(float(row.get("surface_pressure_hpa") if row.get("surface_pressure_hpa") is not None else 900.0), 500.0)

    t_k = temp_c + 273.15
    e_act = 6.112 * np.exp((17.67 * dew_c) / (dew_c + 243.5))
    q = (0.622 * e_act) / max(pres_hpa - 0.378 * e_act, 10.0)
    theta = t_k * (1000.0 / pres_hpa) ** 0.286
    lv, cp = 2.501e6, 1004.0
    theta_e_k = theta * np.exp((lv * q) / (cp * t_k))

    valley_trapping = (theta_e_k / 330.0) * (1.0 / (froude + 0.1)) * np.sin(slope_rad)
    orographic_lift = u_ms * np.sin(slope_rad)

    row["dew_point_depression_c"] = round(temp_c - dew_c, 2)
    row["theta_e_k"] = round(float(theta_e_k), 2)
    row["valley_trapping_index"] = round(float(valley_trapping), 4)
    row["orographic_lift_ms"] = round(float(orographic_lift), 4)
    return row


def build_feature_plan(features: Iterable[str]) -> FeaturePlan:
    plan: FeaturePlan = {}
    for name in features:
        if name in PHYSICS_FEATURES:
            plan[name] = ("physics", None, None)
        elif name in CALENDAR_FEATURES:
            plan[name] = ("calendar", None, None)
        elif name in HOURS_GE_FEATURES:
            plan[name] = ("hours_ge", HOURS_GE_SOURCE, HOURS_GE_FEATURES[name])
        else:
            for suffix, agg in AGG_SUFFIXES.items():
                if name.endswith(suffix):
                    plan[name] = ("agg", name[: -len(suffix)], agg)
                    break
            else:
                raise ValueError(
                    f"Don't know how to compute feature '{name}'. "
                    "Add a rule in app/features.py."
                )
    return plan


def hourly_variables(plan: FeaturePlan) -> List[str]:
    """Open-Meteo hourly variables needed for the plan."""
    req = set()
    for name, (kind, src, _) in plan.items():
        if kind == "physics":
            req.update(["temperature_2m", "dew_point_2m", "relative_humidity_2m", "surface_pressure", "wind_speed_10m", "precipitation"])
        elif src:
            req.add(src)
    return sorted(req)


def compute_daily_features(
    hourly: Optional[pd.DataFrame],
    day: dt.date,
    plan: FeaturePlan,
    min_hours: int = 20,
    terrain: Optional[Dict[str, float]] = None,
) -> Dict[str, Optional[float]]:
    """Aggregate one local day of hourly data or compute current/physics features."""
    if hourly is None or hourly.empty:
        day_df = pd.DataFrame()
    else:
        idx = pd.DatetimeIndex(hourly.index)
        day_df = hourly.loc[idx.normalize() == pd.Timestamp(day)]

    out: Dict[str, Optional[float]] = {}
    is_physics = any(kind == "physics" for kind, _, _ in plan.values())

    if is_physics:
        terrain = terrain or {"elevation_m": 3549.0, "slope_deg": 6.37, "aspect_deg": 28.6}

        def get_stat(col: str) -> Optional[float]:
            if col not in day_df.columns:
                return None
            s = pd.to_numeric(day_df[col], errors="coerce").dropna()
            if len(s) < min_hours:
                return None
            return float(s.mean())

        t_val = get_stat("temperature_2m")
        dp_val = get_stat("dew_point_2m")
        rh_val = get_stat("relative_humidity_2m")
        sp_val = get_stat("surface_pressure")
        w_val = get_stat("wind_speed_10m")

        if any(v is None for v in [t_val, dp_val, rh_val, sp_val, w_val]):
            out = {f: None for f in plan}
            out["elevation_m"] = float(terrain.get("elevation_m", 1000.0))
            out["slope_deg"] = float(terrain.get("slope_deg", 5.0))
            out["aspect_deg"] = float(terrain.get("aspect_deg", 180.0))
            return out

        base_dict = {
            "elevation_m": terrain.get("elevation_m", 1000.0),
            "slope_deg": terrain.get("slope_deg", 5.0),
            "aspect_deg": terrain.get("aspect_deg", 180.0),
            "temperature_c": t_val,
            "dew_point_c": dp_val,
            "relative_humidity_pct": rh_val,
            "surface_pressure_hpa": sp_val,
            "wind_speed_kmh": w_val
        }
        phys_dict = compute_physics_features(base_dict)
        for name in plan:
            if name in phys_dict:
                out[name] = float(phys_dict[name])
            else:
                out[name] = None
        return out

    for name, (kind, src, arg) in plan.items():
        if kind == "calendar":
            out[name] = float(
                {"month": day.month, "day_of_year": day.timetuple().tm_yday, "year": day.year}[name]
            )
            continue

        if src not in day_df.columns:
            out[name] = None
            continue

        series = pd.to_numeric(day_df[src], errors="coerce").replace([np.inf, -np.inf], np.nan)
        if int(series.notna().sum()) < min_hours:
            out[name] = None
            continue

        if kind == "hours_ge":
            value = float((series >= float(arg)).sum())
        else:
            value = float(getattr(series, str(arg))())
        out[name] = None if np.isnan(value) else value
    return out
