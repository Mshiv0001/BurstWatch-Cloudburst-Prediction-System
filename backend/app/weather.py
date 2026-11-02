"""Open-Meteo client: downloads weather & terrain data."""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import requests

from .config import Settings

logger = logging.getLogger(__name__)

ARCHIVE_LAG_DAYS = 5


class WeatherError(RuntimeError):
    """Weather provider unreachable or returned unusable data."""


class OpenMeteoClient:
    def __init__(self, settings: Settings, variables: List[str],
                 session: Optional[requests.Session] = None, sleep=time.sleep):
        self.s = settings
        self.variables = list(variables)
        self.session = session or requests.Session()
        self.session.headers.update({
            "User-Agent": "BurstWatch-Cloudburst-Engine/2.5 (+https://burstwatch-cloudburst-prediction.vercel.app)",
            "Accept": "application/json",
        })
        self._sleep = sleep
        self._terrain_cache_path = Path(self.s.db_path).parent / "cache" / "terrain_cache.json"

    def choose_source(self, day: dt.date, source: str, today: dt.date) -> str:
        if source in ("forecast", "archive"):
            return source
        return "forecast" if day >= today - dt.timedelta(days=ARCHIVE_LAG_DAYS) else "archive"

    def fetch_terrain_params(self, lat: float, lon: float) -> Dict[str, float]:
        """Retrieves 30m DEM terrain parameters (elevation, slope, aspect) with disk caching."""
        cache = {}
        if self._terrain_cache_path.exists():
            try:
                cache = json.loads(self._terrain_cache_path.read_text(encoding="utf-8"))
            except Exception:
                cache = {}

        key = f"{lat:.4f}_{lon:.4f}"
        if key in cache:
            return cache[key]

        d_lat = 0.001
        d_lon = 0.001
        lats = [lat, lat + d_lat, lat - d_lat, lat, lat]
        lons = [lon, lon, lon, lon + d_lon, lon - d_lon]

        url = "https://api.open-meteo.com/v1/elevation"
        params = {"latitude": ",".join(map(str, lats)), "longitude": ",".join(map(str, lons))}
        if getattr(self.s, "openmeteo_api_key", None):
            params["apikey"] = self.s.openmeteo_api_key
        try:
            payload = self._get_json(url, params)
            elevs = payload.get("elevation", [])
            if len(elevs) >= 5:
                z0, z_north, z_south, z_east, z_west = elevs[:5]
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
                try:
                    self._terrain_cache_path.parent.mkdir(parents=True, exist_ok=True)
                    self._terrain_cache_path.write_text(json.dumps(cache, indent=2), encoding="utf-8")
                except Exception:
                    pass
                return res
        except Exception as e:
            logger.warning("Failed to fetch DEM elevation stencil (%s), using baseline", e)

        # Baseline fallback
        return {"elevation_m": 1200.0, "slope_deg": 6.0, "aspect_deg": 45.0}

    def fetch_hourly(self, day: dt.date, source: str = "auto",
                     today: Optional[dt.date] = None,
                     latitude: Optional[float] = None,
                     longitude: Optional[float] = None) -> Tuple[pd.DataFrame, str]:
        """Return (hourly DataFrame indexed by naive local time, source actually used)."""
        today = today or dt.datetime.now(ZoneInfo(self.s.timezone)).date()
        used = self.choose_source(day, source, today)
        url = self.s.openmeteo_forecast_url if used == "forecast" else self.s.openmeteo_archive_url

        params = {
            "latitude": self.s.latitude if latitude is None else latitude,
            "longitude": self.s.longitude if longitude is None else longitude,
            "hourly": ",".join(self.variables),
            "start_date": day.isoformat(),
            "end_date": day.isoformat(),
            "timezone": self.s.timezone,
            "temperature_unit": "celsius",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
        }
        if self.s.openmeteo_models:
            params["models"] = self.s.openmeteo_models
        if getattr(self.s, "openmeteo_api_key", None):
            params["apikey"] = self.s.openmeteo_api_key

        payload = self._get_json(url, params)
        hourly = payload.get("hourly") or {}
        times = hourly.get("time")
        if not times:
            raise WeatherError("Open-Meteo response contained no hourly data.")

        columns = {k: v for k, v in hourly.items() if k != "time"}
        df = pd.DataFrame(columns, index=pd.to_datetime(times)).apply(pd.to_numeric, errors="coerce")
        absent = [v for v in self.variables if v not in df.columns]
        if absent:
            logger.warning("Open-Meteo (%s) did not return: %s", used, absent)
        return df, used

    def _get_json(self, url: str, params: dict) -> dict:
        last_error = "unknown error"
        for attempt in range(self.s.http_retries + 1):
            try:
                resp = self.session.get(url, params=params, timeout=self.s.http_timeout)
            except requests.RequestException as exc:
                last_error = f"network error: {exc}"
            else:
                if resp.status_code == 200:
                    try:
                        return resp.json()
                    except ValueError as exc:
                        raise WeatherError(f"Invalid JSON from Open-Meteo: {exc}") from exc
                if resp.status_code not in (429, 500, 502, 503, 504):
                    reason = ""
                    try:
                        reason = resp.json().get("reason", "")
                    except Exception:
                        reason = (resp.text or "")[:200]
                    raise WeatherError(f"Open-Meteo rejected the request ({resp.status_code}): {reason}")
                last_error = f"HTTP {resp.status_code}"
            if attempt < self.s.http_retries:
                delay = max(2, 2 ** attempt)
                logger.warning("Open-Meteo attempt %d failed (%s); retrying in %ds", attempt + 1, last_error, delay)
                self._sleep(delay)
        raise WeatherError(f"Open-Meteo unavailable after retries: {last_error}")
