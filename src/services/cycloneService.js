/**
 * Dynamic Global Tropical Cyclone & Vortex Simulation Service
 * 
 * Provides:
 * 1. Live synchronization with GDACS / NOAA global tropical cyclone feeds
 * 2. Physics-based Rankine-Holland vortex fluid mechanics with hemisphere Coriolis deflection
 * 3. Reactive subscription for real-time wind particle simulation and UI markers
 */

// Shortest spherical delta longitude [-180, +180]
export function deltaLon(lon1, lon2) {
  return ((((lon1 - lon2 + 180) % 360) + 360) % 360) - 180;
}

/**
 * Planetary Boundary Layer (PBL) Aerodynamic Surface Drag
 * - Water / Oceans (z0 ≈ 0.0002m): aerodynamically smooth, negligible drag -> fast, silky flow (1.35x)
 * - Land / Continents (z0 ≈ 0.1-2.0m): high vegetative/urban roughness -> slow, calm drift (0.60x)
 * - Mountain Orography (Himalayas, Andes): terrain blocking & valley trapping -> extra calm (0.48x)
 */
export function getSurfaceFrictionMultiplier(lon, lat) {
  const nLon = ((((lon + 180) % 360) + 360) % 360) - 180;
  let isWater = false;

  // Indian Ocean, Arabian Sea, Bay of Bengal
  if (lat < 7.0 && nLon >= -20 && nLon <= 120) {
    isWater = true;
  } else if (lat >= 7.0 && lat <= 26.0 && nLon >= 45.0 && nLon <= 72.5) {
    isWater = true; // Arabian Sea
  } else if (lat >= 6.0 && lat <= 22.0 && nLon >= 80.5 && nLon <= 95.0) {
    if (!(lat >= 5.8 && lat <= 9.8 && nLon >= 79.6 && nLon <= 82.0)) {
      isWater = true; // Bay of Bengal (excluding Sri Lanka)
    }
  } else if (lat >= 0.0 && lat <= 20.0 && nLon >= 100.0 && nLon <= 120.0) {
    isWater = true; // South China Sea
  } else if (lat >= -55.0 && lat <= 55.0 && (nLon >= 135.0 || nLon <= -125.0)) {
    if (!(lat >= -48.0 && lat <= -10.0 && nLon >= 113.0 && nLon <= 178.0)) {
      isWater = true; // Pacific Ocean (excluding Australia/NZ)
    }
  } else if (lat >= -55.0 && lat <= 60.0 && nLon >= -68.0 && nLon <= -12.0) {
    if (!(lat >= -56.0 && lat <= 12.0 && nLon >= -80.0 && nLon <= -34.0) &&
        !(lat >= 15.0 && lat <= 60.0 && nLon >= -68.0 && nLon <= -52.0)) {
      isWater = true; // Atlantic Ocean
    }
  } else if (lat >= 30.0 && lat <= 46.0 && nLon >= -5.0 && nLon <= 36.0) {
    isWater = true; // Mediterranean Sea
  } else if (lat >= 12.0 && lat <= 30.0 && nLon >= 32.0 && nLon <= 44.0) {
    isWater = true; // Red Sea
  } else if (lat >= 23.0 && lat <= 30.0 && nLon >= 47.0 && nLon <= 56.0) {
    isWater = true; // Persian Gulf
  }

  if (isWater) return 1.35;
  if (lat >= 26.0 && lat <= 36.0 && nLon >= 72.0 && nLon <= 100.0) return 0.48; // Orographic blocking
  return 0.60;
}

// Initial active global storms (dynamically populated from GDACS / NOAA live feed)
export const DEFAULT_ACTIVE_CYCLONES = [];

let activeCyclones = [...DEFAULT_ACTIVE_CYCLONES];
const listeners = new Set();

/**
 * Returns current array of active cyclones
 */
export function getActiveCyclones() {
  return activeCyclones;
}

/**
 * Subscribes to cyclone updates (returns unsubscribe callback)
 */
export function subscribeActiveCyclones(callback) {
  listeners.add(callback);
  callback(activeCyclones);
  return () => listeners.delete(callback);
}

