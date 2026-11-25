"""Dedicated security regression test suite (Phase 20 ShieldAura)."""
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.email_service import EmailService
from app.main import _parse_gdacs_rss, create_app
from app.storage import Store


def _make_settings(db_path: Path, cors_origins=("http://localhost:3000", "http://localhost:5173")) -> Settings:
    base_dir = Path(__file__).resolve().parent.parent
    return Settings(
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
        admin_api_key="test-admin-key",
        cors_origins=cors_origins,
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
        allow_dev_google_auth=False,
    )


class SecurityHardeningTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmpdir.name) / "sec_test.db"
        self.settings = _make_settings(self.db_path)
        self.app = create_app(settings=self.settings)
        self.client = TestClient(self.app)
        self.store = Store(self.db_path)

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_security_headers_present_on_health(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("x-content-type-options"), "nosniff")
        self.assertEqual(res.headers.get("x-frame-options"), "DENY")
        self.assertEqual(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin")
        self.assertEqual(res.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=(self)")
        self.assertEqual(res.headers.get("cross-origin-opener-policy"), "same-origin-allow-popups")

    def test_default_cors_blocks_arbitrary_origin(self):
        default_settings = Settings.from_env()
        self.assertNotIn("*", default_settings.cors_origins)

        res = self.client.get("/health", headers={"Origin": "https://evil.example"})
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.headers.get("access-control-allow-origin"))

        allowed_res = self.client.get("/health", headers={"Origin": "http://localhost:5173"})
        self.assertEqual(allowed_res.headers.get("access-control-allow-origin"), "http://localhost:5173")

    def test_rate_limiting_on_register_and_predict_location(self):
        # /subscribers/register limit is 5 / 60s
        for i in range(5):
            r = self.client.post("/subscribers/register", json={"email": f"rate{i}@burstwatch.live"})
            self.assertEqual(r.status_code, 200)
        r_limited = self.client.post("/subscribers/register", json={"email": "rate_over@burstwatch.live"})
        self.assertEqual(r_limited.status_code, 429)

        # /predict/location limit is 20 / 60s (use invalid lat/lon? no, dependency runs before/with validation or after body parse; use valid body or check 429)
        for _ in range(20):
            self.client.post("/predict/location", json={"latitude": 999.0, "longitude": 0.0})
        r_loc_limited = self.client.post("/predict/location", json={"latitude": 30.7, "longitude": 79.0})
        self.assertEqual(r_loc_limited.status_code, 429)

    def test_otp_resend_cooldown_preserves_brute_force_lockout(self):
        email = "cooldown_target@burstwatch.live"
        r_reg = self.client.post("/subscribers/register", json={"email": email})
        self.assertEqual(r_reg.status_code, 200)

        # Lock out via 5 failed OTP attempts
        for _ in range(5):
            self.client.post("/subscribers/verify", json={"email": email, "code": "000000"})

        # Immediate resend must be blocked with 429 and NOT reset failed_attempts
        r_resend = self.client.post("/subscribers/resend", json={"email": email})
        self.assertEqual(r_resend.status_code, 429)
        sub = self.store.get_subscriber(email)
        self.assertEqual(sub["failed_attempts"], 5)

        # Immediate re-registration must also be blocked with 429
        r_rereg = self.client.post("/subscribers/register", json={"email": email})
        self.assertEqual(r_rereg.status_code, 429)

    def test_gdacs_xml_rejects_doctype_entity_and_oversize(self):
        xxe_payload = b'<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss/>'
        with self.assertRaises(ValueError):
            _parse_gdacs_rss(xxe_payload)

        oversized = b"<rss>" + (b"A" * 2_097_153)
        with self.assertRaises(ValueError):
            _parse_gdacs_rss(oversized)

    def test_email_html_escapes_script_injection(self):
        svc = EmailService(self.settings)
        rendered = svc._render_alert_html(
            {
                "location": '<script>alert(1)</script>',
                "predicted_probability": 0.9,
                "target_date": '<b>2026-11-26</b>',
                "threshold": 0.5,
            },
            "tok123",
        )
        self.assertNotIn("<script>alert(1)</script>", rendered)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", rendered)
        self.assertNotIn("<b>2026-11-26</b>", rendered)

    def test_email_broadcast_schema_bounds(self):
        headers = {"X-API-Key": self.settings.admin_api_key}
        bad_prob_high = self.client.post(
            "/subscribers/broadcast",
            json={"subject": "Valid Subject", "message": "Valid body text", "predicted_probability": 1.5},
            headers=headers,
        )
        self.assertEqual(bad_prob_high.status_code, 422)

        bad_prob_low = self.client.post(
            "/subscribers/broadcast",
            json={"subject": "Valid Subject", "message": "Valid body text", "predicted_probability": -0.1},
            headers=headers,
        )
        self.assertEqual(bad_prob_low.status_code, 422)

        oversized_subject = self.client.post(
            "/subscribers/broadcast",
            json={"subject": "S" * 201, "message": "Valid body text"},
            headers=headers,
        )
        self.assertEqual(oversized_subject.status_code, 422)


if __name__ == "__main__":
    unittest.main()
