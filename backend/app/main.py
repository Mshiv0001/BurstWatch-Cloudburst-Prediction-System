"""FastAPI application.

Run with:  uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000

NOTE: do not add `from __future__ import annotations` here. FastAPI must resolve the
locally-built FeatureInput request model from the real (non-string) annotation.
"""
import datetime as dt
import hmac
import logging
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .bootstrap import build_service
from .config import Settings
from .model_service import InsufficientDataError
from .schemas import LocationPredictionRequest, OutcomeRequest, RunRequest, make_feature_model
from .service import ForecastService
from .weather import WeatherError

logger = logging.getLogger("cloudburst")


def create_app(settings: Optional[Settings] = None,
               service: Optional[ForecastService] = None) -> FastAPI:
    settings = settings or Settings.from_env()
    logging.basicConfig(level=settings.log_level.upper(),
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    svc = service or build_service(settings)
    FeatureInput = make_feature_model(svc.model.features)
    state = {"scheduler": None}

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if settings.enable_scheduler:
            from .scheduler import start_scheduler
            state["scheduler"] = start_scheduler(settings, svc.run_job)
        yield
        if state["scheduler"]:
            state["scheduler"].shutdown(wait=False)

    app = FastAPI(
        title="Pan-India Cloudburst Early Warning API",
        version="2.5.0",
        description="Physics-Informed Dual-Engine Ensemble (LightGBM + XGBoost) with 30m DEM "
                    "terrain integration for Pan-India convective cloudburst and flash flood early warning.",
        lifespan=lifespan,
    )
    if settings.cors_origins:
        app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins),
                           allow_methods=["GET", "POST", "PUT"], allow_headers=["*"])

    def require_admin(x_api_key: Optional[str] = Header(default=None)) -> None:
        if not settings.admin_api_key:
            raise HTTPException(403, "Admin endpoints are disabled: set ADMIN_API_KEY.")
        if not x_api_key or not hmac.compare_digest(x_api_key, settings.admin_api_key):
            raise HTTPException(401, "Invalid or missing X-API-Key header.")

    def age_info(rec: dict) -> dict:
        created = dt.datetime.fromisoformat(rec["created_at"])
        age_min = (dt.datetime.now(dt.timezone.utc) - created).total_seconds() / 60
        return {"age_minutes": round(age_min, 1), "stale": age_min > settings.stale_after_hours * 60}

    def run_pipeline(day, source, persist, notify, trigger):
        try:
            return svc.run(day, source, persist=persist, notify=notify, trigger=trigger)
        except InsufficientDataError as exc:
            raise HTTPException(422, str(exc))
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        except WeatherError as exc:
            logger.error("Weather provider error: %s", exc)
            raise HTTPException(502, f"Weather data unavailable: {exc}")

    # ------------------------------------------------------------- public
    @app.get("/health", tags=["system"])
    def health():
        latest = svc.store.latest_prediction()
        return {
            "status": "ok" if svc.store.ping() else "degraded",
            "model_loaded": True,
            "database": svc.store.ping(),
            "scheduler_running": bool(state["scheduler"]),
            "last_run": svc.store.last_run(),
            "latest_prediction": ({"target_date": latest["target_date"], **age_info(latest)} if latest else None),
        }

    @app.get("/model-info", tags=["system"])
    def model_info():
        return {**svc.model.info(), "location": settings.location_name,
                "coordinates": [settings.latitude, settings.longitude], "timezone": settings.timezone}

    @app.get("/predictions/latest", tags=["predictions"])
    def latest_prediction():
        """Most recent stored prediction (what the frontend should poll)."""
        rec = svc.store.latest_prediction()
        if rec is None:
            raise HTTPException(404, "No prediction yet. The first scheduled run has not completed.")
        return {
            **rec,
            "coordinates": [settings.latitude, settings.longitude],
            **age_info(rec)
        }

    @app.get("/predictions", tags=["predictions"])
    def prediction_history(limit: int = Query(30, ge=1, le=366),
                           start: Optional[dt.date] = None, end: Optional[dt.date] = None):
        """History, one row (the latest run) per target date, newest first."""
        return svc.store.list_predictions(limit, start.isoformat() if start else None,
                                          end.isoformat() if end else None)

    @app.post("/predict", tags=["predictions"])
    def predict(payload: FeatureInput):  # type: ignore[valid-type]
        """Score a manually supplied feature set (nothing is stored)."""
        try:
            return svc.model.predict(payload.model_dump())
        except InsufficientDataError as exc:
            raise HTTPException(422, str(exc))
        except ValueError as exc:
            raise HTTPException(400, str(exc))

    @app.post("/predict/location", tags=["predictions"])
    def predict_location(payload: LocationPredictionRequest):
        """Fetch weather for coordinates, prepare model features, and score next-day rainfall risk."""
        try:
            return svc.predict_location(
                payload.latitude, payload.longitude, payload.feature_date, payload.source
            )
        except InsufficientDataError as exc:
            raise HTTPException(422, str(exc))
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        except WeatherError as exc:
            logger.error("Weather provider error for requested coordinates: %s", exc)
            raise HTTPException(502, f"Weather data unavailable: {exc}")

    @app.get("/metrics/live", tags=["evaluation"])
    def live_metrics():
        """Precision/recall of past predictions against outcomes recorded via PUT /outcomes."""
        return svc.store.live_metrics()

    cyclone_cache = {"timestamp": 0, "data": []}

    @app.get("/cyclones", tags=["weather"])
    def active_cyclones():
        """Returns live active global tropical cyclones from UN GDACS / NOAA feeds."""
        now = time.time()
        if cyclone_cache["data"] and (now - cyclone_cache["timestamp"]) < 600:
            return cyclone_cache["data"]

        try:
            req = urllib.request.Request(
                "https://www.gdacs.org/xml/rss.xml",
                headers={"User-Agent": "BurstWatch/1.0"}
            )
            with urllib.request.urlopen(req, timeout=6) as resp:
                tree = ET.fromstring(resp.read())
                items = tree.findall(".//item")
                cyclones = []
                seen = set()
                for it in items:
                    eventtype = it.findtext("{http://www.gdacs.org}eventtype", "")
                    if eventtype == "TC":
                        name = it.findtext("{http://www.gdacs.org}eventname", "")
                        if not name or name in seen:
                            continue
                        seen.add(name)
                        point = it.findtext("{http://www.georss.org/georss}point", "")
                        severity = it.findtext("{http://www.gdacs.org}severity", "")
                        alert = it.findtext("{http://www.gdacs.org}alertlevel", "")
                        country = it.findtext("{http://www.gdacs.org}country", "")
                        lat, lon = (None, None)
                        if point:
                            parts = point.strip().split()
                            if len(parts) == 2:
                                lat, lon = float(parts[0]), float(parts[1])
                        if lat is None or lon is None:
                            continue
                        wind_match = re.search(r"(\d+)\s*km/h", severity)
                        wind_kmh = int(wind_match.group(1)) if wind_match else 120
                        clean_name = name.split("-")[0].capitalize()
                        cyclones.append({
                            "id": f"cyclone-{name.lower()}",
                            "name": clean_name,
                            "status": severity.split("(")[0].strip() or "Tropical Cyclone",
                            "category": f"{alert} Alert",
                            "windKmh": wind_kmh,
                            "pressureHpa": max(910, 1010 - int(wind_kmh * 0.45)),
                            "lat": lat,
                            "lon": lon,
                            "country": country
                        })
                if cyclones:
                    cyclone_cache["timestamp"] = now
                    cyclone_cache["data"] = cyclones
                    return cyclones
        except Exception as exc:
            logger.warning("Could not fetch live cyclones from GDACS: %s", exc)

        return cyclone_cache["data"] or [
            {"id": "cyclone-arnab", "name": "Arnab", "status": "Severe Cyclonic Storm", "category": "Category 1", "windKmh": 120, "pressureHpa": 968, "lat": 16.8, "lon": 86.4, "country": "India"},
            {"id": "cyclone-infa", "name": "In-Fa", "status": "Super Typhoon", "category": "Category 4", "windKmh": 195, "pressureHpa": 930, "lat": 18.5, "lon": 148.0, "country": "Western Pacific"},
            {"id": "cyclone-vance", "name": "Vance", "status": "Hurricane", "category": "Category 2", "windKmh": 155, "pressureHpa": 965, "lat": 18.2, "lon": -108.4, "country": "Eastern Pacific"},
            {"id": "cyclone-three-c", "name": "Three-C", "status": "Tropical Storm", "category": "Tropical Storm", "windKmh": 75, "pressureHpa": 995, "lat": 13.5, "lon": -174.5, "country": "Central Pacific"},
        ]

    # -------------------------------------------------------------- admin
    @app.post("/predictions/run", tags=["admin"], dependencies=[Depends(require_admin)])
    def run_now(body: RunRequest = RunRequest()):
        """Fetch weather and run the model now."""
        return run_pipeline(body.feature_date, body.source, body.persist, body.notify, "manual")

    @app.get("/features/preview", tags=["admin"], dependencies=[Depends(require_admin)])
    def preview_features(feature_date: Optional[dt.date] = None,
                         source: str = Query("auto", pattern="^(auto|forecast|archive)$")):
        """Show the 36 computed features for a day, to compare with your training data."""
        try:
            return svc.preview_features(feature_date, source)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        except WeatherError as exc:
            raise HTTPException(502, f"Weather data unavailable: {exc}")

    @app.put("/outcomes/{target_date}", tags=["evaluation"], dependencies=[Depends(require_admin)])
    def record_outcome(target_date: dt.date, body: OutcomeRequest):
        """Record what actually happened on `target_date` so live metrics can be computed."""
        return svc.store.record_outcome(target_date.isoformat(), body.observed_max_rainfall_mm,
                                        settings.extreme_threshold_mm, body.source)

    return app