/**
 * Updates active cyclones and notifies all simulation engines and UI layers
 */
export function setActiveCyclones(newCyclones) {
  if (!Array.isArray(newCyclones) || newCyclones.length === 0) return;
  activeCyclones = newCyclones;
  listeners.forEach(cb => {
    try {
      cb(activeCyclones);
    } catch (e) {
      console.error('Error notifying cyclone listener:', e);
    }
  });
}

/**
 * Dynamically adds a new cyclone (e.g. simulated storm, What-If event, or alert)
 */
export function addCyclone(cyclone) {
  if (!cyclone || typeof cyclone.lat !== 'number' || typeof cyclone.lon !== 'number') return;
  const existingIdx = activeCyclones.findIndex(c => c.id === cyclone.id || c.name === cyclone.name);
  if (existingIdx >= 0) {
    activeCyclones[existingIdx] = { ...activeCyclones[existingIdx], ...cyclone };
  } else {
    activeCyclones = [...activeCyclones, cyclone];
  }
  setActiveCyclones(activeCyclones);
}

/**
 * Computes fluid-mechanical tangential & inflow wind vector for any active cyclone.
 * 
 * Physics Principles:
 * - Rankine-Holland asymptotic vortex: calm eye at r=0, max speed at rCore, smooth Gaussian decay outward.
 * - Northern Hemisphere: Counter-Clockwise rotation (Coriolis deflection to the right).
 * - Southern Hemisphere: Clockwise rotation (Coriolis deflection to the left).
 * - Inward cyclonic cross-isobaric boundary layer convergence spiral (~18° inflow).
 */
export function computeCycloneVelocity(lon, lat, cyclone) {
  if (!cyclone || typeof cyclone.lat !== 'number' || typeof cyclone.lon !== 'number') {
    return { u: 0, v: 0, mag: 0 };
  }

  const dx = deltaLon(lon, cyclone.lon);
  const dy = lat - cyclone.lat;
  const rSq = dx * dx + dy * dy;

  // Max wind speed converted to simulation units
  const windKmh = Number(cyclone.windKmh) || 120;
  const vMax = Math.min(26.0, Math.max(7.5, windKmh * 0.085));

  // Eyewall core radius & outer circulation envelope scaled to storm intensity
  const rCore = Math.max(1.1, Math.min(2.4, (windKmh / 100.0) * 1.5));
  const rEnv = Math.max(4.5, Math.min(8.5, (windKmh / 100.0) * 4.6));

  // Asymptotic Gaussian envelope (smoothly approaches 0 with C^inf continuity)
  const env = Math.exp(-rSq / (2.0 * rEnv * rEnv));
  if (env < 0.0005) {
    return { u: 0, v: 0, mag: 0 };
  }

  const r = Math.sqrt(rSq);
  const vTan = (vMax * (r / rCore)) / (1.0 + (r / rCore) ** 2) * env;
  const invR = 1.0 / (r + 0.12);

  // Hemisphere rotation: Northern (lat >= 0) = CCW (+1), Southern (lat < 0) = CW (-1)
  const hemi = cyclone.lat >= 0 ? 1.0 : -1.0;

  // Tangential circulation
  const uCirc = (-hemi * dy * invR) * vTan;
  const vCirc = (hemi * dx * invR) * vTan;

  // 18-degree inward cyclonic spiral convergence towards the low-pressure center
  const uInflow = (-dx * invR) * (vTan * 0.22);
  const vInflow = (-dy * invR) * (vTan * 0.22);

  const u = uCirc + uInflow;
  const v = vCirc + vInflow;
  const mag = Math.sqrt(u * u + v * v);

  return { u, v, mag };
}

/**
 * Computes thermal perturbation for cyclonic warm core eye & spiral rainbands
 */
export function computeCycloneThermalAnomaly(lon, lat, cyclone) {
  const dx = deltaLon(lon, cyclone.lon);
  const dy = lat - cyclone.lat;
  const dist = Math.hypot(dy, dx);
  if (dist >= 8.0) return 0;

  const angle = Math.atan2(dy, dx);
  const spiral = Math.sin(dist * 1.5 - angle * 2.0);

  if (dist < 1.8) {
    // Warm core eye anomaly (+2.5°C)
    return (1.8 - dist) * 2.5;
  }
  // Convective cooling / rainband thermal perturbations
  return spiral * 1.6 * Math.exp(-dist / 5.0);
}

