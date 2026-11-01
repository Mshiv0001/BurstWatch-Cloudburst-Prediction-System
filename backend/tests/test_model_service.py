import unittest
import warnings
from pathlib import Path

from app.config import BASE_DIR
from app.features import build_feature_plan, compute_physics_features
from app.model_service import InsufficientDataError, ModelService

warnings.filterwarnings("ignore")


class ModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = ModelService(BASE_DIR / "model" / "stage1_risk_scorer.pkl",
                             BASE_DIR / "model" / "model_metadata.json",
                             allow_version_mismatch=True)
        cls.plan = build_feature_plan(cls.m.features)
        cls.baseline = {
            "elevation_m": 3549.0,
            "slope_deg": 6.37,
            "aspect_deg": 28.6,
            "temperature_c": 12.0,
            "dew_point_c": 4.0,
            "dew_point_depression_c": 8.0,
            "relative_humidity_pct": 58.0,
            "surface_pressure_hpa": 720.0,
            "wind_speed_kmh": 6.0,
            "theta_e_k": 320.0,
            "valley_trapping_index": 0.05,
            "orographic_lift_ms": 0.15,
        }

    def test_loads_and_matches_metadata(self):
        self.assertEqual(len(self.m.features), 12)
        self.assertEqual(self.m.threshold, 0.18)
        self.assertTrue(self.m.is_ensemble)

    def test_baseline_input_is_low_risk(self):
        r = self.m.predict(self.baseline)
        self.assertTrue(0.0 <= r["predicted_probability"] <= 1.0)
        self.assertEqual(r["prediction"], 0)
        self.assertEqual(r["alert_tier"], "GREEN_NORMAL")
        self.assertEqual(r["missing_features"], [])
        self.assertGreaterEqual(len(r["top_factors"]), 1)

    def test_extreme_convective_triggers_warning(self):
        # Historical Kedarnath disaster event parameters
        raw_kedarnath = {
            "elevation_m": 3549.0,
            "slope_deg": 6.37,
            "aspect_deg": 180.0,
            "temperature_c": 20.0,
            "dew_point_c": 19.5,
            "relative_humidity_pct": 97.0,
            "surface_pressure_hpa": 653.6,
            "wind_speed_kmh": 28.0,
        }
        convective_storm = compute_physics_features(raw_kedarnath)
        r = self.m.predict(convective_storm)
        self.assertGreater(r["predicted_probability"], self.m.threshold)
        self.assertEqual(r["prediction"], 1)
        self.assertEqual(r["alert_tier"], "RED_WARNING")
        self.assertEqual(r["convective_risk_index_cri"], 100.0)

    def test_missing_values_are_imputed_within_limit(self):
        feats = dict(self.baseline)
        feats["wind_speed_kmh"] = None
        r = self.m.predict(feats)
        self.assertEqual(r["missing_features"], ["wind_speed_kmh"])
        self.assertTrue(r["warnings"])

    def test_too_many_missing_is_refused(self):
        with self.assertRaises(InsufficientDataError):
            self.m.predict({"temperature_c": 20.0})

    def test_extra_metadata_keys_are_safely_ignored(self):
        r = self.m.predict({**self.baseline, "station_name": "Test Valley", "event_id": "EVT_TEST"})
        self.assertEqual(r["prediction"], 0)


if __name__ == "__main__":
    unittest.main()
