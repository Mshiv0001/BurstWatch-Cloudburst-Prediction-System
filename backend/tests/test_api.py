"""HTTP-level tests. Skipped automatically when fastapi/httpx aren't installed."""
import datetime as dt
import tempfile
import unittest
import warnings

try:
    from fastapi.testclient import TestClient
    HAVE_FASTAPI = True
except Exception:  # noqa: BLE001
    HAVE_FASTAPI = False

from tests.helpers import FEATURES, make_settings, synthetic_hourly
from tests.test_pipeline import FakeNotifier, FakeWeather

warnings.filterwarnings("ignore")
DAY = dt.date(2026, 7, 15)


@unittest.skipUnless(HAVE_FASTAPI, "fastapi/httpx not installed")
class ApiTests(unittest.TestCase):
    def setUp(self):
        from app.bootstrap import build_service
        from app.main import create_app
        settings = make_settings(tempfile.mkdtemp(), admin_api_key="secret")
        self.svc = build_service(settings)
        self.svc.weather = FakeWeather(synthetic_hourly(DAY, wet=True))
        self.svc.notifier = FakeNotifier()
        self.svc.today = lambda: DAY
        self.client = TestClient(create_app(settings, self.svc))
        self.h = {"X-API-Key": "secret"}

    def test_health_and_model_info(self):
        self.assertEqual(self.client.get("/health").json()["status"], "ok")
        self.assertEqual(self.client.get("/model-info").json()["n_features"], 36)

    def test_latest_404_then_available_after_run(self):
        self.assertEqual(self.client.get("/predictions/latest").status_code, 404)
        self.assertEqual(self.client.post("/predictions/run", json={}, headers=self.h).status_code, 200)
        body = self.client.get("/predictions/latest").json()
        self.assertEqual(body["target_date"], "2026-07-16"); self.assertFalse(body["stale"])

    def test_admin_requires_key(self):
        self.assertEqual(self.client.post("/predictions/run", json={}).status_code, 401)
        self.assertEqual(self.client.post("/predictions/run", json={}, headers={"X-API-Key": "no"}).status_code, 401)

    def test_manual_predict_validation(self):
        self.assertEqual(self.client.post("/predict", json={"bogus": 1}).status_code, 422)
        self.assertEqual(self.client.post("/predict", json={"year": 2024}).status_code, 422)   # too many missing

    def test_location_prediction_uses_requested_coordinates_without_persisting(self):
        r = self.client.post("/predict/location", json={
            "latitude": 31.7,
            "longitude": 78.1,
            "feature_date": DAY.isoformat(),
        })
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("predicted_probability", body)
        self.assertIn("risk_label", body)
        self.assertEqual(body["feature_date"], DAY.isoformat())
        self.assertEqual(body["target_date"], "2026-07-16")
        self.assertEqual(body["location"], {"latitude": 31.7, "longitude": 78.1})
        self.assertEqual(len(body["missing_features"]), 0)
        self.assertTrue(any("Dehradun region" in warning for warning in body["warnings"]))
        self.assertEqual(self.svc.weather.calls[-1], (DAY, "auto", 31.7, 78.1))
        self.assertIsNone(self.svc.store.latest_prediction())

    def test_location_prediction_rejects_invalid_coordinates(self):
        r = self.client.post("/predict/location", json={"latitude": 91, "longitude": 78})
        self.assertEqual(r.status_code, 422)
        self.assertEqual(self.svc.weather.calls, [])

    def test_location_prediction_reports_weather_provider_failure(self):
        self.svc.weather = FakeWeather(None, fail=True)
        r = self.client.post("/predict/location", json={"latitude": 30.3, "longitude": 78.0})
        self.assertEqual(r.status_code, 502)
        self.assertIn("Weather data unavailable", r.json()["detail"])

    def test_outcome_and_metrics(self):
        self.client.post("/predictions/run", json={}, headers=self.h)
        r = self.client.put("/outcomes/2026-07-16", json={"observed_max_rainfall_mm": 72}, headers=self.h)
        self.assertTrue(r.json()["extreme"])
        self.assertEqual(self.client.get("/metrics/live").json()["evaluated_days"], 1)


if __name__ == "__main__":
    unittest.main()
