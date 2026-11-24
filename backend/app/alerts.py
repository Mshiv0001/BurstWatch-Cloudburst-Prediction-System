"""Alert delivery. Always logs; optionally POSTs JSON to a webhook (Slack/Discord/custom)."""
from __future__ import annotations

import logging
from typing import Any, Dict

import requests

logger = logging.getLogger(__name__)


class Notifier:
    def __init__(self, webhook_url: str = "", timeout: float = 10.0,
                 session: "requests.Session | None" = None,
                 store: Any = None,
                 email_service: Any = None):
        self.webhook_url = webhook_url
        self.timeout = timeout
        self.session = session or requests.Session()
        self.store = store
        self.email_service = email_service

    @staticmethod
    def message(rec: Dict[str, Any]) -> str:
        return (
            f"Elevated extreme-rainfall risk for {rec['target_date']} ({rec['location']} region). "
            f"Model score {rec['predicted_probability']:.2f} is at or above the alert threshold "
            f"{rec['threshold']}. This is a statistical screening signal for >=50 mm/day rainfall, "
            "not a confirmed cloudburst forecast; false alarms are common."
        )

    def send(self, rec: Dict[str, Any]) -> bool:
        """Return True if the alert counts as delivered (log, email to verified subscribers, plus webhook)."""
        text = self.message(rec)
        logger.warning("ALERT: %s", text)

        # Dispatch alert emails to active verified subscribers
        if self.store and self.email_service:
            try:
                verified_subs = self.store.get_verified_subscribers(rec.get("location"))
                if verified_subs:
                    self.email_service.broadcast_weather_alert(verified_subs, rec)
                    self.store.record_alert_sent_to_subscribers([s["id"] for s in verified_subs])
                    logger.info("Dispatched alert emails to %d verified subscriber(s)", len(verified_subs))
            except Exception as email_exc:
                logger.error("Failed to broadcast alert emails: %s", email_exc)

        if not self.webhook_url:
            return True
        payload = {"text": text, "content": text, "event": "extreme_rainfall_alert",
                   "data": {k: rec[k] for k in ("location", "feature_date", "target_date",
                                                "predicted_probability", "threshold")}}
        try:
            resp = self.session.post(self.webhook_url, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            return True
        except requests.RequestException as exc:
            logger.error("Alert webhook failed: %s", exc)
            return False
