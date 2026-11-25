"""Tests for backend SystemCache and cache API endpoints."""
import datetime as dt
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
from fastapi.testclient import TestClient

from backend.app.bootstrap import build_service
from backend.app.cache import SystemCache, system_cache
from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.weather import OpenMeteoClient, WeatherError
from backend.tests.helpers import make_settings
from backend.tests.test_pipeline import FakeWeather


class TestSystemCache(unittest.TestCase):
    def test_set_get_ttl_and_lru_eviction(self):
        cache = SystemCache(max_entries=2, default_ttl_seconds=60.0)
        cache.set("ns", "a", 1)
        cache.set("ns", "b", 2)
        self.assertEqual(cache.get("ns", "a"), 1)
        # 'b' is now least recently used; adding 'c' evicts 'b'
        cache.set("ns", "c", 3)
        self.assertIsNone(cache.get("ns", "b"))
        self.assertEqual(cache.get("ns", "a"), 1)
        self.assertEqual(cache.get("ns", "c"), 3)

        # Expired entry is evicted on read
        cache.set("ns", "short", 99, ttl_seconds=0.0)
        self.assertIsNone(cache.get("ns", "short"))

        stats = cache.stats()
        self.assertGreaterEqual(stats["hits"], 3)
        self.assertGreaterEqual(stats["misses"], 2)

    def test_disk_namespace_persistence_and_invalidation(self):
        with tempfile.TemporaryDirectory() as tmp:
            disk_file = Path(tmp) / "cache" / "terrain.json"
            c1 = SystemCache(max_entries=10, default_ttl_seconds=60.0)
            c1.register_disk_namespace("terrain", disk_file, ttl_seconds=60.0)
            c1.set("terrain", "30.7_79.0", {"elevation_m": 3500.0})
            self.assertTrue(disk_file.exists())

            c2 = SystemCache(max_entries=10, default_ttl_seconds=60.0)
            c2.register_disk_namespace("terrain", disk_file, ttl_seconds=60.0)
            self.assertEqual(c2.get("terrain", "30.7_79.0"), {"elevation_m": 3500.0})

            removed = c2.invalidate("terrain")
            self.assertEqual(removed, 1)
            self.assertIsNone(c2.get("terrain", "30.7_79.0"))


class TestCacheEndpoints(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.settings = make_settings(Path(self.tmp.name), admin_api_key="secret")
        svc = build_service(self.settings)
        svc.weather = FakeWeather(None)
        self.app = create_app(self.settings, svc)
        self.client = TestClient(self.app)
        self.admin_headers = {"X-API-Key": self.settings.admin_api_key}

    def tearDown(self):
        self.tmp.cleanup()

    def test_cache_stats_and_admin_invalidate(self):
        r = self.client.get("/cache/stats")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("api_cache", body)
        self.assertIn("shared_cache", body)

        # Invalidate requires admin
        r_unauth = self.client.post("/admin/cache/invalidate")
        self.assertEqual(r_unauth.status_code, 401)

        r_ok = self.client.post("/admin/cache/invalidate?namespace=cyclones", headers=self.admin_headers)
        self.assertEqual(r_ok.status_code, 200)
        self.assertEqual(r_ok.json()["namespace"], "cyclones")


class TestOpenMeteoQuota(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        system_cache.invalidate("forecast_hourly")
        system_cache.invalidate("forecast_hourly_stale")

    def tearDown(self):
        self.tmp.cleanup()

    def _make_client(self, enable_fallback=False):
        s = make_settings(
            Path(self.tmp.name),
            enable_weather_fallback=enable_fallback,
            http_retries=0,
            http_timeout=5,
            openmeteo_models="",
            openmeteo_api_key="",
        )
        return OpenMeteoClient(settings=s, variables=["temperature_2m"])

    def _dummy_df(self):
        return pd.DataFrame(
            {"temperature_2m": [20.0] * 24},
            index=pd.date_range("2026-01-01", periods=24, freq="h"),
        )

    def test_429_sets_quota_window(self):
        client = self._make_client()
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        with patch.object(client.session, "get", return_value=mock_resp):
            with self.assertRaises(WeatherError):
                client.fetch_hourly(dt.date(2026, 1, 1), today=dt.date(2026, 1, 1))
        self.assertGreater(client._quota_reset_at, 0, "quota_reset_at should be set after 429")

    def test_quota_window_serves_stale_cache(self):
        client = self._make_client()
        dummy = self._dummy_df()
        cache_key = f"{client.s.latitude:.4f}_{client.s.longitude:.4f}_2026-01-01_forecast"
        system_cache.set(client._forecast_ns, cache_key, (dummy, "forecast"), ttl_seconds=21600.0)
        client._quota_reset_at = time.monotonic() + 60
        df, source = client.fetch_hourly(dt.date(2026, 1, 1), today=dt.date(2026, 1, 1))
        self.assertIn("stale_cache", source)
        self.assertEqual(len(df), 24)

    def test_no_cache_plus_429_raises(self):
        client = self._make_client(enable_fallback=False)
        client._quota_reset_at = time.monotonic() + 60
        with self.assertRaises(WeatherError) as ctx:
            client.fetch_hourly(dt.date(2026, 1, 1), today=dt.date(2026, 1, 1))
        self.assertTrue("429" in str(ctx.exception) or "quota" in str(ctx.exception).lower())


if __name__ == "__main__":
    unittest.main()
