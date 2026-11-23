/**
 * Global Overview Continent & Country Labels GeoJSON
 * Replicates the authentic Windy high-altitude synoptic typography:
 * Clean, spaced, non-cluttering labels at global and continental zoom levels (zoom 2 to 5.5).
 */
export const WORLD_OVERVIEW_LABELS = {
  type: 'FeatureCollection',
  features: [
    // Major Continents (Zoom 2.0 - 4.8)
    { type: 'Feature', properties: { name: 'ASIA', type: 'continent', size: 14, letterSpacing: 0.2 }, geometry: { type: 'Point', coordinates: [88.0, 48.0] } },
    { type: 'Feature', properties: { name: 'EUROPE', type: 'continent', size: 13, letterSpacing: 0.18 }, geometry: { type: 'Point', coordinates: [24.0, 52.0] } },
    { type: 'Feature', properties: { name: 'AFRICA', type: 'continent', size: 13, letterSpacing: 0.18 }, geometry: { type: 'Point', coordinates: [21.0, 7.0] } },
    { type: 'Feature', properties: { name: 'AUSTRALIA', type: 'continent', size: 12, letterSpacing: 0.15 }, geometry: { type: 'Point', coordinates: [134.0, -25.0] } },

    // Primary Nations (Zoom 2.8 - 5.5)
    { type: 'Feature', properties: { name: 'INDIA', type: 'country', size: 12, letterSpacing: 0.12 }, geometry: { type: 'Point', coordinates: [79.2, 22.8] } },
    { type: 'Feature', properties: { name: 'PAKISTAN', type: 'country', size: 11, letterSpacing: 0.08 }, geometry: { type: 'Point', coordinates: [69.3, 30.0] } },
    { type: 'Feature', properties: { name: 'AFGHANISTAN', type: 'country', size: 10, letterSpacing: 0.08 }, geometry: { type: 'Point', coordinates: [66.0, 33.8] } },
    { type: 'Feature', properties: { name: 'CHINA', type: 'country', size: 13, letterSpacing: 0.14 }, geometry: { type: 'Point', coordinates: [104.0, 35.8] } },
    { type: 'Feature', properties: { name: 'NEPAL', type: 'country', size: 9.5, letterSpacing: 0.06 }, geometry: { type: 'Point', coordinates: [84.1, 28.4] } },
    { type: 'Feature', properties: { name: 'BANGLADESH', type: 'country', size: 9.5, letterSpacing: 0.06 }, geometry: { type: 'Point', coordinates: [90.3, 23.7] } },
    { type: 'Feature', properties: { name: 'MYANMAR', type: 'country', size: 10, letterSpacing: 0.08 }, geometry: { type: 'Point', coordinates: [96.0, 21.9] } },
    { type: 'Feature', properties: { name: 'IRAN', type: 'country', size: 11, letterSpacing: 0.08 }, geometry: { type: 'Point', coordinates: [53.7, 32.4] } },
    { type: 'Feature', properties: { name: 'SAUDI ARABIA', type: 'country', size: 11, letterSpacing: 0.08 }, geometry: { type: 'Point', coordinates: [45.0, 24.0] } },
    { type: 'Feature', properties: { name: 'OMAN', type: 'country', size: 9.5, letterSpacing: 0.06 }, geometry: { type: 'Point', coordinates: [56.0, 21.5] } },
    { type: 'Feature', properties: { name: 'RUSSIA', type: 'country', size: 13, letterSpacing: 0.15 }, geometry: { type: 'Point', coordinates: [95.0, 60.0] } },
    { type: 'Feature', properties: { name: 'KAZAKHSTAN', type: 'country', size: 11, letterSpacing: 0.08 }, geometry: { type: 'Point', coordinates: [67.0, 48.0] } },
    { type: 'Feature', properties: { name: 'THAILAND', type: 'country', size: 9.5, letterSpacing: 0.06 }, geometry: { type: 'Point', coordinates: [101.0, 15.0] } },
    { type: 'Feature', properties: { name: 'INDONESIA', type: 'country', size: 11, letterSpacing: 0.08 }, geometry: { type: 'Point', coordinates: [118.0, -2.0] } },
    { type: 'Feature', properties: { name: 'JAPAN', type: 'country', size: 11, letterSpacing: 0.08 }, geometry: { type: 'Point', coordinates: [138.0, 36.5] } },
    { type: 'Feature', properties: { name: 'SRI LANKA', type: 'country', size: 9, letterSpacing: 0.06 }, geometry: { type: 'Point', coordinates: [80.7, 7.8] } },
  ]
};

