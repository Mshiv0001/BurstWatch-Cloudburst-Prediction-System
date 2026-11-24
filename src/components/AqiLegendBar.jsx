import React from 'react';
import { Wind, RefreshCw, Activity } from 'lucide-react';
import { getAqiCategory } from '../services/aqiService';

/**
 * AetherAura™ Planetary Air Quality Continuous Legend Bar
 *
 * Visual architecture:
 * - Continuous liquid glass gradient pill bar (EPA / CPCB harmonized)
 * - Synchronized needle indicator that tracks cursor or inspected stations
 * - Tactile numeric boundaries & threshold guidance (>50 Harmful)
 * - 30-minute resilient cache sync countdown & manual refresh trigger
 */
export default function AqiLegendBar({
  minutesRemaining = 30,
  isLoading = false,
  onForceRefresh = null,
  activeFilter = null,
  onSelectCategory = null,
  hoveredAqi = null,
  className = ""
}) {
  const AQI_GRADIENT = 'linear-gradient(to right, #10b981 0%, #10b981 12%, #f59e0b 24%, #f97316 42%, #f43f5e 62%, #a855f7 82%, #881337 100%)';
  const SCALE_STOPS = ['0', '50', '100', '150', '200', '300', '450+'];

  // Synchronized needle calculation
  let needlePct = null;
  let needleCat = null;
  if (hoveredAqi != null && !isNaN(hoveredAqi)) {
    const clamped = Math.max(0, Math.min(450, hoveredAqi));
    // Non-linear mapping to give good visual spacing to 0-200 while accommodating 450
    let norm;
    if (clamped <= 50) {
      norm = (clamped / 50) * 0.14;
    } else if (clamped <= 100) {
      norm = 0.14 + ((clamped - 50) / 50) * 0.14;
    } else if (clamped <= 200) {
      norm = 0.28 + ((clamped - 100) / 100) * 0.34;
    } else {
      norm = 0.62 + ((clamped - 200) / 250) * 0.38;
    }
    needlePct = Math.max(2, Math.min(98, norm * 100));
    needleCat = getAqiCategory(hoveredAqi);
  }

  return (
    <div className={`flex flex-col items-center pointer-events-auto select-none ${className}`}>
      <div className="flex items-center gap-2 sm:gap-3 glass-panel-translucent px-3 sm:px-5 py-1.5 rounded-full shadow-2xl border border-white/15 text-slate-200">

        {/* Title & Threshold Notice */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/10 shrink-0">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Wind className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold tracking-tight text-white flex items-center gap-1.5">
              Air Quality
            </span>
            <span className="text-[9px] font-mono text-amber-300/90 font-medium">&gt; 50 Harmful</span>
          </div>
        </div>

        {/* Continuous Gradient Track with Numeric Scale & Synchronized Needle */}
        <div className="flex flex-col gap-1 w-32 xs:w-44 sm:w-56 md:w-72 relative py-1">
          {/* Synchronized Needle */}
          {needlePct != null && needleCat && (
            <div
              className="absolute -top-6 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-75 z-30"
              style={{ left: `${needlePct}%` }}
            >
              <div
                className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold text-white shadow-lg border border-white/30 whitespace-nowrap flex items-center gap-1"
                style={{
                  backgroundColor: needleCat.color,
                  boxShadow: `0 0 10px ${needleCat.glowColor}`
                }}
              >
                <span>AQI {hoveredAqi}</span>
                <span className="opacity-80 font-normal">({needleCat.label})</span>
              </div>
              <div
                className="w-0 h-0 border-x-[3px] border-x-transparent border-t-[4px]"
                style={{ borderTopColor: needleCat.color }}
              />
            </div>
          )}

          {/* Gradient Track Bar */}
          <div className="relative h-2.5 w-full rounded-full shadow-inner overflow-hidden border border-white/25">
            <div
              className="w-full h-full"
              style={{ background: AQI_GRADIENT }}
            />
            {/* Needle indicator tick on track */}
            {needlePct != null && (
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_6px_#ffffff] -translate-x-1/2 pointer-events-none"
                style={{ left: `${needlePct}%` }}
              />
            )}
          </div>

          {/* Scale Stop Labels */}
          <div className="flex justify-between text-[8px] font-mono text-slate-400 px-0.5 tabular-nums">
            {SCALE_STOPS.map((val) => (
              <span key={val}>{val}</span>
            ))}
          </div>
        </div>

        {/* 30-min Cache Status Badge & Manual Refresh */}
        <div className="flex items-center gap-2 pl-3 border-l border-white/10 shrink-0">
          <div className="flex flex-col text-[9px] font-mono">
            <div className="flex items-center gap-1 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>30m Sync:</span>
            </div>
            <span className="font-bold text-emerald-300">
              {isLoading ? 'Updating...' : `${minutesRemaining}m left`}
            </span>
          </div>

          {onForceRefresh && (
            <button
              type="button"
              onClick={onForceRefresh}
              disabled={isLoading}
              title="Force refresh 600+ planetary stations"
              aria-label="Force refresh live AQI network"
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/15 transition-all cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
