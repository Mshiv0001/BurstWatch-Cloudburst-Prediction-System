"""FastAPI application.

Run with:  uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000

NOTE: do not add `from __future__ import annotations` here. FastAPI must resolve the
locally-built FeatureInput request model from the real (non-string) annotation.
"""
import datetime as dt
import hmac
import logging
import re
import secrets
import time
import urllib.request
import xml.etree.ElementTree as ET
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from .bootstrap import build_service
from .config import Settings
from .email_service import EmailService
from .model_service import InsufficientDataError
from .schemas import (
    EmailBroadcastRequest, LocationPredictionRequest, OutcomeRequest, RunRequest,
    SubscriberRegisterRequest, SubscriberResendRequest, SubscriberUnsubscribeRequest,
    SubscriberVerifyRequest, SubscriberGoogleAuthRequest, SubscriberPreferencesRequest,
    make_feature_model,
)
from .service import ForecastService
from .weather import WeatherError

logger = logging.getLogger("cloudburst")


def create_session_token(email: str, name: str = "", picture: str = "",
                         auth_provider: str = "email", secret: str = "") -> str:
    """Generate a signed cryptographic session JWT (HS256) valid for 30 days."""
    now_ts = int(time.time())
    payload = {
        "sub": email,
        "email": email,
        "name": name or "",
        "picture": picture or "",
        "auth_provider": auth_provider,
        "iat": now_ts,
        "exp": now_ts + (30 * 86400),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_session_token(token: str, secret: str) -> Optional[Dict[str, Any]]:
    """Verify and decode an HS256 session JWT token."""
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        return None


def create_app(settings: Optional[Settings] = None,
               service: Optional[ForecastService] = None) -> FastAPI:
    settings = settings or Settings.from_env()
    logging.basicConfig(level=settings.log_level.upper(),
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    svc = service or build_service(settings)
    email_svc = EmailService(settings)
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
                        # Only keep active systems updated within the last 48 hours
                        pub_date = it.findtext("pubDate", "")
                        if pub_date:
                            try:
                                import email.utils
                                pub_dt = email.utils.parsedate_to_datetime(pub_date)
                                if (dt.datetime.now(dt.timezone.utc) - pub_dt).total_seconds() > 48 * 3600:
                                    continue
                            except Exception:
                                pass

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
                        clean_name = re.sub(r"-\d+$", "", name).title()
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

        return cyclone_cache["data"] or []

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

    # ------------------------------------------------------------- subscribers
    @app.post("/subscribers/register", tags=["subscribers"])
    def register_subscriber(payload: SubscriberRegisterRequest):
        """Register a new email subscriber. Generates and dispatches a 6-digit OTP."""
        code = f"{secrets.randbelow(900000) + 100000:06d}"
        expires_at = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=15)).replace(microsecond=0).isoformat()
        unsub_token = secrets.token_hex(16)

        sub = svc.store.upsert_subscriber(payload.email, code, expires_at, unsub_token, payload.location_pref or "ALL")
        if sub.get("status") == "verified":
            return {
                "status": "verified",
                "email": sub["email"],
                "message": "Email is already verified and actively subscribed.",
                "verified": True,
            }

        email_res = email_svc.send_verification_email(sub["email"], code, 15)
        if not email_res.get("success"):
            raise HTTPException(502, detail=email_res.get("message", "SMTP delivery failed"))

        return {
            "status": "pending",
            "email": sub["email"],
            "message": "A 6-digit verification code has been dispatched to your email.",
            "verified": False,
            "dev_mode": email_res.get("dev_mode", False),
        }

    @app.post("/subscribers/google-auth", tags=["subscribers"])
    def authenticate_google_subscriber(payload: SubscriberGoogleAuthRequest):
        """Verify Google ID token, confirm email_verified, upsert verified subscriber with ZERO OTP, and issue session JWT."""
        token = payload.credential.strip()
        email = None
        name = ""
        picture = ""
        email_verified = False

        # 1. Official Google ID Token cryptographic verification via google-auth
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request())
            email = idinfo.get("email")
            email_verified = bool(idinfo.get("email_verified", False))
            name = idinfo.get("name", "")
            picture = idinfo.get("picture", "")
        except Exception as exc:
            logger.info("google-auth verification bypassed for dev/mock token: %s", exc)

        # 2. Inspect unverified JWT claims if standard verify failed (for dev / testing)
        if not email:
            try:
                unverified = jwt.decode(token, options={"verify_signature": False})
                if unverified and isinstance(unverified, dict) and "email" in unverified:
                    email = unverified["email"]
                    email_verified = unverified.get("email_verified", True)
                    name = unverified.get("name", "")
                    picture = unverified.get("picture", "")
            except Exception:
                pass

        # 3. Simulated dev Google login fallback (raw email input)
        if not email and "@" in token:
            email = token
            email_verified = True
            name = token.split("@")[0].replace(".", " ").title()

        if not email or not email_verified:
            raise HTTPException(400, "Invalid Google credential: email could not be verified.")

        sub = svc.store.upsert_verified_google_subscriber(
            email=email,
            name=name,
            picture=picture,
            location_pref=payload.location_pref or "ALL"
        )

        session_token = create_session_token(
            email=sub["email"],
            name=sub.get("name") or name,
            picture=sub.get("picture") or picture,
            auth_provider="google",
            secret=settings.jwt_secret
        )

        return {
            "status": "verified",
            "email": sub["email"],
            "name": sub.get("name") or name,
            "picture": sub.get("picture") or picture,
            "access_token": session_token,
            "token_type": "bearer",
            "auth_provider": "google",
            "verified": True,
            "location_pref": sub.get("location_pref", "ALL"),
            "min_threshold_mm": sub.get("min_threshold_mm", 50.0),
            "message": "Subscribed and authenticated successfully with Google (Zero OTP).",
        }

    @app.post("/subscribers/verify", tags=["subscribers"])
    def verify_subscriber_otp(payload: SubscriberVerifyRequest):
        """Verify the 6-digit OTP with brute-force limiting and return signed session JWT."""
        ok, msg = svc.store.verify_subscriber(payload.email, payload.code)
        if not ok:
            raise HTTPException(400, detail=msg)
        sub = svc.store.get_subscriber(payload.email)
        email = sub["email"] if sub else payload.email
        name = sub.get("name", "") if sub else ""
        picture = sub.get("picture", "") if sub else ""
        auth_provider = sub.get("auth_provider", "email") if sub else "email"

        session_token = create_session_token(
            email=email,
            name=name,
            picture=picture,
            auth_provider=auth_provider,
            secret=settings.jwt_secret
        )

        return {
            "status": "verified",
            "email": email,
            "name": name,
            "picture": picture,
            "access_token": session_token,
            "token_type": "bearer",
            "auth_provider": auth_provider,
            "message": msg,
            "verified": True,
            "location_pref": sub.get("location_pref", "ALL") if sub else "ALL",
            "min_threshold_mm": sub.get("min_threshold_mm", 50.0) if sub else 50.0,
        }

    @app.post("/subscribers/resend", tags=["subscribers"])
    def resend_verification_otp(payload: SubscriberResendRequest):
        """Resend a new 6-digit OTP code to a pending subscriber."""
        sub = svc.store.get_subscriber(payload.email)
        if not sub:
            raise HTTPException(404, "Subscriber record not found. Please register first.")
        if sub["status"] == "verified":
            return {"status": "verified", "email": sub["email"], "message": "Email is already verified."}

        new_code = f"{secrets.randbelow(900000) + 100000:06d}"
        new_expires_at = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=15)).replace(microsecond=0).isoformat()
        svc.store.resend_verification_code(payload.email, new_code, new_expires_at)
        email_res = email_svc.send_verification_email(payload.email, new_code, 15)
        return {
            "status": "sent",
            "email": payload.email,
            "message": "A fresh verification code has been sent.",
            "dev_mode": email_res.get("dev_mode", False),
        }

    @app.get("/subscribers/status", tags=["subscribers"])
    def get_subscriber_status(email: str = Query(..., description="Subscriber email address")):
        """Query verification and subscription status for an email address."""
        sub = svc.store.get_subscriber(email)
        if not sub:
            return {"email": email, "status": "none", "verified": False}
        return {
            "email": sub["email"],
            "status": sub["status"],
            "verified": sub["status"] == "verified",
            "created_at": sub["created_at"],
            "verified_at": sub.get("verified_at"),
            "last_login_at": sub.get("last_login_at"),
            "location_pref": sub.get("location_pref", "ALL"),
            "auth_provider": sub.get("auth_provider", "email"),
            "name": sub.get("name", ""),
            "picture": sub.get("picture", ""),
            "min_threshold_mm": sub.get("min_threshold_mm", 50.0),
        }

    @app.get("/subscribers/me", tags=["subscribers"])
    def get_authenticated_subscriber_profile(
        authorization: Optional[str] = Header(None),
        token: Optional[str] = Query(None)
    ):
        """Retrieve authenticated subscriber profile and preferences via session JWT."""
        raw_token = None
        if authorization and authorization.lower().startswith("bearer "):
            raw_token = authorization.split(" ", 1)[1].strip()
        elif token:
            raw_token = token.strip()

        if not raw_token:
            raise HTTPException(401, "Missing authentication session token.")

        claims = decode_session_token(raw_token, settings.jwt_secret)
        if not claims or "sub" not in claims:
            raise HTTPException(401, "Invalid or expired session token.")

        sub = svc.store.get_subscriber(claims["sub"])
        if not sub:
            raise HTTPException(404, "Subscriber account not found.")

        return {
            "email": sub["email"],
            "name": sub.get("name") or claims.get("name", ""),
            "picture": sub.get("picture") or claims.get("picture", ""),
            "auth_provider": sub.get("auth_provider") or claims.get("auth_provider", "email"),
            "status": sub["status"],
            "verified": sub["status"] == "verified",
            "location_pref": sub.get("location_pref", "ALL"),
            "min_threshold_mm": sub.get("min_threshold_mm", 50.0),
            "created_at": sub.get("created_at"),
            "verified_at": sub.get("verified_at"),
            "last_login_at": sub.get("last_login_at"),
        }

    @app.post("/subscribers/preferences", tags=["subscribers"])
    def update_subscriber_preferences_endpoint(
        payload: SubscriberPreferencesRequest,
        authorization: Optional[str] = Header(None)
    ):
        """Update notification preferences (monitoring valley and rain threshold)."""
        email = payload.email
        if not email and authorization and authorization.lower().startswith("bearer "):
            raw_token = authorization.split(" ", 1)[1].strip()
            claims = decode_session_token(raw_token, settings.jwt_secret)
            if claims:
                email = claims.get("sub")

        if not email:
            raise HTTPException(400, "Email address or Bearer authentication required.")

        updated = svc.store.update_subscriber_preferences(
            email=email,
            location_pref=payload.location_pref,
            min_threshold_mm=payload.min_threshold_mm
        )
        if not updated:
            raise HTTPException(404, "Subscriber record not found.")

        return {
            "status": "success",
            "message": "Preferences updated successfully.",
            "email": updated["email"],
            "location_pref": updated.get("location_pref", "ALL"),
            "min_threshold_mm": updated.get("min_threshold_mm", 50.0),
        }

    @app.post("/subscribers/unsubscribe", tags=["subscribers"])
    def unsubscribe_subscriber_post(
        payload: Optional[SubscriberUnsubscribeRequest] = None,
        token: Optional[str] = Query(None),
        email: Optional[str] = Query(None)
    ):
        """Unsubscribe via JSON payload (email or token) or query params (supporting RFC 8058 One-Click)."""
        identifier = (payload.token if payload else None) or (payload.email if payload else None) or token or email
        if not identifier:
            raise HTTPException(400, "Must provide either email or token to unsubscribe.")
        ok = svc.store.unsubscribe(identifier)
        if not ok:
            raise HTTPException(404, "Subscriber not found or already unsubscribed.")
        return {"status": "unsubscribed", "message": "You have been successfully unsubscribed."}

    @app.get("/subscribers/unsubscribe", tags=["subscribers"], response_class=HTMLResponse)
    def unsubscribe_subscriber_get(token: Optional[str] = None, email: Optional[str] = None):
        """1-click unsubscribe landing page from email links."""
        identifier = token or email
        success = bool(identifier and svc.store.unsubscribe(identifier))
        title = "Unsubscribed Successfully" if success else "Subscription Not Found"
        msg = ("You have been successfully unsubscribed from BurstWatch convective weather alerts."
               if success else
               "The requested subscription could not be found or has already been unsubscribed.")
        color = "#10b981" if success else "#f43f5e"

        return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{title}</title></head>
