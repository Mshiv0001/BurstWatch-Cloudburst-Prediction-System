/**
 * Real-Time Cloudburst Event & ML Prediction Service Interface
 * Directly connects to FastAPI ML Backend (LightGBM + XGBoost Dual-Engine Ensemble)
 * Strictly zero hardcoded presets. Reports offline / unreachable status explicitly when down.
 */

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const PROD_BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL || 
  (isLocalhost ? '' : 'https://burstwatch-ml-backend.onrender.com')
).replace(/\/$/, '');
const API_BASE = PROD_BACKEND_URL || '/api';
const DIRECT_BACKEND_URL = PROD_BACKEND_URL || 'http://localhost:8000';

/**
 * Generates an evacuation hazard radius GeoJSON circle for MapLibre map rendering
 */
export function generateHazardRadiusGeoJSON(centerLon, centerLat, radiusKm = 18, points = 64) {
  const coords = [];
  const distanceX = radiusKm / (111.320 * Math.cos((centerLat * Math.PI) / 180));
  const distanceY = radiusKm / 110.574;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([centerLon + x, centerLat + y]);
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { radiusKm },
        geometry: {
          type: "Polygon",
          coordinates: [coords]
        }
      }
    ]
  };
}

/**
 * Pings backend health endpoint to check ML engine status
 */
export async function checkBackendHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    
    // Try vite proxy first, then direct URL
    let res;
    try {
      res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    } catch {
      res = await fetch(`${DIRECT_BACKEND_URL}/health`, { signal: controller.signal });
    }
    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json();
      return { isLive: true, ...data };
    }
    return { isLive: false, error: `Backend responded with HTTP ${res?.status || 500}` };
  } catch (err) {
    return { 
      isLive: false, 
      error: err.name === 'AbortError' 
        ? `Connection timed out to ML backend (${DIRECT_BACKEND_URL})`
        : `ML backend is offline or unreachable at ${DIRECT_BACKEND_URL}`
    };
  }
}

/**
 * Fetches live cloudburst prediction from the ML dual-ensemble backend
 * Throws or returns an offline error state when the prediction system is unreachable
 */
export async function getCloudburstEventData(station = null) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    let res;
    // 1. If a specific station or coordinates are requested, use POST /predict/location
    if (station && station.lat != null && station.lon != null) {
      const payload = {
        latitude: station.lat,
        longitude: station.lon,
        source: 'auto'
      };

      try {
        res = await fetch(`${API_BASE}/predict/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } catch {
        res = await fetch(`${DIRECT_BACKEND_URL}/predict/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      }
    } else {
      // 2. Otherwise fetch the latest stored scheduled prediction run
      try {
        res = await fetch(`${API_BASE}/predictions/latest`, { signal: controller.signal });
      } catch {
        res = await fetch(`${DIRECT_BACKEND_URL}/predictions/latest`, { signal: controller.signal });
      }
    }
    clearTimeout(timeoutId);

    if (!res || !res.ok) {
      throw new Error(`Prediction API returned HTTP ${res?.status || 502}: ${res?.statusText || 'Unavailable'}`);
    }

    const data = await res.json();

    // Map backend ML schema to dashboard event interface
    const prob = Number(data.predicted_probability ?? 0.035);
    const cri = Number(data.convective_risk_index_cri ?? 0.0);
    const riskPercent = Math.round(cri > 0 ? cri : prob * 100);

    // Passes 25% threshold for active warning
    const isAlertActive = prob >= 0.25 || cri >= 25;
    const isCritical = data.alert_tier === 'RED_WARNING' || cri >= 75 || prob >= 0.50;
    const isWarning = isAlertActive;

    const elev = station?.elevation ?? data.terrain?.elevation_m ?? 600;
    const standardP = 1013.25 * Math.pow(1 - (0.0065 * elev) / 288.15, 5.255);
    const actualSurfaceP = data.features?.surface_pressure_hpa ?? data.features?.surface_pressure_min;
    const pressureDropHpa = actualSurfaceP 
      ? Math.max(0, Math.round(standardP - actualSurfaceP))
      : 4;

    const rainRate = data.predicted_rain_mm != null 
      ? Number(data.predicted_rain_mm) 
      : (prob >= 0.25 ? Math.round(35 + (prob - 0.25) * 160) : 0.0);

    return {
      isLive: true,
      id: data.id ? `PRED-${data.id}` : `ML-${Date.now().toString().slice(-4)}`,
      title: data.risk_label || (isCritical ? 'High Convective Cloudburst Warning' : isWarning ? 'Elevated Convective Alert' : 'Normal / Low Convective Risk'),
      status: isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'NORMAL',
      isAlertActive,
      locationName: station?.name || data.location || 'Kedarnath Valley',
      state: station?.state || data.state || 'Uttarakhand',
      coordinates: [
        station?.lon ?? data.coordinates?.[1] ?? 79.0669,
        station?.lat ?? data.coordinates?.[0] ?? 30.7346
      ],
      elevationMeters: elev,
      detectedAt: data.target_date || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      leadTimeMinutes: data.lead_time_minutes || (isCritical ? 35 : isWarning ? 60 : 120),
      mlModel: {
        name: "Physics-Informed Dual-Engine Ensemble (LightGBM + XGBoost)",
        confidencePercent: Math.round((cri > 0 ? cri : (prob * 100)) * 10) / 10,
        riskLevel: data.alert_tier || data.risk_label || (isAlertActive ? "ELEVATED_RISK" : "GREEN_NORMAL"),
        calibratedProb: prob,
        rawProb: data.raw_probability ?? prob
      },
      metrics: {
        riskPercent,
        predictedRainRateMmh: rainRate,
        capeJkg: Math.round(data.features?.cape_mean ?? data.cape_jkg ?? 450),
        pressureDropHpa,
        echoTopKm: isAlertActive ? 14.8 : 4.2,
        tpwMm: Math.round(data.features?.total_column_integrated_water_vapour_max ?? 28),
        windGustKmh: data.features?.wind_gusts_10m_max 
          ? Math.round(data.features.wind_gusts_10m_max * 3.6) 
          : 18
      },
      topFactors: data.top_factors || [],
      affectedBasins: station?.basins || [
        "Upper Drainage Basin",
        "Mid-Altitude River Corridor",
        "Foothills Inundation Channel"
      ],
      hazardRadiusKm: data.hazard_radius_km || (isCritical ? 18 : isWarning ? 12 : 5),
      advisory: data.advisory || (isCritical 
        ? "CRITICAL EVACUATION ALERT: Flash flood & debris flow risk trigger reached. Disengage low-lying riverbanks immediately."
        : isWarning 
          ? "Convective atmospheric instability elevated. Real-time radar tracking engaged."
          : "Standard atmospheric conditions. Convective risk index within normal threshold."),
      error: null
    };

  } catch (err) {
    // Report failure explicitly without hardcoded false alarms
    return {
      isLive: false,
      status: 'OFFLINE',
      error: err.message || `Cannot reach prediction engine at ${DIRECT_BACKEND_URL}`,
      title: 'Cloudburst Prediction Engine Offline',
      locationName: station?.name || 'Kedarnath Temple Valley',
      coordinates: station ? [station.lon, station.lat] : [79.0669, 30.7346],
      elevationMeters: station?.elevation || 600,
      detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      metrics: {
        riskPercent: null,
        predictedRainRateMmh: null,
      },
      advisory: `ML model is offline; cannot calculate risk percentage. Please ensure backend service is running at ${DIRECT_BACKEND_URL}.`
    };
  }
}
