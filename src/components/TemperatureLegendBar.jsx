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
    gradient: 'linear-gradient(to right, #dd06c1 0.0%, #cf06f1 8.9%, #a305f3 13.3%, #7604f6 17.8%, #4703f9 22.2%, #2902fa 25.0%, #0b01fc 27.8%, #0116fd 30.6%, #0034ff 33.3%, #2363fb 35.6%, #458bf7 37.8%, #66abf5 40.0%, #86c5f5 42.2%, #72e8a5 44.4%, #4ee885 46.7%, #28e960 48.9%, #11dc3d 51.1%, #09bf24 53.3%, #04a00f 55.6%, #008000 57.8%, #28a000 60.0%, #60c000 62.2%, #a7df00 64.4%, #ffff00 66.7%, #ffed00 68.9%, #ffdb00 71.1%, #ffc900 73.3%, #ffb700 75.6%, #ffa500 77.8%, #ff8a00 80.0%, #ff6e00 82.2%, #ff5300 84.4%, #ff3700 86.7%, #ff1b00 88.9%, #ff0000 91.1%, #e4000a 93.3%, #c90012 95.6%, #ae0017 97.8%, #93001a 100.0%)',
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
