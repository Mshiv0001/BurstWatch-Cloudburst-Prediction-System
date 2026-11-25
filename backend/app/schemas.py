"""Pydantic request models."""
import datetime as dt
from typing import Literal, Optional, Type

from pydantic import BaseModel, ConfigDict, Field, create_model


def make_feature_model(feature_names) -> Type[BaseModel]:
    """Request body for POST /predict, built from model_metadata.json.
    Every feature is optional (the model imputes), unknown names are rejected."""
    fields = {name: (Optional[float], None) for name in feature_names}
    return create_model("FeatureInput", __config__=ConfigDict(extra="forbid"), **fields)


class RunRequest(BaseModel):
    feature_date: Optional[dt.date] = Field(
        default=None, description="Day whose weather is used as input (default: today, local time). "
                                  "The prediction is for the following day.")
    source: Literal["auto", "forecast", "archive"] = "auto"
    persist: bool = True
    notify: bool = True


class LocationPredictionRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    feature_date: Optional[dt.date] = Field(
        default=None,
        description="Day whose weather is used as input (default: today in the configured timezone).",
    )
    source: Literal["auto", "forecast", "archive"] = "auto"


class LocationPredictionResponse(BaseModel):
    """Extended prediction response with cache and staleness metadata."""
    cached: bool = False
    cache_age_seconds: int = 0
    stale: bool = False
    stale_minutes: Optional[int] = None
    stale_reason: Optional[str] = None

    class Config:
        extra = "allow"


class OutcomeRequest(BaseModel):
    observed_max_rainfall_mm: float = Field(
        ge=0, description="Observed maximum daily rainfall (mm) across the region on the target date, "
                          "e.g. from IMD gridded data.")
    source: str = Field("IMD", max_length=64)


EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"


class SubscriberRegisterRequest(BaseModel):
    email: str = Field(..., max_length=254, pattern=EMAIL_REGEX, description="Valid email address")
    location_pref: Optional[str] = Field("ALL", max_length=100, description="Location preference (ALL, Pan-India, or specific station)")
    min_threshold_mm: Optional[float] = Field(50.0, ge=10.0, le=300.0, description="Minimum 24h rainfall trigger in mm")


class SubscriberVerifyRequest(BaseModel):
    email: str = Field(..., max_length=254, pattern=EMAIL_REGEX)
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$", description="6-digit verification OTP")


class SubscriberResendRequest(BaseModel):
    email: str = Field(..., max_length=254, pattern=EMAIL_REGEX)


class SubscriberUnsubscribeRequest(BaseModel):
    email: Optional[str] = Field(None, max_length=254)
    token: Optional[str] = Field(None, max_length=128)


class SubscriberGoogleAuthRequest(BaseModel):
    credential: str = Field(..., min_length=5, max_length=8192, description="Google OAuth2 ID token JWT or simulated developer credential")
    location_pref: Optional[str] = Field("ALL", max_length=100, description="Location preference")
    min_threshold_mm: Optional[float] = Field(50.0, ge=10.0, le=300.0, description="Minimum 24h rainfall trigger in mm")


class SubscriberPreferencesRequest(BaseModel):
    email: Optional[str] = Field(None, max_length=254)
    location_pref: Optional[str] = Field(None, max_length=100)
    min_threshold_mm: Optional[float] = Field(None, ge=10.0, le=300.0)


class EmailBroadcastRequest(BaseModel):
    subject: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=5, max_length=5000)
    location: Optional[str] = Field("Kedarnath Valley", max_length=100)
    predicted_probability: float = Field(0.85, ge=0.0, le=1.0)
    threshold: float = Field(0.50, ge=0.0, le=1.0)

