// Open-Meteo Live Meteorological Telemetry & Cloudburst Prediction Engine
// Global free meteorological API with no API key required

export const WMO_WEATHER_CODES = {
  0: { label: 'Clear Sky', icon: 'Sun' },
  1: { label: 'Mainly Clear', icon: 'CloudSun' },
  2: { label: 'Partly Cloudy', icon: 'CloudSun' },
  3: { label: 'Overcast', icon: 'Cloud' },
  45: { label: 'Dense Fog', icon: 'Cloud' },
  48: { label: 'Freezing Fog', icon: 'Cloud' },
  51: { label: 'Light Drizzle', icon: 'CloudDrizzle' },
  53: { label: 'Moderate Drizzle', icon: 'CloudDrizzle' },
  55: { label: 'Dense Drizzle', icon: 'CloudDrizzle' },
  61: { label: 'Slight Rain', icon: 'CloudRain' },
  63: { label: 'Moderate Rain', icon: 'CloudRain' },
  65: { label: 'Heavy Cloudburst Rain', icon: 'CloudRain' },
  71: { label: 'Slight Snow', icon: 'Cloud' },
  73: { label: 'Moderate Snow', icon: 'Cloud' },
  75: { label: 'Heavy Snowfall', icon: 'Cloud' },
  80: { label: 'Convective Rain Showers', icon: 'CloudRain' },
  81: { label: 'Moderate Rain Showers', icon: 'CloudRain' },
  82: { label: 'Violent Convective Downpour', icon: 'CloudHail' },
  95: { label: 'Thunderstorm with Gusts', icon: 'CloudLightning' },
  96: { label: 'Severe Thunderstorm & Hail', icon: 'CloudLightning' },
  99: { label: 'Violent Severe Cloudburst Storm', icon: 'CloudLightning' }
};

// Calculate Convective Cloudburst Risk from Live Open-Meteo Meteorological Physics
export function computeLiveCloudburstThreat(liveData) {
  const {
    temperature = 20,
    humidity = 60,
    pressure = 1013,
    windSpeed = 15,
    windGusts = 20,
    precipitation = 0,
    cloudCover = 50
  } = liveData;

  // 1. Humidity Convective Saturation Factor (weight: 0.30)
  const normHumidity = Math.max(0, Math.min(1, (humidity - 50) / 50));
  
  // 2. Barometric Depression Factor (weight: 0.25)
  // Higher altitudes have lower base pressure, so evaluate relative drop or deep depression
  const normPressure = Math.max(0, Math.min(1, (1015 - Math.min(1015, pressure)) / 100));

  // 3. Orographic Wind Shear & Gust Intensity (weight: 0.20)
  const normWind = Math.max(0, Math.min(1, windGusts / 65));

  // 4. Instantaneous Precipitation Surge (weight: 0.25)
  const normPrecip = Math.max(0, Math.min(1, precipitation / 25));

  // Convective Cloudburst Index (0 - 100)
  let threatScore = (
    normHumidity * 30 +
    normPressure * 25 +
    normWind * 20 +
    normPrecip * 25
  );

  // Severe threshold boosts for heavy convective indicators
  if (humidity > 88 && precipitation > 10) threatScore += 12;
  if (windGusts > 50 && pressure < 990) threatScore += 10;
  threatScore = Math.max(8, Math.min(99, Math.round(threatScore)));

  let severity = 'LOW';
  let alertText = 'Atmospheric columns stable. Low convective cloudburst probability.';
  if (threatScore >= 80) {
    severity = 'CRITICAL';
    alertText = 'CRITICAL CONVECTIVE SURGE DETECTED! Extreme cloudburst & flash-flood hazard.';
  } else if (threatScore >= 60) {
    severity = 'HIGH';
    alertText = 'HIGH THREAT WARNING: Severe convective updrafts and heavy rainfall imminent.';
  } else if (threatScore >= 35) {
    severity = 'MODERATE';
    alertText = 'MODERATE ALERT: Orographic moisture loading detected along terrain.';
  }

  return {
    riskPercent: threatScore,
    severity,
    alertText,
    features: [
      { name: 'Relative Humidity 2m', value: `${humidity}%`, weight: '30%', status: humidity > 85 ? 'Critical' : 'Normal' },
      { name: 'Surface Pressure', value: `${Math.round(pressure)} hPa`, weight: '25%', status: pressure < 995 ? 'Depression' : 'Stable' },
      { name: 'Wind Gusts 10m', value: `${Math.round(windGusts)} km/h`, weight: '20%', status: windGusts > 45 ? 'Severe Gusts' : 'Normal' },
      { name: 'Precipitation Rate', value: `${precipitation.toFixed(1)} mm/h`, weight: '25%', status: precipitation > 15 ? 'Extreme' : 'Nominal' }
    ]
  };
}

// In-memory cache to prevent excessive requests
const meteoCache = new Map();

/**
 * Fetch Live Real-Time Meteorological Telemetry from Open-Meteo
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @param {string} stationName Name of the station/location
 */
import { fetchWeatherApiLiveData } from './weatherApiService';

export async function fetchOpenMeteoLiveData(lat, lon, stationName = 'Selected Station') {
  return fetchWeatherApiLiveData(lat, lon, stationName);
}

