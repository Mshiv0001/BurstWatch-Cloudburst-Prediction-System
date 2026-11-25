import React from 'react';
import { getThermalCategory, getTempColorHex } from '../utils/temperatureUtils';

/**
 * Multi-Variable Meteorological Horizontal Color Indicator Bar
 * Faithfully matches Windy / Ventusky continuous color gradient pill indicator:
 * - Temperature (°C / °F with interactive unit toggle)
 * - Rain Radar Reflectivity (dBZ)
 * - Convective Cloudburst Risk (%)
 * - Wind Speed (km/h / kt)
 */

const LAYER_CONFIGS = {
  temp: {
    id: 'temp',
    label: 'Temperature',
    unit: (tempUnit) => `°${tempUnit || 'C'}`,
    gradient: 'linear-gradient(to right, #291e6a 0%, #4178be 15%, #4eb195 28%, #5cca4d 40%, #b7da40 50%, #e1ce39 60%, #e09f41 70%, #dc6d55 80%, #b73466 90%, #6b1527 100%)',
    getStops: (tempUnit) => (
      tempUnit === 'F'
        ? ['-4', '14', '32', '50', '68', '86', '104']
        : ['-20', '-10', '0', '10', '20', '30', '40']
    ),
    isClickableUnit: true,
    unitTooltip: (tempUnit) => `Current: °${tempUnit || 'C'} · Click to switch to °${tempUnit === 'F' ? 'C' : 'F'}`
  },
  precip: {
    id: 'precip',
    label: 'Rain Radar',
    unit: () => 'dBZ',
    gradient: 'linear-gradient(to right, #5c7080 0%, #5c7080 14%, #00a3e0 28%, #005588 42%, #4ca043 57%, #ffee00 71%, #e67812 85%, #d32f2f 93%, #ff77ff 100%)',
    getStops: () => ['10', '20', '30', '40', '50', '60', '70+'],
    isClickableUnit: false,
    unitTooltip: () => 'RainViewer Doppler Radar Reflectivity (dBZ)'
  },
  radar: {
    id: 'radar',
    label: 'Rain Radar',
    unit: () => 'dBZ',
    gradient: 'linear-gradient(to right, #5c7080 0%, #5c7080 14%, #00a3e0 28%, #005588 42%, #4ca043 57%, #ffee00 71%, #e67812 85%, #d32f2f 93%, #ff77ff 100%)',
    getStops: () => ['10', '20', '30', '40', '50', '60', '70+'],
    isClickableUnit: false,
    unitTooltip: () => 'Doppler Radar Reflectivity (dBZ)'
  },
  convective: {
    id: 'convective',
    label: 'Cloudburst Risk',
    unit: () => 'Risk',
    gradient: 'linear-gradient(to right, #0284c7 0%, #0ea5e9 16%, #10b981 33%, #eab308 50%, #f97316 67%, #e11d48 83%, #881337 100%)',
    getStops: () => ['0%', '20%', '40%', '60%', '80%', '100%'],
    isClickableUnit: false,
    unitTooltip: () => 'Convective Cloudburst Threat Severity Index'
  },
  wind: {
    id: 'wind',
    label: 'Wind Speed',
    unit: (windUnit = 'km/h') => windUnit,
    gradient: 'linear-gradient(to right, #38bdf8 0%, #38bdf8 16%, #34d399 33%, #a3e635 50%, #facc15 67%, #fb923c 83%, #ef4444 100%)',
    getStops: (windUnit = 'km/h') => (
      windUnit === 'kt'
        ? ['0', '10', '20', '30', '40', '55+']
        : ['0', '20', '40', '60', '80', '100+']
    ),
    isClickableUnit: true,
    unitTooltip: (windUnit) => `Unit: ${windUnit || 'km/h'} · Click to switch`
  }
};

