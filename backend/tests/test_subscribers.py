"""Automated test suite for subscriber registration, OTP verification, and email alerts."""
import os
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.storage import Store


class SubscriberApiTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self.tmpdir.name) / "test_subs.db"
        base_dir = Path(__file__).resolve().parent.parent
        self.settings = Settings(
            model_path=base_dir / "model" / "stage1_risk_scorer.pkl",
            metadata_path=base_dir / "model" / "model_metadata.json",
            expected_sklearn_version="",
            max_missing_fraction=0.25,
            allow_sklearn_mismatch=True,
            location_name="Kedarnath Valley",
            latitude=30.7346,
            longitude=79.0669,
            timezone="Asia/Kolkata",
            openmeteo_forecast_url="https://api.open-meteo.com/v1/forecast",
            openmeteo_archive_url="https://archive-api.open-meteo.com/v1/archive",
            openmeteo_models="",
            openmeteo_api_key="",
            http_timeout=5.0,
            http_retries=1,
            min_hours_per_day=20,
            db_path=db_path,
            enable_scheduler=False,
            schedule_hours="2,8",
            schedule_minute=10,
            run_on_startup=False,
            stale_after_hours=12.0,
            admin_api_key="test-key",
            cors_origins=("*",),
            log_level="ERROR",
            alert_webhook_url="",
            extreme_threshold_mm=50.0,
            smtp_host="",
            smtp_port=587,
            smtp_user="",
            smtp_password="",
            smtp_from="BurstWatch <alerts@burstwatch.live>",
            smtp_tls=True,
            smtp_ssl=False,
            email_dev_mode=True,
        )
        self.app = create_app(settings=self.settings)
        self.client = TestClient(self.app)
        self.store = Store(db_path)

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_registration_and_verification_flow(self):
        # 1. Register with invalid email
        res = self.client.post("/subscribers/register", json={"email": "not-an-email"})
        self.assertEqual(res.status_code, 422)

        # 2. Register with valid email
        email = "cyclone_watcher@burstwatch.io"
        res = self.client.post("/subscribers/register", json={"email": email, "location_pref": "ALL"})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["status"], "pending")
        self.assertEqual(body["verified"], False)

        # Retrieve generated code directly from store to simulate user checking email
        sub = self.store.get_subscriber(email)
        self.assertIsNotNone(sub)
        code = sub["verification_code"]
        self.assertIsNotNone(code)
        self.assertEqual(len(code), 6)

        # 3. Verify with wrong code
        res = self.client.post("/subscribers/verify", json={"email": email, "code": "000000"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Invalid verification code", res.json()["detail"])

        # 4. Verify with correct code
        res = self.client.post("/subscribers/verify", json={"email": email, "code": code})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "verified")
        self.assertEqual(res.json()["verified"], True)

        # 5. Check subscriber status endpoint
        res = self.client.get(f"/subscribers/status?email={email}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "verified")
        self.assertEqual(res.json()["verified"], True)

        # 6. Broadcast weather alert to verified subscribers
        res = self.client.post("/subscribers/broadcast", json={
            "subject": "Flash Flood Warning",
            "message": "Heavy convective cell detected over valley.",
            "location": "ALL",
            "predicted_probability": 0.88,
            "threshold": 0.50,
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["sent"], 1)

        # 7. Unsubscribe
        res = self.client.post("/subscribers/unsubscribe", json={"email": email})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "unsubscribed")

        # 8. Check status after unsubscribe
        res = self.client.get(f"/subscribers/status?email={email}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "unsubscribed")
        self.assertEqual(res.json()["verified"], False)

        # 9. 1-click GET unsubscribe endpoint
        res = self.client.get(f"/subscribers/unsubscribe?email={email}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("Unsubscribed", res.text)


if __name__ == "__main__":
    unittest.main()
