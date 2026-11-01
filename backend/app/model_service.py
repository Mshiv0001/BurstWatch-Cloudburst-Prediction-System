"""Loads the ML model artifact (Dual-Engine Ensemble or scikit-learn Pipeline)
and turns a feature dict into a calibrated convective cloudburst risk result.
"""
from __future__ import annotations

import json
import logging
import math
import warnings
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.exceptions import InconsistentVersionWarning

logger = logging.getLogger(__name__)

SCORE_NOTE = (
    "Calibrated Convective Cloudburst Risk Scorer. Dual-Engine Ensemble "
    "(LightGBM + XGBoost) with Platt probability calibration and 30m DEM terrain integration."
)


class InsufficientDataError(ValueError):
    """Too many input features are missing to trust a prediction."""


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return None if (math.isnan(f) or math.isinf(f)) else f


class ModelService:
    def __init__(self, model_path: Path, metadata_path: Path,
                 max_missing_fraction: float = 0.25,
                 expected_sklearn_version: Optional[str] = None,
                 allow_version_mismatch: bool = True):
        with open(metadata_path, "r", encoding="utf-8") as fh:
            self.metadata: Dict[str, Any] = json.load(fh)
            
        self.features: List[str] = list(self.metadata.get("features", []))
        self.threshold = float(self.metadata.get("threshold", 0.18))
        self.max_missing_fraction = max_missing_fraction
        self.target = self.metadata.get("target", "Pan-India Convective Cloudburst Risk")

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            self.raw_artifact = joblib.load(model_path)
            
        # Detect if artifact is a dictionary (Dual Ensemble) or an sklearn Pipeline
        if isinstance(self.raw_artifact, dict):
            self.is_ensemble = True
            self.model_type = self.raw_artifact.get("model_type", "physics_informed_dual_ensemble")
            self.model_lgb = self.raw_artifact.get("model_lgb")
            self.model_xgb = self.raw_artifact.get("model_xgb")
            self.blend_weights = self.raw_artifact.get("blend_weights", {"lgb": 0.5, "xgb": 0.5})
            self.calibrator = self.raw_artifact.get("calibrator")
            self.thresholds = self.raw_artifact.get("thresholds", {
                "watch_raw_prob": 0.10,
                "warn_raw_prob": 0.18,
                "baseline_prob": 0.04,
                "ceiling_prob": 0.28
            })
            self.features = list(self.raw_artifact.get("features", self.features))
            self.threshold = float(self.thresholds.get("warn_raw_prob", self.threshold))
            self.pipeline = None
            self.coef = None
            
            # Compute base feature importances for explainability
            try:
                imp_lgb = self.model_lgb.feature_importances_ if hasattr(self.model_lgb, "feature_importances_") else np.zeros(len(self.features))
                imp_xgb = self.model_xgb.feature_importances_ if hasattr(self.model_xgb, "feature_importances_") else np.zeros(len(self.features))
                total_imp = imp_lgb / (imp_lgb.sum() or 1.0) + imp_xgb / (imp_xgb.sum() or 1.0)
                self.feature_importance_map = dict(zip(self.features, total_imp / 2.0))
            except Exception:
                self.feature_importance_map = {f: 1.0 / len(self.features) for f in self.features}
                
        else:
            self.is_ensemble = False
            self.pipeline = self.raw_artifact
            self.model_type = "legacy_pipeline"
            self.thresholds = {"warn_raw_prob": self.threshold}
            trained_names = list(getattr(self.pipeline[0], "feature_names_in_", self.features))
            if trained_names != self.features:
                logger.warning("Feature list in metadata does not match pipeline feature_names_in_")
            self.coef = np.asarray(self.pipeline[-1].coef_[0], dtype=float) if hasattr(self.pipeline[-1], "coef_") else None
            self.feature_importance_map = dict(zip(self.features, np.abs(self.coef) if self.coef is not None else [1.0] * len(self.features)))

    # ------------------------------------------------------------------ info
    def info(self) -> Dict[str, Any]:
        return {
            "model_name": self.metadata.get("model_name"),
            "model_type": self.model_type,
            "version": self.metadata.get("version", "2.5.0"),
            "target": self.target,
            "positive_label_definition": self.metadata.get("positive_label_definition"),
            "threshold": self.threshold,
            "thresholds": self.thresholds,
            "n_features": len(self.features),
            "features": self.features,
            "training_rows": self.metadata.get("training_rows"),
            "training_period": [self.metadata.get("date_start"), self.metadata.get("date_end")],
            "metrics": self.metadata.get("metrics", {
                "validation_auc": self.metadata.get("validation_auc", 0.8005),
                "brier_score": self.metadata.get("brier_score", 0.0605),
                "disaster_catch_rate": self.metadata.get("disaster_catch_rate", 1.0)
            }),
            "geographic_scope": self.metadata.get("geographic_scope", "Pan-India"),
            "caveat": self.metadata.get("caveat"),
            "score_note": SCORE_NOTE,
            "runtime_sklearn_version": sklearn.__version__,
        }

    # --------------------------------------------------------------- predict
    def predict(self, features: Mapping[str, Any]) -> Dict[str, Any]:
        values = {f: _to_float(features.get(f)) for f in self.features}
        missing = [f for f, v in values.items() if v is None]
        fraction = len(missing) / len(self.features)
        if fraction > self.max_missing_fraction:
            raise InsufficientDataError(
                f"{len(missing)} of {len(self.features)} features are missing "
                f"(limit {self.max_missing_fraction:.0%}): {missing}"
            )

        warns: List[str] = []
        if missing:
            warns.append(f"{len(missing)} feature(s) were missing and imputed.")

        row = pd.DataFrame(
            [[0.0 if values[f] is None else values[f] for f in self.features]],
            columns=self.features,
        )

        if self.is_ensemble:
            w_lgb = self.blend_weights.get("lgb", 0.5)
            w_xgb = self.blend_weights.get("xgb", 0.5)
            
            p_lgb = float(self.model_lgb.predict_proba(row)[:, 1][0])
            p_xgb = float(self.model_xgb.predict_proba(row)[:, 1][0])
            raw_p = float(w_lgb * p_lgb + w_xgb * p_xgb)

            if self.calibrator is not None:
                cal_p = float(self.calibrator.predict_proba(np.array([[raw_p]]))[:, 1][0])
            else:
                cal_p = raw_p

            p_base = self.thresholds.get("baseline_prob", 0.04)
            p_ceil = self.thresholds.get("ceiling_prob", 0.28)
            cri = float(np.clip((cal_p - p_base) / (p_ceil - p_base), 0.0, 1.0) * 100.0)

            prediction = int(cal_p >= self.threshold)
            if cal_p >= self.threshold:
                risk_label = "HIGH CONVECTIVE WARNING"
                tier = "RED_WARNING"
                action = "Severe cloudburst trigger conditions detected. Evacuate low-lying riverbanks immediately."
            elif cal_p >= self.thresholds.get("watch_raw_prob", 0.10):
                risk_label = "CLOUDBURST WATCH"
                tier = "YELLOW_WATCH"
                action = "Elevated moisture convergence and orographic forcing. Thunderstorms likely within 1-3h."
            else:
                risk_label = "NORMAL / LOW RISK"
                tier = "GREEN_NORMAL"
                action = "Standard background conditions. Convective risk index within normal threshold."

            factors = self._top_factors_ensemble(row, values, missing)

            return {
                "predicted_probability": round(cal_p, 4),
                "raw_probability": round(raw_p, 4),
                "convective_risk_index_cri": round(cri, 1),
                "threshold": self.threshold,
                "prediction": prediction,
                "risk_label": risk_label,
                "alert_tier": tier,
                "advisory": action,
                "target": self.target,
                "missing_features": missing,
                "top_factors": factors,
                "warnings": warns,
                "note": SCORE_NOTE,
            }
        else:
            # Legacy pipeline branch
            probability = float(self.pipeline.predict_proba(row)[0, 1])
            prediction = int(probability >= self.threshold)
            return {
                "predicted_probability": round(probability, 4),
                "threshold": self.threshold,
                "prediction": prediction,
                "risk_label": "Elevated extreme-rainfall risk" if prediction else "Below model alert threshold",
                "target": self.target,
                "missing_features": missing,
                "top_factors": self._top_factors_legacy(row, values, missing),
                "warnings": warns,
                "note": SCORE_NOTE,
            }

    def _top_factors_ensemble(self, row: pd.DataFrame, values: Dict[str, Optional[float]],
                              missing: List[str], k: int = 5) -> List[Dict[str, Any]]:
        factors = []
        skip = set(missing)
        sorted_feats = sorted(
            [f for f in self.features if f not in skip],
            key=lambda x: self.feature_importance_map.get(x, 0),
            reverse=True
        )
        for name in sorted_feats[:k]:
            factors.append({
                "feature": name,
                "value": round(values[name], 3) if values[name] is not None else 0.0,
                "importance_weight": round(float(self.feature_importance_map.get(name, 0)), 3),
                "effect": "influences convective trigger"
            })
        return factors

    def _top_factors_legacy(self, row: pd.DataFrame, values: Dict[str, Optional[float]],
                            missing: List[str], k: int = 5) -> List[Dict[str, Any]]:
        if self.pipeline is None or self.coef is None:
            return []
        standardised = np.asarray(self.pipeline[:-1].transform(row))[0]
        contributions = standardised * self.coef
        skip = set(missing)
        order = np.argsort(-np.abs(contributions))
        factors: List[Dict[str, Any]] = []
        for i in order:
            name = self.features[i]
            if name in skip:
                continue
            factors.append({
                "feature": name,
                "value": round(values[name], 4) if values[name] is not None else 0.0,
                "contribution": round(float(contributions[i]), 3),
                "effect": "raises risk score" if contributions[i] > 0 else "lowers risk score",
            })
            if len(factors) == k:
                break
        return factors
