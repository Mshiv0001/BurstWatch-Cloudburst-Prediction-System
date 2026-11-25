"""Tests for backend SystemCache and cache API endpoints."""
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.bootstrap import build_service
from backend.app.cache import SystemCache
from backend.app.main import create_app
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


if __name__ == "__main__":
    unittest.main()
