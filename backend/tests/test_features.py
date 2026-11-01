import datetime as dt
import unittest

import pandas as pd

from app.features import build_feature_plan, compute_daily_features, compute_physics_features, hourly_variables
from tests.helpers import FEATURES, synthetic_hourly

DAY = dt.date(2026, 7, 15)


class FeatureTests(unittest.TestCase):
    def setUp(self):
        self.plan = build_feature_plan(FEATURES)

    def test_plan_covers_every_model_feature(self):
        self.assertEqual(set(self.plan), set(FEATURES))
        self.assertGreaterEqual(len(hourly_variables(self.plan)), 5)

    def test_unknown_feature_is_rejected(self):
        with self.assertRaises(ValueError):
            build_feature_plan(["mystery_value"])

    def test_physics_feature_computation(self):
        raw = {
            "elevation_m": 3549.0,
            "slope_deg": 6.37,
            "aspect_deg": 28.6,
            "temperature_c": 20.0,
            "dew_point_c": 19.5,
            "relative_humidity_pct": 97.0,
            "surface_pressure_hpa": 653.6,
            "wind_speed_kmh": 28.0,
        }
        phys = compute_physics_features(raw)
        self.assertIn("theta_e_k", phys)
        self.assertIn("valley_trapping_index", phys)
        self.assertIn("orographic_lift_ms", phys)
        self.assertIn("dew_point_depression_c", phys)
        self.assertEqual(phys["dew_point_depression_c"], 0.5)
        self.assertGreater(phys["theta_e_k"], 350.0)

    def test_daily_features_from_hourly(self):
        hourly = synthetic_hourly(DAY, wet=True)
        terrain = {"elevation_m": 3549.0, "slope_deg": 6.37, "aspect_deg": 28.6}
        feats = compute_daily_features(hourly, DAY, self.plan, terrain=terrain)
        for f in FEATURES:
            self.assertIn(f, feats)
            self.assertIsNotNone(feats[f])


if __name__ == "__main__":
    unittest.main()
