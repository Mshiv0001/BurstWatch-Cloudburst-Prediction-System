import React from 'react';
import { TEMPERATURE_STOPS, celsiusToFahrenheit } from '../utils/temperatureUtils';

// Authentic Rain Radar Precipitation Rate (mm/h) Stops matching Ventusky color bar
const RADAR_MMH_STOPS = [
  { val: '100+', label: '>100 mm/h', color: '#3b0764', isDarkText: false },
  { val: '70',   label: '70 mm/h',   color: '#701a75', isDarkText: false },
  { val: '40',   label: '40 mm/h',   color: '#9d174d', isDarkText: false },
  { val: '20',   label: '20 mm/h',   color: '#ea580c', isDarkText: true },
  { val: '10',   label: '10 mm/h',   color: '#f97316', isDarkText: true },
  { val: '5',    label: '5 mm/h',    color: '#facc15', isDarkText: true },
  { val: '2.5',  label: '2.5 mm/h',  color: '#84cc16', isDarkText: true },
  { val: '1.0',  label: '1.0 mm/h',  color: '#16a34a', isDarkText: false },
  { val: '0.5',  label: '0.5 mm/h',  color: '#06b6d4', isDarkText: false },
  { val: '0.2',  label: '0.2 mm/h',  color: '#3b82f6', isDarkText: false },
  { val: '0.1',  label: '0.1 mm/h',  color: '#6366f1', isDarkText: false },
  { val: '0',    label: '0 mm/h',    color: '#64748b', isDarkText: false }
];

const WIND_STOPS = [
  { val: '120+', label: '>120 km/h', color: '#4c1d95', isDarkText: false },
  { val: '90',   label: '90 km/h',   color: '#be123c', isDarkText: false },
  { val: '65',   label: '65 km/h',   color: '#ea580c', isDarkText: true },
  { val: '45',   label: '45 km/h',   color: '#eab308', isDarkText: true },
  { val: '25',   label: '25 km/h',   color: '#10b981', isDarkText: true },
  { val: '10',   label: '10 km/h',   color: '#06b6d4', isDarkText: false }
];

const PRESSURE_STOPS = [
  { val: '1035', label: '1035 hPa', color: '#1e3a8a', isDarkText: false },
  { val: '1022', label: '1022 hPa', color: '#0284c7', isDarkText: false },
  { val: '1013', label: '1013 hPa', color: '#10b981', isDarkText: true },
  { val: '1002', label: '1002 hPa', color: '#eab308', isDarkText: true },
  { val: '990',  label: '990 hPa',  color: '#ea580c', isDarkText: true },
  { val: '980',  label: '980 hPa',  color: '#b91c1c', isDarkText: false }
];

const CONVECTIVE_STOPS = [
  { val: '95%', label: 'Cloudburst', color: '#fed7d7', isDarkText: true },
  { val: '85%', label: 'Extreme',    color: '#e11d48', isDarkText: false },
  { val: '70%', label: 'Severe',     color: '#f97316', isDarkText: true },
  { val: '50%', label: 'High',       color: '#eab308', isDarkText: true },
  { val: '30%', label: 'Moderate',   color: '#22c55e', isDarkText: true },
  { val: '10%', label: 'Normal',     color: '#0ea5e9', isDarkText: false }
];

/**
 * Vertical Weather Layer Color Scale Legend Bar
 * Replicates signature Ventusky / Windy multi-variable meteorological scales:
 * - Temperature (°C / °F with interactive unit toggle)
 * - Precipitation / Rain Radar (mm/h)
 * - Wind Speed (km/h)
 * - Atmospheric Pressure (hPa)
 * - Convective Cloudburst Risk (%)
 */
