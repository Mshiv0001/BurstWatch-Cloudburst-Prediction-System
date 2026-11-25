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
            allow_dev_google_auth=True,
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
        access_token = res.json()["access_token"]
        unsub_token = self.store.get_subscriber(email)["unsubscribe_token"]

        # 5. Check subscriber status endpoint
        res = self.client.get(f"/subscribers/status?email={email}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "verified")
        self.assertEqual(res.json()["verified"], True)

        # 6. Broadcast weather alert to verified subscribers (requires admin X-API-Key)
        res = self.client.post(
            "/subscribers/broadcast",
            json={
                "subject": "Flash Flood Warning",
                "message": "Heavy convective cell detected over valley.",
                "location": "ALL",
                "predicted_probability": 0.88,
                "threshold": 0.50,
            },
            headers={"X-API-Key": self.settings.admin_api_key},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["sent"], 1)

        # 7. Unsubscribe (authenticated with Bearer token)
        res = self.client.post(
            "/subscribers/unsubscribe",
            json={"email": email},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "unsubscribed")

        # 8. Check status after unsubscribe
        res = self.client.get(f"/subscribers/status?email={email}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "unsubscribed")
        self.assertEqual(res.json()["verified"], False)

        # 9. 1-click GET unsubscribe endpoint requires unsubscribe_token (not raw email)
        res_bad_get = self.client.get(f"/subscribers/unsubscribe?email={email}")
        self.assertEqual(res_bad_get.status_code, 200)
        self.assertIn("Not Found", res_bad_get.text)

        res = self.client.get(f"/subscribers/unsubscribe?token={unsub_token}")
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

    def test_verified_subscriber_cannot_be_verified_with_wrong_code(self):
        """Confirm that once verified, an attacker cannot verify again with a dummy or wrong code."""
        email = "secure_user@burstwatch.io"
        self.client.post("/subscribers/register", json={"email": email})
        sub = self.store.get_subscriber(email)
        code = sub["verification_code"]
        self.client.post("/subscribers/verify", json={"email": email, "code": code})

        # Try to verify again with wrong code or re-using code
        res = self.client.post("/subscribers/verify", json={"email": email, "code": "000000"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("No verification code active", res.json()["detail"])

    def test_tampered_or_expired_jwt_handling(self):
        """Confirm that expired, malformed, or tampered JWTs return 401 Unauthorized."""
        import time
        import jwt

        # 1. Missing token
        r1 = self.client.get("/subscribers/me")
        self.assertEqual(r1.status_code, 401)

        # 2. Malformed token
        r2 = self.client.get("/subscribers/me", headers={"Authorization": "Bearer not-a-jwt"})
        self.assertEqual(r2.status_code, 401)

        # 3. Expired token (iat & exp in the past)
        expired_payload = {
            "sub": "user@burstwatch.live",
            "email": "user@burstwatch.live",
            "iat": int(time.time()) - 7200,
            "exp": int(time.time()) - 3600,
        }
        expired_jwt = jwt.encode(expired_payload, self.settings.jwt_secret, algorithm="HS256")
        r3 = self.client.get("/subscribers/me", headers={"Authorization": f"Bearer {expired_jwt}"})
        self.assertEqual(r3.status_code, 401)

        # 4. Tampered secret token
        tampered_jwt = jwt.encode(expired_payload, "invalid-secret-key-at-least-32-chars-long!", algorithm="HS256")
        r4 = self.client.get("/subscribers/me", headers={"Authorization": f"Bearer {tampered_jwt}"})
        self.assertEqual(r4.status_code, 401)

    def test_google_auth_strict_production_verification(self):
        """When GOOGLE_CLIENT_ID is set (allow_dev_google_auth=False), unverified tokens and raw emails are rejected with 401 and audience is enforced."""
        from dataclasses import replace
        from unittest.mock import patch

        strict_settings = replace(
            self.settings,
            google_client_id="test-client-id.apps.googleusercontent.com",
            allow_dev_google_auth=False,
        )
        strict_client = TestClient(create_app(strict_settings))

        # 1. Raw email fallback must be rejected with 401
        r_raw = strict_client.post("/subscribers/google-auth", json={
            "credential": "attacker@gmail.com",
            "location_pref": "ALL",
        })
        self.assertEqual(r_raw.status_code, 401)

        # 2. Valid Google ID token verified with matching audience succeeds
        with patch("google.oauth2.id_token.verify_oauth2_token") as mock_verify:
            mock_verify.return_value = {
                "email": "real.user@gmail.com",
                "email_verified": True,
                "name": "Real User",
                "picture": "https://example.com/avatar.png",
            }
            r_ok = strict_client.post("/subscribers/google-auth", json={
                "credential": "header.payload.signature",
                "location_pref": "Himalayan Belt",
            })
            self.assertEqual(r_ok.status_code, 200)
            self.assertEqual(r_ok.json()["email"], "real.user@gmail.com")
            self.assertEqual(r_ok.json()["auth_provider"], "google")
            # Confirm audience was passed to google-auth
            self.assertEqual(mock_verify.call_args.kwargs.get("audience"), "test-client-id.apps.googleusercontent.com")

            # 3. Unverified Google email must be rejected
            mock_verify.return_value = {
                "email": "unverified@gmail.com",
                "email_verified": False,
            }
            r_unverified = strict_client.post("/subscribers/google-auth", json={
                "credential": "header.unverified.signature",
            })
            self.assertEqual(r_unverified.status_code, 400)

    def test_google_auth_access_token_verification(self):
        """Verify Google OAuth2 access_token flow (useGoogleLogin) enforces aud and fetches userinfo."""
        from dataclasses import replace
        from unittest.mock import MagicMock, patch

        strict_settings = replace(
            self.settings,
            google_client_id="test-client-id.apps.googleusercontent.com",
            allow_dev_google_auth=False,
        )
        strict_client = TestClient(create_app(strict_settings))

        def fake_get_ok(url, **kwargs):
            resp = MagicMock()
            resp.status_code = 200
            if "tokeninfo" in url:
                resp.json.return_value = {"aud": "test-client-id.apps.googleusercontent.com"}
            else:
                resp.json.return_value = {
                    "email": "oauth.popup@gmail.com",
                    "email_verified": True,
                    "name": "OAuth Popup User",
                    "picture": "https://example.com/pic.png",
                }
            return resp

        with patch("requests.get", side_effect=fake_get_ok):
            r_ok = strict_client.post("/subscribers/google-auth", json={
                "credential": "ya29.mock_access_token_value",
                "location_pref": "Northeast",
            })
            self.assertEqual(r_ok.status_code, 200)
            self.assertEqual(r_ok.json()["email"], "oauth.popup@gmail.com")
            self.assertEqual(r_ok.json()["auth_provider"], "google")

        def fake_get_bad_aud(url, **kwargs):
            resp = MagicMock()
            resp.status_code = 200
            resp.json.return_value = {"aud": "other-app.apps.googleusercontent.com"}
            return resp

        with patch("requests.get", side_effect=fake_get_bad_aud):
            r_bad = strict_client.post("/subscribers/google-auth", json={
                "credential": "ya29.wrong_audience_token",
            })
            self.assertEqual(r_bad.status_code, 401)

    def test_min_threshold_mm_persisted_on_register_and_google_auth(self):
        """Confirm custom min_threshold_mm and region are persisted on both email register and Google auth."""
        # 1. Email registration with custom region & threshold
        email = "custom_thresh@burstwatch.live"
        r_reg = self.client.post("/subscribers/register", json={
            "email": email,
            "location_pref": "Western Ghats",
            "min_threshold_mm": 80.0,
        })
        self.assertEqual(r_reg.status_code, 200)
        sub = self.store.get_subscriber(email)
        self.assertEqual(sub["location_pref"], "Western Ghats")
        self.assertEqual(sub["min_threshold_mm"], 80.0)

        # 2. Google auth with custom region & threshold
        r_g = self.client.post("/subscribers/google-auth", json={
            "credential": "google_thresh@gmail.com",
            "location_pref": "Northeast Corridors",
            "min_threshold_mm": 120.0,
        })
        self.assertEqual(r_g.status_code, 200)
        self.assertEqual(r_g.json()["location_pref"], "Northeast Corridors")
        self.assertEqual(r_g.json()["min_threshold_mm"], 120.0)

        # 3. Out-of-range threshold rejected with 422
        r_low = self.client.post("/subscribers/register", json={
            "email": "too_low@burstwatch.live",
            "min_threshold_mm": 5.0,
        })
        self.assertEqual(r_low.status_code, 422)

        r_high = self.client.post("/subscribers/google-auth", json={
            "credential": "too_high@gmail.com",
            "min_threshold_mm": 500.0,
        })
        self.assertEqual(r_high.status_code, 422)

    def test_email_deliverability_headers_and_templates(self):
        """Verify RFC 5322 headers, clean transactional subjects/HTML, zero localhost links, and conditional List-Unsubscribe."""
        from dataclasses import replace
        from unittest.mock import MagicMock, patch
        from app.email_service import EmailService

        smtp_settings = replace(
            self.settings,
            email_dev_mode=False,
            smtp_host="smtp.example.com",
            smtp_from="BurstWatch Alerts <alerts@example.com>",
            public_base_url="",
        )
        svc = EmailService(smtp_settings)

        sent_messages = []
        mock_server = MagicMock()
        mock_server.__enter__.return_value = mock_server
        mock_server.send_message.side_effect = lambda m: sent_messages.append(m)

        with patch("smtplib.SMTP", return_value=mock_server):
            res_otp = svc.send_verification_email("user@example.com", "654321", 15)
            self.assertTrue(res_otp["success"])

            res_alert_no_url = svc.send_alert_email(
                "user@example.com",
                {"location": "Kedarnath Valley", "predicted_probability": 0.85, "target_date": "2026-11-26", "threshold": 0.5},
                "tok123",
            )
            self.assertTrue(res_alert_no_url["success"])

            svc_with_url = EmailService(replace(smtp_settings, public_base_url="https://alerts.example.com"))
            res_alert_with_url = svc_with_url.send_alert_email(
                "user@example.com",
                {"location": "Western Ghats", "predicted_probability": 0.72, "target_date": "2026-11-26", "threshold": 0.5},
                "tok456",
            )
            self.assertTrue(res_alert_with_url["success"])

        self.assertEqual(len(sent_messages), 3)
        otp_msg, alert_no_url_msg, alert_with_url_msg = sent_messages

        for m in sent_messages:
            self.assertIsNotNone(m["Date"])
            self.assertIsNotNone(m["Message-ID"])
            self.assertEqual(m["Reply-To"], "alerts@example.com")
            self.assertNotIn("⚠️", m["Subject"])
            html_part = m.get_payload()[1].get_payload(decode=True).decode("utf-8")
            self.assertNotIn("localhost", html_part)
            self.assertNotIn("box-shadow", html_part)

        # OTP & no-public-url alert must not include List-Unsubscribe
        self.assertIsNone(otp_msg["List-Unsubscribe"])
        self.assertIsNone(alert_no_url_msg["List-Unsubscribe"])

        # Public HTTPS URL alert includes RFC 8058 List-Unsubscribe
        self.assertEqual(
            alert_with_url_msg["List-Unsubscribe"],
            "<https://alerts.example.com/subscribers/unsubscribe?token=tok456>",
        )

    def test_admin_routes_require_valid_api_key(self):
        """POST /subscribers/broadcast and GET /subscribers must return 401 without valid X-API-Key."""
        payload = {
            "subject": "Test Alert",
            "message": "Test body",
            "location": "ALL",
            "predicted_probability": 0.8,
            "threshold": 0.5,
        }
        self.assertEqual(self.client.post("/subscribers/broadcast", json=payload).status_code, 401)
        self.assertEqual(
            self.client.post("/subscribers/broadcast", json=payload, headers={"X-API-Key": "wrong"}).status_code,
            401,
        )
        self.assertEqual(self.client.get("/subscribers").status_code, 401)
        self.assertEqual(self.client.get("/subscribers", headers={"X-API-Key": "wrong"}).status_code, 401)
        self.assertEqual(
            self.client.get("/subscribers", headers={"X-API-Key": self.settings.admin_api_key}).status_code,
            200,
        )

    def test_jwt_requires_exp_and_sub_and_active_subscriber(self):
        """JWTs missing exp or sub, or belonging to unsubscribed users, must be rejected with 401."""
        import time
        import jwt

        email = "jwt_active_check@burstwatch.live"
        self.client.post("/subscribers/register", json={"email": email})
        code = self.store.get_subscriber(email)["verification_code"]
        verify_res = self.client.post("/subscribers/verify", json={"email": email, "code": code})
        token = verify_res.json()["access_token"]

        # 1. Missing exp
        no_exp = jwt.encode({"sub": email, "iat": int(time.time())}, self.settings.jwt_secret, algorithm="HS256")
        self.assertEqual(
            self.client.get("/subscribers/me", headers={"Authorization": f"Bearer {no_exp}"}).status_code,
            401,
        )

        # 2. Missing sub
        no_sub = jwt.encode(
            {"email": email, "exp": int(time.time()) + 3600},
            self.settings.jwt_secret,
            algorithm="HS256",
        )
        self.assertEqual(
            self.client.get("/subscribers/me", headers={"Authorization": f"Bearer {no_sub}"}).status_code,
            401,
        )

        # 3. Active subscriber succeeds
        self.assertEqual(
            self.client.get("/subscribers/me", headers={"Authorization": f"Bearer {token}"}).status_code,
            200,
        )

        # 4. After unsubscribing, existing JWT is rejected with 401
        unsub_token = self.store.get_subscriber(email)["unsubscribe_token"]
        self.store.unsubscribe(unsub_token)
        self.assertEqual(
            self.client.get("/subscribers/me", headers={"Authorization": f"Bearer {token}"}).status_code,
            401,
        )

    def test_google_auth_fails_closed_without_client_id(self):
        """When google_client_id is empty and allow_dev_google_auth is False, /subscribers/google-auth fails closed."""
        from dataclasses import replace
        from unittest.mock import patch

        unconfigured_settings = replace(
            self.settings,
            google_client_id="",
            allow_dev_google_auth=False,
        )
        client = TestClient(create_app(unconfigured_settings))
        with patch("google.oauth2.id_token.verify_oauth2_token") as mock_verify:
            res = client.post("/subscribers/google-auth", json={"credential": "a.b.c"})
            self.assertEqual(res.status_code, 503)
            mock_verify.assert_not_called()

    def test_subscriber_idor_pii_and_query_token_protections(self):
        """Verify IDOR protection on preferences/unsubscribe, PII redaction on status, and header-only /me."""
        email_a = "user_a@burstwatch.live"
        email_b = "user_b@burstwatch.live"

        for em in (email_a, email_b):
            self.client.post("/subscribers/register", json={"email": em, "location_pref": "Western Ghats"})
            code = self.store.get_subscriber(em)["verification_code"]
            self.client.post("/subscribers/verify", json={"email": em, "code": code})

        code_a_res = self.client.post("/subscribers/google-auth", json={"credential": email_a, "location_pref": "Western Ghats"})
        token_a = code_a_res.json()["access_token"]

        # 1. Preferences without Bearer -> 401
        self.assertEqual(
            self.client.post("/subscribers/preferences", json={"email": email_a, "location_pref": "ALL"}).status_code,
            401,
        )
        # 2. Preferences for user B with user A's Bearer -> 403
        self.assertEqual(
            self.client.post(
                "/subscribers/preferences",
                json={"email": email_b, "location_pref": "ALL"},
                headers={"Authorization": f"Bearer {token_a}"},
            ).status_code,
            403,
        )

        # 3. Unauthenticated email-only POST unsubscribe -> 401
        self.assertEqual(
            self.client.post("/subscribers/unsubscribe", json={"email": email_b}).status_code,
            401,
        )
        # User A cannot unsubscribe user B with user A's Bearer -> 403
        self.assertEqual(
            self.client.post(
                "/subscribers/unsubscribe",
                json={"email": email_b},
                headers={"Authorization": f"Bearer {token_a}"},
            ).status_code,
            403,
        )

        # 4. /subscribers/status without Bearer omits PII fields; with matching Bearer includes them
        status_anon = self.client.get(f"/subscribers/status?email={email_a}")
        self.assertEqual(status_anon.status_code, 200)
        anon_json = status_anon.json()
        self.assertEqual(anon_json["status"], "verified")
        self.assertNotIn("name", anon_json)
        self.assertNotIn("picture", anon_json)
        self.assertNotIn("location_pref", anon_json)
        self.assertNotIn("min_threshold_mm", anon_json)

        status_auth = self.client.get(
            f"/subscribers/status?email={email_a}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        self.assertEqual(status_auth.status_code, 200)
        auth_json = status_auth.json()
        self.assertIn("location_pref", auth_json)
        self.assertIn("min_threshold_mm", auth_json)

        # 5. /subscribers/me?token=<jwt> without Authorization header -> 401
        self.assertEqual(self.client.get(f"/subscribers/me?token={token_a}").status_code, 401)


if __name__ == "__main__":
    unittest.main()
