"""Orchestration: weather & terrain -> physics features -> dual-ensemble model -> storage -> alert."""
from __future__ import annotations

import datetime as dt
import logging
import threading
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

from .alerts import Notifier
from .config import Settings
from .features import FeaturePlan, compute_daily_features
from .model_service import ModelService
from .storage import Store, utcnow
from .weather import OpenMeteoClient, WeatherError

logger = logging.getLogger(__name__)


class ForecastService:
    def __init__(self, settings: Settings, model: ModelService, plan: FeaturePlan,
                 store: Store, weather: OpenMeteoClient, notifier: Notifier):
        self.settings = settings
        self.model = model
        self.plan = plan
        self.store = store
        self.weather = weather
        self.notifier = notifier
        self._lock = threading.Lock()

    def today(self) -> dt.date:
        return dt.datetime.now(ZoneInfo(self.settings.timezone)).date()

    def _features_for(self, day: dt.date, source: str, lat: Optional[float] = None, lon: Optional[float] = None):
        today = self.today()
        if day > today:
            raise ValueError(f"feature_date {day} is in the future (today is {today}).")
        latitude = self.settings.latitude if lat is None else lat
        longitude = self.settings.longitude if lon is None else lon

        fetch_terrain = getattr(self.weather, "fetch_terrain_params", None)
        if callable(fetch_terrain):
            terrain = fetch_terrain(latitude, longitude)
        else:
            terrain = {"elevation_m": 1000.0, "slope_deg": 5.0, "aspect_deg": 45.0}

        hourly, used = self.weather.fetch_hourly(day, source, today=today, latitude=latitude, longitude=longitude)
        feats = compute_daily_features(hourly, day, self.plan, self.settings.min_hours_per_day, terrain=terrain)
        return feats, used, terrain

    def preview_features(self, day: Optional[dt.date] = None, source: str = "auto") -> Dict[str, Any]:
        day = day or self.today()
        feats, used, terrain = self._features_for(day, source)
        missing = [k for k, v in feats.items() if v is None]
        return {"feature_date": day.isoformat(), "data_source": used,
                "terrain": terrain, "missing_features": missing, "features": feats}

    def run(self, feature_date: Optional[dt.date] = None, source: str = "auto",
            persist: bool = True, notify: bool = True, trigger: str = "manual") -> Dict[str, Any]:
        """Predict convective cloudburst risk from current/forecast weather & terrain."""
        with self._lock:
            day = feature_date or self.today()
            feats, used, terrain = self._features_for(day, source)
            result = self.model.predict(feats)

            record: Dict[str, Any] = {
                **result,
                "created_at": utcnow(),
                "location": self.settings.location_name,
                "coordinates": [self.settings.latitude, self.settings.longitude],
                "terrain": terrain,
                "feature_date": day.isoformat(),
                "target_date": (day + dt.timedelta(days=1)).isoformat(),
                "data_source": used,
                "trigger": trigger,
                "features": feats,
                "alert_sent": False,
            }
            if persist:
                record["id"] = self.store.save_prediction(record)
                if notify and record["prediction"] == 1:
                    record["alert_sent"] = self._maybe_alert(record)
            return record

    def predict_location(self, latitude: float, longitude: float,
                         feature_date: Optional[dt.date] = None,
                         source: str = "auto") -> Dict[str, Any]:
        """Predict from weather and 30m DEM terrain fetched at coordinates."""
        with self._lock:
            today = self.today()
            day = feature_date or today
            if day > today:
                raise ValueError(f"feature_date {day} is in the future (today is {today}).")

            try:
                feats, used, terrain = self._features_for(day, source, lat=latitude, lon=longitude)
            except WeatherError as exc:
                cached_pred = self.store.latest_prediction()
                if cached_pred:
                    age_minutes = 0
                    created_raw = cached_pred.get("created_at")
                    if isinstance(created_raw, str):
                        try:
                            created_dt = dt.datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
                            if created_dt.tzinfo is None:
                                created_dt = created_dt.replace(tzinfo=dt.timezone.utc)
                            age_minutes = max(
                                0,
                                int((dt.datetime.now(dt.timezone.utc) - created_dt).total_seconds() / 60),
                            )
                        except ValueError:
                            age_minutes = 0
                    return {
                        **cached_pred,
                        "coordinates": [latitude, longitude],
                        "location": {"latitude": latitude, "longitude": longitude},
                        "stale": True,
                        "stale_minutes": age_minutes,
                        "stale_reason": str(exc),
                    }
                raise

            result = self.model.predict(feats)
            warns = list(result.get("warnings", []))
            if (latitude, longitude) != (self.settings.latitude, self.settings.longitude):
                warns.append(
                    f"Model was calibrated for {self.settings.location_name} (Dehradun region). "
                    f"Validity at requested coordinates ({latitude}, {longitude}) is experimental."
                )
            return {
                **result,
                "coordinates": [latitude, longitude],
                "location": {"latitude": latitude, "longitude": longitude},
                "terrain": terrain,
                "feature_date": day.isoformat(),
                "target_date": (day + dt.timedelta(days=1)).isoformat(),
                "data_source": used,
                "warnings": warns,
                "stale": False,
                "stale_minutes": None,
                "stale_reason": None,
            }

    def run_job(self) -> None:
        """Entry point called by the background scheduler."""
        run_id = self.store.start_run("scheduler")
        logger.info("Starting scheduled prediction run (id=%d)", run_id)
        try:
            rec = self.run(trigger="scheduler")
            self.store.finish_run(run_id, ok=True, feature_date=rec.get("feature_date"))
            logger.info("Scheduled prediction complete: probability=%.3f prediction=%d",
                        rec["predicted_probability"], rec["prediction"])
        except Exception as exc:  # noqa: BLE001
            logger.exception("Scheduled prediction run failed")
            self.store.finish_run(run_id, ok=False, error=f"{type(exc).__name__}: {exc}")

    def _maybe_alert(self, rec: dict) -> bool:
        """Send at most one alert per target date unless delivery failed previously."""
        target_date = rec["target_date"]
        if self.store.alert_sent(target_date):
            logger.info("Alert already delivered for %s; skipping duplicate.", target_date)
            return False

        ok = self.notifier.send(rec)
        if ok:
            self.store.mark_alert(target_date, rec["predicted_probability"], rec.get("risk_label", ""))
        return ok