export default function TemperatureLegendBar({
  activeLayer = 'temp',
  tempUnit = 'C',
  onToggleTempUnit,
  onClose,
  className = ""
}) {
  if (activeLayer === 'none') return null;

  // Dedicated Authentic Ventusky Rain Radar Precipitation Rate (mm/h) Scale
  if (activeLayer === 'precip' || activeLayer === 'radar') {
    return (
      <aside 
        className={`select-none pointer-events-auto flex items-center gap-1.5 ${className}`}
        aria-label="Doppler Radar Rain Precipitation Scale"
      >
        {/* Rotated Vertical Lightning Indicator Text */}
        <div className="flex items-center justify-center">
          <span 
            className="text-[11px] font-sans font-bold text-white/95 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)] tracking-wider whitespace-nowrap select-none"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Lightning (Blitzortung)
          </span>
        </div>

        {/* Vertical Color Scale */}
        <div className="flex flex-col items-center select-none w-8.5 sm:w-9 shadow-2xl">
          {/* Header pill */}
          <div className="w-full py-0.5 rounded-t bg-black/75 backdrop-blur-md text-[10px] font-mono font-black text-cyan-300 flex items-center justify-center border-t border-x border-white/20 uppercase tracking-tighter">
            mm/h
          </div>

          {/* Color stops */}
          <div className="flex flex-col w-full rounded-b overflow-hidden border border-black/50 divide-y divide-black/20">
            {RADAR_MMH_STOPS.map((stop) => (
              <div
                key={stop.val}
                style={{ backgroundColor: stop.color }}
                className="w-full h-4 sm:h-4.5 flex items-center justify-center transition-colors"
                title={`${stop.val} mm/h`}
              >
                <span className={`text-[10px] font-mono font-bold tracking-tight leading-none ${stop.isDarkText ? 'text-black' : 'text-white'} drop-shadow-[0_0.5px_1px_rgba(0,0,0,0.7)]`}>
                  {stop.val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  const isTemp = activeLayer === 'temp';

  return (
    <aside 
      className={`select-none pointer-events-auto flex flex-col items-center gap-1 ${className}`}
      aria-label="Weather Layer Legend"
    >
      <div className="flex flex-col items-center select-none w-10 sm:w-11">
        {/* Standalone White Header Badge matching Ventusky reference */}
        {isTemp ? (
          <button
            type="button"
            onClick={onToggleTempUnit}
            title={`Active Unit: °${tempUnit} — Click to switch to °${tempUnit === 'C' ? 'F' : 'C'}`}
            className="w-full py-1 rounded-lg bg-white hover:bg-slate-50 text-[13px] font-sans font-black flex items-center justify-center transition-all cursor-pointer border border-black/35 shadow-md mb-1"
          >
            <span className="text-slate-900 font-extrabold text-[13px]">°</span>
            <span className="text-[#0284c7] font-extrabold text-[13px]">{tempUnit}</span>
          </button>
        ) : (
          <div className="w-full py-1 rounded-lg bg-white text-[10px] font-mono font-black text-[#0284c7] flex items-center justify-center border border-black/35 shadow-md mb-1 uppercase tracking-tighter">
            {activeLayer === 'precip' ? 'mm/h' : activeLayer === 'wind' ? 'km/h' : activeLayer === 'pressure' ? 'hPa' : 'Risk'}
          </div>
        )}

        {/* Color segments scale container */}
        <div className="flex flex-col w-full rounded-lg overflow-hidden border border-black/40 shadow-xl divide-y divide-black/25">
          {isTemp && TEMPERATURE_STOPS.map((stop) => {
            const displayVal = tempUnit === 'F' ? celsiusToFahrenheit(stop.c) : stop.c;
            const textColor = stop.isDarkText ? 'text-black' : 'text-white';
            const shadow = stop.isDarkText ? 'drop-shadow-[0_0.5px_0.5px_rgba(255,255,255,0.35)]' : 'drop-shadow-[0_0.5px_0.5px_rgba(0,0,0,0.55)]';
            const formattedVal = displayVal < 0 ? `\u2212${Math.abs(displayVal)}` : `${displayVal}`;

            return (
              <div
                key={stop.c}
                style={{ backgroundColor: stop.color }}
                className="w-full h-5 sm:h-5.5 flex items-center justify-center transition-colors"
                title={`${stop.c}°C / ${celsiusToFahrenheit(stop.c)}°F`}
              >
                <span className={`text-[12px] sm:text-[13px] font-sans font-black tracking-tight leading-none ${textColor} ${shadow}`}>
                  {formattedVal}
                </span>
              </div>
            );
          })}

          {activeLayer === 'precip' && RADAR_MMH_STOPS.map((stop) => (
            <div
              key={stop.val}
              style={{ backgroundColor: stop.color }}
              className="w-full h-5 sm:h-5.5 flex items-center justify-center transition-colors"
              title={stop.label}
            >
              <span className={`text-[9px] font-mono font-black tracking-tight leading-none ${stop.isDarkText ? 'text-black' : 'text-white'} drop-shadow-[0_0.5px_1px_rgba(0,0,0,0.5)]`}>
                {stop.val}
              </span>
            </div>
          ))}

          {activeLayer === 'wind' && WIND_STOPS.map((stop) => (
            <div
              key={stop.val}
              style={{ backgroundColor: stop.color }}
              className="w-full h-5 sm:h-5.5 flex items-center justify-center transition-colors"
              title={stop.label}
            >
              <span className={`text-[9px] font-mono font-black tracking-tight leading-none ${stop.isDarkText ? 'text-black' : 'text-white'} drop-shadow-[0_0.5px_1px_rgba(0,0,0,0.5)]`}>
                {stop.val}
              </span>
            </div>
          ))}

          {activeLayer === 'pressure' && PRESSURE_STOPS.map((stop) => (
            <div
              key={stop.val}
              style={{ backgroundColor: stop.color }}
              className="w-full h-5 sm:h-5.5 flex items-center justify-center transition-colors"
              title={stop.label}
            >
              <span className={`text-[9px] font-mono font-black tracking-tight leading-none ${stop.isDarkText ? 'text-black' : 'text-white'} drop-shadow-[0_0.5px_1px_rgba(0,0,0,0.5)]`}>
                {stop.val}
              </span>
            </div>
          ))}

          {activeLayer === 'convective' && CONVECTIVE_STOPS.map((stop) => (
            <div
              key={stop.val}
              style={{ backgroundColor: stop.color }}
              className="w-full h-5 sm:h-5.5 flex items-center justify-center transition-colors"
              title={stop.label}
            >
              <span className={`text-[9px] font-mono font-black tracking-tight leading-none ${stop.isDarkText ? 'text-black' : 'text-white'} drop-shadow-[0_0.5px_1px_rgba(0,0,0,0.5)]`}>
                {stop.val}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