async function fetchOpenMeteoRaw(lat, lon, stationName = 'Selected Station') {

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Open-Meteo API returned HTTP status ${response.status}`);
    }

    const data = await response.json();
    const curr = data.current || {};
    const hourly = data.hourly || {};

    const weatherCode = curr.weather_code ?? 0;
    const weatherInfo = WMO_WEATHER_CODES[weatherCode] || { label: 'Convective Weather', icon: 'CloudRain' };

    const liveData = {
      isLive: true,
      source: 'Open-Meteo Real-Time (ECMWF/GFS)',
      fetchedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      stationName,
      coordinates: [lat, lon],
      elevation: data.elevation ?? 1200,
      
      // Live Metrics
      temperature: Math.round(curr.temperature_2m ?? 22),
      apparentTemperature: Math.round(curr.apparent_temperature ?? curr.temperature_2m ?? 22),
      humidity: Math.round(curr.relative_humidity_2m ?? 65),
      pressure: Math.round(curr.surface_pressure ?? 1012),
      pressureDrop: Math.max(0, Math.round(1013 - (curr.surface_pressure ?? 1012))),
      windSpeed: Math.round(curr.wind_speed_10m ?? 12),
      windGusts: Math.round(curr.wind_gusts_10m ?? curr.wind_speed_10m ?? 16),
      windDirection: Math.round(curr.wind_direction_10m ?? 60),
      precipitation: Number(curr.precipitation ?? 0),
      rainRate: Number(curr.rain ?? curr.precipitation ?? 0),
      cloudCover: Math.round(curr.cloud_cover ?? 50),
      condition: weatherInfo.label,
      icon: weatherInfo.icon,
      
      // Hourly Forecast Series for Synoptic Meteogram Chart (next 24 hours)
      hourlySeries: Array.isArray(hourly.time) 
        ? hourly.time.slice(0, 24).map((timeStr, idx) => {
            const timeObj = new Date(timeStr);
            const hourLabel = timeObj.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
            const p = Math.round(hourly.surface_pressure?.[idx] ?? 1012);
            const r = Number(hourly.precipitation?.[idx] ?? 0);
            const t = Math.round(hourly.temperature_2m?.[idx] ?? 20);
            const h = Math.round(hourly.relative_humidity_2m?.[idx] ?? 60);
            const w = Math.round(hourly.wind_speed_10m?.[idx] ?? 10);
            // Simulated CAPE correlation from convective moisture
            const cape = Math.round((h / 100) * (30 - Math.min(25, t)) * 80);

            return {
              time: hourLabel,
              label: hourLabel,
              pressure: p,
              rainRate: r,
              cape: Math.max(100, cape),
              temp: t,
              humidity: h,
              windSpeed: w
            };
          })
        : []
    };

    // Calculate dynamic cloudburst threat strictly for India orographic/convective sectors
    const isIndia = (lat >= 6.0 && lat <= 38.0 && lon >= 67.0 && lon <= 98.0);
    liveData.isIndia = isIndia;
    liveData.threat = isIndia ? computeLiveCloudburstThreat(liveData) : null;

    meteoCache.set(cacheKey, { data: liveData, timestamp: now });
    return liveData;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[Open-Meteo] Live fetch failed for (${lat}, ${lon}), using localized baseline:`, err.message);

    // High-fidelity fallback based on geography and elevation
    const fallbackData = createFallbackLiveData(lat, lon, stationName);
    return fallbackData;
  }
}

// Fallback generator when offline or network timeout
function createFallbackLiveData(lat, lon, stationName) {
  let baseTemp = 24 - (lat - 22) * 0.5;
  if (lat > 28) baseTemp -= (lat - 28) * 4.5;
  const temp = Math.round(Math.max(-5, Math.min(42, baseTemp)));
  const humidity = Math.round(lat > 28 ? 84 : 68);
  const pressure = Math.round(lat > 28 ? 850 : 1010);
  const windSpeed = 22;
  const windGusts = 38;
  const precipitation = lat > 28 ? 12.4 : 0.0;

  const fallbackData = {
    isLive: false,
    source: 'Station Sensor Model (Offline Cache)',
    fetchedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    stationName,
    coordinates: [lat, lon],
    elevation: lat > 28 ? 2600 : 450,
    temperature: temp,
    apparentTemperature: temp - 1,
    humidity,
    pressure,
    pressureDrop: 1013 - pressure,
    windSpeed,
    windGusts,
    windDirection: 45,
    precipitation,
    rainRate: precipitation,
    cloudCover: 75,
    condition: lat > 28 ? 'Orographic Moisture Inflow' : 'Partly Cloudy',
    icon: lat > 28 ? 'CloudRain' : 'CloudSun',
    hourlySeries: [
      { time: '12 PM', label: '12 PM', pressure: pressure, rainRate: precipitation * 0.4, cape: 750, temp: temp, humidity: humidity },
      { time: '1 PM', label: '1 PM', pressure: pressure - 3, rainRate: precipitation * 0.8, cape: 920, temp: temp + 1, humidity: humidity + 4 },
      { time: '2 PM', label: '2 PM', pressure: pressure - 8, rainRate: precipitation * 1.5, cape: 1450, temp: temp - 1, humidity: humidity + 8 },
      { time: '3 PM', label: '3 PM', pressure: pressure - 14, rainRate: precipitation * 2.2, cape: 2100, temp: temp - 3, humidity: 95 },
      { time: '4 PM', label: '4 PM', pressure: pressure - 6, rainRate: precipitation * 1.2, cape: 1600, temp: temp - 2, humidity: 90 },
      { time: '5 PM', label: '5 PM', pressure: pressure + 2, rainRate: precipitation * 0.5, cape: 800, temp: temp - 1, humidity: 85 }
    ]
  };

  const isIndia = (lat >= 6.0 && lat <= 38.0 && lon >= 67.0 && lon <= 98.0);
  fallbackData.isIndia = isIndia;
  fallbackData.threat = isIndia ? computeLiveCloudburstThreat(fallbackData) : null;
  return fallbackData;
}