export default function TemperatureLegendBar({
  activeLayer = 'temp',
  tempUnit = 'C',
  onToggleTempUnit,
  windUnit = 'km/h',
  onToggleWindUnit,
  hoveredTemp = null,
  className = ""
}) {
  if (activeLayer === 'none' || activeLayer === 'precip' || activeLayer === 'aqi') return null;

  // Single canonical master wind gradient matching CANONICAL_WIND_STOPS
  const CANONICAL_WIND_GRADIENT = 'linear-gradient(to right, #0b192c 0%, #1e40af 12%, #06b6d4 25%, #10b981 45%, #f59e0b 68%, #f43f5e 88%, #ffffff 100%)';

  // Resolve active layer config or fallback to temperature
  const config = LAYER_CONFIGS[activeLayer] || LAYER_CONFIGS.temp;
  const isTemp = config.id === 'temp';
  const isWind = config.id === 'wind';
  const activeGradient = isWind ? CANONICAL_WIND_GRADIENT : config.gradient;
  const unitLabel = isTemp ? config.unit(tempUnit) : isWind ? config.unit(windUnit) : config.unit();
  const stops = isTemp ? config.getStops(tempUnit) : isWind ? config.getStops(windUnit) : config.getStops();
  const unitTooltip = isTemp ? config.unitTooltip(tempUnit) : isWind ? config.unitTooltip(windUnit) : config.unitTooltip();

  // Compute synchronized needle percentage position & chromatic aura for live map inspection
  let needlePct = null;
  let needleLabel = null;
  let auraColor = '#ffffff';
  let categoryLabel = null;
  if (isTemp && hoveredTemp != null && !isNaN(hoveredTemp)) {
    const minC = -20;
    const maxC = 40;
    const normalized = Math.max(0, Math.min(1, (hoveredTemp - minC) / (maxC - minC)));
    needlePct = 14 + normalized * (96 - 14);
    needleLabel = tempUnit === 'F'
      ? `${Math.round((hoveredTemp * 9) / 5 + 32)}°F`
      : `${Math.round(hoveredTemp * 10) / 10}°C`;
    auraColor = getTempColorHex(hoveredTemp) || '#ffffff';
    const cat = getThermalCategory(hoveredTemp);
    categoryLabel = cat?.label || '';
  }

  const handleUnitClick = () => {
    if (isTemp && onToggleTempUnit) {
      onToggleTempUnit();
    } else if (isWind && onToggleWindUnit) {
      onToggleWindUnit();
    }
  };

  return (
    <aside
      className={`select-none pointer-events-auto transition-all duration-300 max-w-full md:w-full md:max-w-[360px] ${className}`}
      aria-label={`${config.label} Color Scale`}
    >
      {/* Horizontal Rounded Pill Bar matching Windy visual reference */}
      <div
        className="relative flex items-center justify-between px-2.5 sm:px-4 w-[min(360px,calc(100vw-80px))] md:w-full max-w-full h-7 sm:h-7.5 rounded-full border border-black/40 ring-1 ring-black/25 shadow-[0_4px_16px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-1px_2px_rgba(0,0,0,0.45)] transition-all duration-300"
        style={{
          background: activeGradient
        }}
      >
        {/* Subtle 3D Specular Highlight Sheen */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none opacity-40"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.35) 100%)'
          }}
        />

        {/* Synchronized Glowing Interactive Needle & Live Value Badge with Chromatic Aura */}
        {needlePct !== null && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none transition-[left] duration-75 ease-out z-30 flex flex-col items-center justify-center"
            style={{ left: `${needlePct}%`, transform: 'translateX(-50%)' }}
          >
            {/* Vertical indicator needle with dynamic chromatic aura */}
            <div
              className="w-[3px] h-[88%] bg-white rounded-full ring-1 ring-black/50 transition-all duration-75"
              style={{
                boxShadow: `0 0 10px ${auraColor}, 0 0 3px #ffffff, 0 1px 2px rgba(0,0,0,0.9)`
              }}
            />

            {/* Live readout badge floating above pill with chromatic aura border */}
            <div
              className="absolute -top-7 px-2 py-0.5 rounded-full bg-black/90 backdrop-blur-md border text-[10px] font-mono font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.7)] whitespace-nowrap flex items-center gap-1.5 transition-all duration-75"
              style={{
                borderColor: `${auraColor}99`
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block shadow-sm"
                style={{ backgroundColor: auraColor }}
              />
              <span>{needleLabel}</span>
              {categoryLabel && (
                <span className="text-white/60 font-sans font-normal text-[9px] border-l border-white/20 pl-1">
                  {categoryLabel}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Leftmost Unit Label (e.g. °C, °F, dBZ, Risk, km/h) */}
        {config.isClickableUnit ? (
          <button
            type="button"
            onClick={handleUnitClick}
            title={unitTooltip}
            className="relative z-10 text-[9.5px] xs:text-[10.5px] sm:text-[11.5px] font-sans font-bold text-white tracking-tight cursor-pointer hover:scale-110 active:scale-95 transition-transform drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.9)] drop-shadow-[0_0_1px_rgba(0,0,0,0.7)]"
          >
            {unitLabel}
          </button>
        ) : (
          <span
            title={unitTooltip}
            className="relative z-10 text-[9.5px] xs:text-[10.5px] sm:text-[11.5px] font-sans font-bold text-white tracking-tight drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.9)] drop-shadow-[0_0_1px_rgba(0,0,0,0.7)]"
          >
            {unitLabel}
          </span>
        )}

        {/* Tick stops distributed across the pill */}
        {stops.map((stop, idx) => (
          <span
            key={`${stop}-${idx}`}
            className="relative z-10 text-[9.5px] xs:text-[10.5px] sm:text-[11.5px] font-sans font-bold text-white tracking-tight leading-none drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.9)] drop-shadow-[0_0_1px_rgba(0,0,0,0.7)]"
          >
            {stop}
          </span>
        ))}
      </div>
    </aside>
  );
}
