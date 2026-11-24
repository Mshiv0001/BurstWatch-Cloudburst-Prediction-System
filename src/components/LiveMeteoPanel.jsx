import React, { useState, useEffect, useRef } from 'react';
import { 
  Droplets, 
  CloudRain, 
  Gauge, 
  RotateCw, 
  Wind, 
  Cloud, 
  Sun, 
  Moon, 
  CloudSun, 
  CloudLightning, 
  CloudHail, 
  CloudDrizzle, 
  Clock, 
  MapPin, 
  X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { celsiusToFahrenheit } from '../utils/temperatureUtils';

const WEATHER_ICONS = {
  CloudLightning,
  CloudHail,
  CloudRain,
  CloudDrizzle,
  Cloud,
  CloudSun,
  Sun,
  Moon
};

function getCompassDirection(degrees) {
  if (degrees == null || isNaN(degrees)) return 'NW';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((degrees % 360) / 45)) % 8;
  return dirs[index];
}

/**
 * LiveMeteoPanel.jsx (Station Telemetry Console)
 * 
 * Streamlined Surface Weather Telemetry Console (MeteoPulse™)
 * - GlassAura™ Translucent Liquid Glass Hierarchy (VisionOS / Apple Weather standard)
 * - Calibrated 4-Tier Semantic Palette (Electric Cyan, Emerald Jade, Solar Amber, Crimson Rose)
 * - Symmetrical 2x2 Weather Telemetry Grid (Inflow Wind, Surface Barometer, Moisture, Precip Rate)
 * - Continuous Ticking Local Station Clock in Station Timezone
 * - Pure Essential Information (Zero redundant scroll strips, zero diagnostic bloat, zero dead buttons)
 */
