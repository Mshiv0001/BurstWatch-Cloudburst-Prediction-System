/**
 * windParticleStyles.js
 * 
 * AeroSilk™ Atmospheric Fluid Engine: Curated Meteorological Style Suite
 * 
 * Purpose-Driven Meteorological Modes:
 * 1. 'silk'    - Ventusky Pure Silk: Universal multi-layer synoptic flow (standard length, neutral silver/cyan)
 * 2. 'thermal' - Thermal Advection: Cold vs warm air mass transport (temperature-colored shaders)
 * 3. 'grand'   - Vivid Ribbons: Extended sweeping streamlines with vorticity bloom & speed highlights
 * 4. 'off'     - Hide atmospheric particles
 */

export const WIND_PARTICLE_STYLES = [
  {
    id: 'silk',
    label: 'Smooth Flow',
    subtitle: 'Clean, real-time wind streams',
    gradient: 'from-sky-200 via-slate-200 to-white',
    accentColor: '#38bdf8',
    activeCount: 1800,
    speedMult: 0.14,
    fadeRate: 0.16,
    blendMode: 'source-over',
    geometry: 'silk',
    brushType: 'silk',
    vorticitySensitivity: 2.5,
    lineWidths: {
      mist: 0.45,
      fine: 0.60,
      mid: 0.80,
      strong: 1.00,
    },
    getColors: () => ({
      mist: 'rgba(255, 255, 255, 0.30)',
      fine: 'rgba(255, 255, 255, 0.55)',
      mid: 'rgba(255, 255, 255, 0.78)',
      strong: 'rgba(255, 255, 255, 0.95)',
    }),
  },
  {
    id: 'thermal',
    label: 'Thermal Flow',
    subtitle: 'Colored by air temperature',
    gradient: 'from-blue-500 via-emerald-400 to-amber-500',
    accentColor: '#f59e0b',
    activeCount: 5200,
    speedMult: 0.18,
    fadeRate: 0.08,
    blendMode: 'source-over',
    geometry: 'thermal',
    brushType: 'thermal',
    vorticitySensitivity: 3.0,
    lineWidths: {
      mist: 0.70,
      fine: 0.85,
      mid: 1.10,
      strong: 1.45,
    },
    getColors: () => ({
      cryo: 'rgba(56, 189, 248, 0.88)',       // Polar Cold Advection (<5°C)
      temperate: 'rgba(52, 211, 153, 0.90)',  // Temperate Biosphere (5-22°C)
      warm: 'rgba(251, 191, 36, 0.94)',       // Subtropical Warm Advection (22-32°C)
      heat: 'rgba(244, 63, 94, 1.0)',         // Monsoon / Tropical Heat (>32°C)
    }),
  },
  {
    id: 'grand',
    label: 'Dynamic Ribbons',
    subtitle: 'Fast, high-contrast wind trails',
    gradient: 'from-cyan-300 via-sky-400 to-indigo-400',
    accentColor: '#0ea5e9',
    activeCount: 5200,
    speedMult: 0.22,
    fadeRate: 0.055,
    blendMode: 'source-over',
    geometry: 'grand',
    brushType: 'ribbon',
    vorticitySensitivity: 4.5,
    lineWidths: {
      mist: 0.70,
      fine: 0.90,
      mid: 1.25,
      strong: 1.70,
    },
    getColors: (isDarkBg) => (isDarkBg ? {
      mist: 'rgba(186, 230, 253, 0.45)',
      fine: 'rgba(224, 242, 254, 0.75)',
      mid: 'rgba(240, 249, 255, 0.92)',
      strong: 'rgba(255, 255, 255, 1.0)',
    } : {
      mist: 'rgba(28, 55, 85, 0.35)',
      fine: 'rgba(20, 48, 76, 0.65)',
      mid: 'rgba(10, 32, 58, 0.90)',
      strong: 'rgba(2, 16, 32, 1.0)',
    }),
  },
  {
    id: 'off',
    label: 'Turn Off',
    subtitle: 'Hide wind animation',
    gradient: 'from-slate-500 to-slate-700',
    accentColor: '#94a3b8',
    activeCount: 0,
    speedMult: 0,
    fadeRate: 1.0,
    blendMode: 'source-over',
    geometry: 'none',
    brushType: 'none',
    vorticitySensitivity: 0,
  },
];

/**
 * Fallback / Lookup helper by mode ID with graceful legacy aliasing
 */
export function getWindParticleStyle(id) {
  if (!id) return WIND_PARTICLE_STYLES[0]; // silk
  if (id === 'silk' || id === 'normal' || id === 'soft' || id === 'default' || id === 'hokusai' || id === 'sumi' || id === 'japan' || id === 'dark') {
    return WIND_PARTICLE_STYLES[0]; // silk
  }
  if (id === 'thermal' || id === 'temperature' || id === 'temp' || id === 'advection') {
    return WIND_PARTICLE_STYLES[1]; // thermal
  }
  if (id === 'grand' || id === 'vivid' || id === 'windy' || id === 'strong' || id === 'fast' || id === 'starry' || id === 'impasto' || id === 'vangogh' || id === 'aurora' || id === 'neon' || id === 'bioluminescence') {
    return WIND_PARTICLE_STYLES[2]; // grand
  }
  if (id === 'off' || id === 'none' || id === 'hide' || id === 'disabled') {
    return WIND_PARTICLE_STYLES[3]; // off
  }

  return WIND_PARTICLE_STYLES.find((s) => s.id === id) || WIND_PARTICLE_STYLES[0];
}
