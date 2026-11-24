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

    def test_google_auth_zero_otp_and_session_jwt(self):
        """Test Google login path requires ZERO OTP and returns signed session JWT with claims."""
        import jwt

        # 1. Post Google credential (simulated email or OIDC token)
        google_email = "climate_researcher@gmail.com"
        res = self.client.post("/subscribers/google-auth", json={
            "credential": google_email,
            "location_pref": "Western Ghats"
        })
        self.assertEqual(res.status_code, 200)
        body = res.json()

        # Zero OTP validation: Status is directly verified!
        self.assertEqual(body["status"], "verified")
        self.assertEqual(body["verified"], True)
        self.assertEqual(body["email"], google_email)
        self.assertEqual(body["auth_provider"], "google")
        self.assertIn("access_token", body)

        # 2. Decode and verify HS256 JWT
        access_token = body["access_token"]
        claims = jwt.decode(access_token, self.settings.jwt_secret, algorithms=["HS256"])
        self.assertEqual(claims["sub"], google_email)
        self.assertEqual(claims["email"], google_email)
        self.assertEqual(claims["auth_provider"], "google")
        self.assertIn("name", claims)
        self.assertIn("picture", claims)

        # 3. Use access token to fetch authenticated profile via /subscribers/me
        me_res = self.client.get("/subscribers/me", headers={"Authorization": f"Bearer {access_token}"})
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.json()
        self.assertEqual(me_data["email"], google_email)
        self.assertEqual(me_data["auth_provider"], "google")
        self.assertEqual(me_data["location_pref"], "Western Ghats")
        self.assertEqual(me_data["verified"], True)

    def test_brute_force_otp_limiting(self):
        """Test that exceeding 5 failed OTP attempts locks out verification until code refresh."""
        email = "brute_target@burstwatch.live"
        self.client.post("/subscribers/register", json={"email": email})

        # Send 5 incorrect OTP attempts
        for attempt in range(1, 5):
            res = self.client.post("/subscribers/verify", json={"email": email, "code": "999999"})
            self.assertEqual(res.status_code, 400)
            self.assertIn("attempt(s) remaining", res.json()["detail"])

        # 5th failed attempt
        res = self.client.post("/subscribers/verify", json={"email": email, "code": "999999"})
        self.assertEqual(res.status_code, 400)

        # 6th attempt is blocked completely due to brute-force protection
        res = self.client.post("/subscribers/verify", json={"email": email, "code": "999999"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Too many failed attempts", res.json()["detail"])

    def test_session_token_and_preference_update(self):
        """Test updating notification preferences via Bearer JWT session token."""
        email = "valley_watcher@burstwatch.live"
        self.client.post("/subscribers/register", json={"email": email})
        sub = self.store.get_subscriber(email)
        code = sub["verification_code"]

        # Verify to obtain session JWT
        verify_res = self.client.post("/subscribers/verify", json={"email": email, "code": code})
        self.assertEqual(verify_res.status_code, 200)
        token = verify_res.json()["access_token"]
        self.assertTrue(bool(token))

        # Update preferences with Bearer token
        pref_res = self.client.post(
            "/subscribers/preferences",
            json={"location_pref": "Kedarnath Valley", "min_threshold_mm": 65.0},
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(pref_res.status_code, 200)
        pref_data = pref_res.json()
        self.assertEqual(pref_data["location_pref"], "Kedarnath Valley")
        self.assertEqual(pref_data["min_threshold_mm"], 65.0)

        # Verify persisted preferences via /subscribers/me
        me_res = self.client.get("/subscribers/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.json()["location_pref"], "Kedarnath Valley")
        self.assertEqual(me_res.json()["min_threshold_mm"], 65.0)


if __name__ == "__main__":
    unittest.main()
