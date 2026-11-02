import React from 'react';

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
    gradient: 'linear-gradient(to right, #535099 0%, #7875b2 10%, #9b99cc 18%, #56b5cb 28%, #1e7a96 38%, #4ca043 50%, #b8ba28 62%, #e67812 75%, #c24b10 85%, #8c2014 93%, #5a1008 100%)',
    getStops: (tempUnit) => (
      tempUnit === 'F'
        ? ['-40', '-22', '-4', '14', '32', '50', '68', '86', '104', '122']
        : ['-40', '-30', '-20', '-10', '0', '10', '20', '30', '40', '50']
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
  className = ""
}) {
  if (activeLayer === 'none') return null;

  // Resolve active layer config or fallback to temperature
  const config = LAYER_CONFIGS[activeLayer] || LAYER_CONFIGS.temp;
  const isTemp = config.id === 'temp';
  const isWind = config.id === 'wind';
  const unitLabel = isTemp ? config.unit(tempUnit) : isWind ? config.unit(windUnit) : config.unit();
  const stops = isTemp ? config.getStops(tempUnit) : isWind ? config.getStops(windUnit) : config.getStops();
  const unitTooltip = isTemp ? config.unitTooltip(tempUnit) : isWind ? config.unitTooltip(windUnit) : config.unitTooltip();

  const handleUnitClick = () => {
    if (isTemp && onToggleTempUnit) {
      onToggleTempUnit();
    } else if (isWind && onToggleWindUnit) {
      onToggleWindUnit();
    }
  };

  return (
    <aside 
      className={`select-none pointer-events-auto transition-all duration-300 ${className}`}
      aria-label={`${config.label} Color Scale`}
    >
      {/* Visual Mode Subtitle Tag */}
      <div className="flex justify-center mb-1">
        <span className="text-[10px] font-mono font-medium text-slate-300 apple-liquid-glass px-2.5 py-0.5 rounded-full border border-white/10 shadow-sm">
          {isTemp ? 'Thermodynamic Field (Windy Style)' : isWind ? 'Speed-Coded Streamlines' : config.label}
        </span>
      </div>

      {/* Horizontal Rounded Pill Bar matching Windy visual reference */}
      <div 
        className="relative flex items-center justify-between px-3 sm:px-4 w-[330px] sm:w-[380px] h-7 sm:h-7.5 rounded-full border border-black/40 ring-1 ring-black/25 shadow-[0_4px_16px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-1px_2px_rgba(0,0,0,0.45)] transition-all duration-300"
        style={{
          background: config.gradient
        }}
      >
        {/* Subtle 3D Specular Highlight Sheen */}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none opacity-40"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.35) 100%)'
          }}
        />

        {/* Leftmost Unit Label (e.g. °C, °F, dBZ, Risk, km/h) */}
        {config.isClickableUnit ? (
          <button
            type="button"
            onClick={handleUnitClick}
            title={unitTooltip}
            className="relative z-10 text-[11px] sm:text-[12px] font-sans font-bold text-white tracking-tight cursor-pointer hover:scale-110 active:scale-95 transition-transform drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.9)] drop-shadow-[0_0_1px_rgba(0,0,0,0.7)]"
          >
            {unitLabel}
          </button>
        ) : (
          <span 
            title={unitTooltip}
            className="relative z-10 text-[11px] sm:text-[12px] font-sans font-bold text-white tracking-tight drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.9)] drop-shadow-[0_0_1px_rgba(0,0,0,0.7)]"
          >
            {unitLabel}
          </span>
        )}

        {/* Tick stops distributed across the pill */}
        {stops.map((stop, idx) => (
          <span
            key={`${stop}-${idx}`}
            className="relative z-10 text-[11px] sm:text-[12px] font-sans font-bold text-white tracking-tight leading-none drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.9)] drop-shadow-[0_0_1px_rgba(0,0,0,0.7)]"
          >
            {stop}
          </span>
        ))}
      </div>
    </aside>
  );
}