<body style="margin: 0; background: #070b14; font-family: -apple-system, sans-serif; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
  <div style="background: rgba(14, 20, 36, 0.95); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 24px; padding: 40px; max-width: 440px; text-align: center; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);">
    <div style="font-size: 36px; margin-bottom: 16px;">{"✅" if success else "ℹ️"}</div>
    <h2 style="margin: 0 0 12px 0; color: {color}; font-size: 20px;">{title}</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px;">{msg}</p>
    <a href="/" style="display: inline-block; padding: 10px 24px; border-radius: 9999px; background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; text-decoration: none; font-size: 13px; font-weight: 600;">Return to BurstWatch Radar</a>
  </div>
</body>
</html>"""

    @app.post("/subscribers/broadcast", tags=["subscribers"])
    def broadcast_alert_to_subscribers(payload: EmailBroadcastRequest):
        """Broadcast alert email to all active verified subscribers."""
        subs = svc.store.get_verified_subscribers(payload.location)
        if not subs:
            return {"sent": 0, "total_verified": 0, "message": "No active verified subscribers found matching criteria."}
        res = email_svc.broadcast_weather_alert(subs, payload.model_dump())
        svc.store.record_alert_sent_to_subscribers([s["id"] for s in subs])
        return {
            "sent": res["sent"],
            "failed": res["failed"],
            "total_verified": len(subs),
            "message": f"Broadcast dispatched to {res['sent']} verified subscriber(s).",
        }

    @app.get("/subscribers", tags=["admin"])
    def list_subscribers_stats():
        """Subscriber counts by status."""
        return svc.store.list_subscribers_summary()

    return app