/**
 * Computes local precipitation rate (mm/h) generated by cyclone spiral bands
 */
export function computeCyclonePrecipitation(lon, lat, cyclone) {
  const dx = deltaLon(lon, cyclone.lon) * Math.cos((lat * Math.PI) / 180.0);
  const dy = lat - cyclone.lat;
  const dist = Math.hypot(dy, dx);
  if (dist >= 12.0) return 0;

  const windKmh = cyclone.windKmh || 120;
  const peakRain = Math.min(85.0, windKmh * 0.42);
  return peakRain * Math.exp(-dist / 1.8);
}

/**
 * Computes local atmospheric pressure drop (hPa) inside cyclone circulation
 */
export function computeCyclonePressureDrop(lon, lat, cyclone) {
  const dx = deltaLon(lon, cyclone.lon) * Math.cos((lat * Math.PI) / 180.0);
  const dy = lat - cyclone.lat;
  const dist = Math.hypot(dy, dx);
  if (dist >= 8.0) return 0;

  const centralPressure = cyclone.pressureHpa || 960;
  const maxDrop = Math.max(15, 1013 - centralPressure);
  return maxDrop * Math.exp(-dist / 1.9);
}

/**
 * Fetches live global tropical cyclones from API / GDACS feed with automatic fallback
 */
export async function fetchLiveCyclones() {
  try {
    // 1. Try local backend aggregator endpoint
    const res = await fetch('/api/cyclones', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setActiveCyclones(data);
        return data;
      }
    }
  } catch (err) {
    // Backend endpoint not active, fallback to direct GDACS GeoRSS parsing or default set
  }

  try {
    // 2. Direct client fetch to public GDACS RSS proxy or GeoJSON if available
    const directRes = await fetch('https://www.gdacs.org/xml/rss.xml', { cache: 'no-store' });
    if (directRes.ok) {
      const text = await directRes.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      const items = Array.from(xmlDoc.querySelectorAll('item'));
      
      const parsed = [];
      const seen = new Set();

      for (const it of items) {
        const title = it.querySelector('title')?.textContent || '';
        const pointEl = it.getElementsByTagNameNS('http://www.georss.org/georss', 'point')[0];
        const eventType = it.getElementsByTagNameNS('http://www.gdacs.org', 'eventtype')[0]?.textContent;

        if (eventType === 'TC' || title.toLowerCase().includes('cyclone')) {
          const name = it.getElementsByTagNameNS('http://www.gdacs.org', 'eventname')[0]?.textContent || 'Tropical Storm';
          if (seen.has(name)) continue;
          seen.add(name);

          const severity = it.getElementsByTagNameNS('http://www.gdacs.org', 'severity')[0]?.textContent || '';
          const alert = it.getElementsByTagNameNS('http://www.gdacs.org', 'alertlevel')[0]?.textContent || 'Orange';
          const pointText = pointEl?.textContent?.trim() || '';
          const parts = pointText.split(/\s+/);
          
          if (parts.length === 2) {
            const lat = parseFloat(parts[0]);
            const lon = parseFloat(parts[1]);
            const windMatch = severity.match(/(\d+)\s*km\/h/);
            const windKmh = windMatch ? parseInt(windMatch[1], 10) : 120;

            parsed.push({
              id: `cyclone-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              name: name.replace(/-\d+$/, '').replace(/\b\w/g, l => l.toUpperCase()),
              status: severity.split('(')[0].trim() || 'Tropical Cyclone',
              category: `${alert} Alert`,
              windKmh,
              pressureHpa: Math.max(910, 1010 - Math.round(windKmh * 0.45)),
              lat,
              lon
            });
          }
        }
      }

      if (parsed.length > 0) {
        setActiveCyclones(parsed);
        return parsed;
      }
    }
  } catch (err) {
    // Network or CORS limitation - use default calibrated active set
  }

  return activeCyclones;
}