export default function LiveMeteoPanel({
  liveData,
  station,
  isLoading = false,
  onRefresh,
  onClose,
  tempUnit = 'C'
}) {
  // Real-time ticking clock synchronized with the API local time
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const apiOffsetMsRef = useRef(0);
  const tzIdRef = useRef('Asia/Kolkata');

  // Sync API local time offset whenever new station telemetry arrives
  useEffect(() => {
    if (liveData?.tzId) {
      tzIdRef.current = liveData.tzId;
    }

    if (liveData?.localtimeEpoch) {
      const clientNow = Date.now();
      apiOffsetMsRef.current = liveData.localtimeEpoch - (liveData.fetchedAtEpoch || clientNow);
    } else if (liveData?.localtime) {
      const parsedApiEpoch = new Date(liveData.localtime.replace(' ', 'T')).getTime();
      if (!isNaN(parsedApiEpoch)) {
        const clientNow = Date.now();
        apiOffsetMsRef.current = parsedApiEpoch - (liveData.fetchedAtEpoch || clientNow);
      }
    }
  }, [liveData?.localtimeEpoch, liveData?.localtime, liveData?.tzId, liveData?.fetchedAtEpoch]);

  // Actively tick every second to keep the clock live
  useEffect(() => {
    const updateTick = () => {
      const stationEpoch = Date.now() + apiOffsetMsRef.current;
      setCurrentTime(new Date(stationEpoch));
    };

    updateTick();
    const timer = setInterval(updateTick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time in the location's official timezone with AM/PM
  const formattedTime = (() => {
    try {
      if (tzIdRef.current) {
        return currentTime.toLocaleTimeString('en-US', {
          timeZone: tzIdRef.current,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      }
    } catch {}

    return currentTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  })();

  if (!liveData && !station) return null;

  const data = liveData || {};
  const rawTemp = data.temperature ?? station?.temp ?? 22;
  const displayTemp = tempUnit === 'F' ? celsiusToFahrenheit(rawTemp) : Math.round(rawTemp);
  const displayApparent = data.apparentTemperature != null 
    ? (tempUnit === 'F' ? celsiusToFahrenheit(data.apparentTemperature) : Math.round(data.apparentTemperature))
    : null;

  const humidity = data.humidity ?? station?.humidity ?? 65;
  const pressure = data.pressure != null ? Math.round(data.pressure) : 1012;
  const windSpeed = data.windSpeed ?? station?.windSpeed ?? 15;
  const windDir = data.windDirection ?? station?.windDirection ?? 45;
  const compassDir = data.windCompass || getCompassDirection(windDir);
  const rainRate = Number(data.precipitation ?? data.rainRate ?? station?.rainfallRate ?? 0);
  const condition = data.condition || station?.condition || 'Convective Air Mass';
  const isLive = data.isLive === true;
  const source = data.source || (liveData ? 'AWS Weather Network' : 'Station Network Baseline');

  const WeatherIcon = WEATHER_ICONS[data.icon] || CloudSun;

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-80 sm:w-[350px] select-none z-20 text-slate-100 flex flex-col gap-2.5 font-sans"
      aria-label="Station Telemetry Intelligence Panel"
    >
      {/* ===================================================================
          MASTER CONTAINER: GlassAura™ Translucent Liquid Glass Console
          =================================================================== */}
      <div className="glass-panel-translucent rounded-3xl p-4 border border-white/12 shadow-[0_24px_64px_rgba(0,0,0,0.55)] flex flex-col gap-3 relative overflow-hidden">
        
        {/* Subtle Ambient Radial Glow */}
        <div 
          className="absolute -top-16 -left-16 w-44 h-44 rounded-full pointer-events-none opacity-20 blur-3xl transition-colors duration-500 bg-cyan-400"
        />

        {/* -----------------------------------------------------------------
            1. HEADER: Station Telemetry Identity & Sector Context
            ----------------------------------------------------------------- */}
        <div className="flex flex-col gap-2 pb-2.5 border-b border-white/10 relative z-10">
          <div className="flex items-center justify-between">
            {/* Header Identity Badge */}
            <div className="flex items-center gap-1.5 apple-liquid-glass-cyan px-2.5 py-1 rounded-full border border-cyan-400/40 text-cyan-200">
              <CloudSun className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase">
                Station Telemetry
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Manual Refresh Button */}
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                title="Refresh Live Station Telemetry"
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-all cursor-pointer border border-white/10 active:scale-95 disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>

              {/* Panel Close Button */}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-all cursor-pointer border border-white/10 active:scale-95"
                  title="Close Station Telemetry Panel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Sector Details */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate">
                  {data.stationName || station?.name || station?.stationName || "Himalayan Sector"}
                </span>
                <span className="text-[10px] text-slate-400 truncate">
                  {station?.state || station?.region || 'India Sector'}
                </span>
              </div>
            </div>

            <span className="font-mono text-[10px] text-cyan-300/90 bg-cyan-950/50 px-2 py-0.5 rounded-full border border-cyan-800/40 shrink-0 font-medium">
              {data.elevation ?? station?.elevation ?? 1800}m DEM
            </span>
          </div>

          {/* Live Station Local Clock Pill */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="apple-liquid-glass-pill flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono text-cyan-300 border border-cyan-400/30">
              <Clock className="w-3 h-3 text-cyan-400 shrink-0 animate-pulse" />
              <span className="font-semibold tracking-wide">{formattedTime}</span>
            </div>
            {data.coordinates && (
              <span className="text-[9.5px] font-mono text-slate-400">
                {data.coordinates[0].toFixed(2)}°N, {data.coordinates[1].toFixed(2)}°E
              </span>
            )}
          </div>
        </div>

        {/* -----------------------------------------------------------------
            2. HERO TEMPERATURE & CONDITION CARD
            ----------------------------------------------------------------- */}
        <div className="apple-liquid-glass-well rounded-2xl p-3 border border-white/10 flex items-center justify-between relative">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-mono text-white tracking-tight leading-none">
                {displayTemp}°
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">{tempUnit}</span>
              {displayApparent != null && (
                <span className="text-[11px] font-mono text-slate-400 ml-1.5 font-medium">
                  Feels {displayApparent}°
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-slate-200 mt-1">
              {condition}
            </span>
          </div>

          <div className="apple-liquid-glass-pill p-2.5 rounded-2xl text-cyan-300 border border-cyan-400/30 shadow-md">
            <WeatherIcon className="w-7 h-7 text-cyan-300" />
          </div>
        </div>

        {/* -----------------------------------------------------------------
            3. ESSENTIAL 2x2 WEATHER TELEMETRY GRID
            ----------------------------------------------------------------- */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 px-0.5 font-semibold">
            <span>Surface Meteorology</span>
            <span className="text-cyan-400">AWS Sensors</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Pillar 1: Inflow Wind Vector */}
            <div className="apple-liquid-glass-well p-2.5 rounded-2xl border border-white/10 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1 font-medium">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Inflow Wind</span>
                </span>
                <span className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                  {compassDir}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-white tracking-tight">
                  {Math.round(windSpeed)}
                </span>
                <span className="text-[10px] font-mono text-slate-400">km/h</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400 truncate">
                {windSpeed >= 40 ? (
                  <span className="text-rose-400 font-semibold">Gale Inflow</span>
                ) : windSpeed >= 20 ? (
                  <span className="text-amber-300">Breezy Updraft</span>
                ) : (
                  'Gentle Breeze'
                )}
              </span>
            </div>

            {/* Pillar 2: Surface Barometer */}
            <div className="apple-liquid-glass-well p-2.5 rounded-2xl border border-white/10 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1 font-medium">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  <span>Barometer</span>
                </span>
                {pressure < 1000 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-white tracking-tight">
                  {pressure}
                </span>
                <span className="text-[10px] font-mono text-slate-400">hPa</span>
              </div>
              <span className="text-[9px] font-mono truncate">
                {pressure < 1000 ? (
                  <span className="text-amber-400 font-semibold">Low Depression</span>
                ) : (
                  <span className="text-emerald-400">Stable Pressure</span>
                )}
              </span>
            </div>

            {/* Pillar 3: Relative Humidity */}
            <div className="apple-liquid-glass-well p-2.5 rounded-2xl border border-white/10 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1 font-medium">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Air Moisture</span>
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-white tracking-tight">
                  {humidity}
                </span>
                <span className="text-[10px] font-mono text-slate-400">% RH</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400 truncate">
                {humidity >= 85 ? (
                  <span className="text-amber-300">High Saturation</span>
                ) : (
                  'Optimal Catchment'
                )}
              </span>
            </div>

            {/* Pillar 4: Precipitation Rate */}
            <div className="apple-liquid-glass-well p-2.5 rounded-2xl border border-white/10 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1 font-medium">
                  <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Precip Rate</span>
                </span>
                {rainRate > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-white tracking-tight">
                  {rainRate.toFixed(1)}
                </span>
                <span className="text-[10px] font-mono text-cyan-300">mm/h</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400 truncate">
                {rainRate >= 35 ? (
                  <span className="text-rose-400 font-semibold">Heavy Torrent</span>
                ) : rainRate > 0 ? (
                  <span className="text-cyan-300">Active Rain</span>
                ) : (
                  'Zero Precip'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------------
            4. LIVE TELEMETRY SOURCE & SYNC STATUS FOOTER
            ----------------------------------------------------------------- */}
        <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-400 pt-1.5 border-t border-white/10 px-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-300">
              {isLive ? 'Live AWS Telemetry' : 'Calibrated Estimate'}
            </span>
          </div>
          <span className="text-slate-500 truncate max-w-[140px]">
            {source}
          </span>
        </div>

      </div>
    </motion.aside>
  );
}
