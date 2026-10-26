import React, { useState, useEffect, useRef } from 'react';
import { 
  Droplets, 
  CloudRain, 
  Gauge, 
  Activity, 
  AlertTriangle, 
  Zap, 
  Compass, 
  ChevronDown, 
  ChevronUp, 
  TrendingDown, 
  Maximize2, 
  Minimize2, 
  X,
  RotateCw,
  Wind,
  Cloud,
  Sun,
  Moon,
  CloudSun,
  CloudLightning,
  CloudHail,
  CloudDrizzle,
  Radio,
  Clock,
  Layers,
  Globe
} from 'lucide-react';
import { isIndiaSector } from '../utils/geoUtils';

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
import { celsiusToFahrenheit } from '../utils/temperatureUtils';

export default function LiveMeteoPanel({
  liveData,
  station,
  isLoading = false,
  onRefresh,
  onOpenTrendDrawer,
  onClose,
  tempUnit = 'C'
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // Actively tick every second to keep the clock live and working
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
  const temp = data.temperature ?? station?.temp ?? 22;
  const humidity = data.humidity ?? station?.humidity ?? 65;
  const pressure = data.pressure ?? 1012;
  const windSpeed = data.windSpeed ?? station?.windSpeed ?? 15;
  const windGusts = data.windGusts ?? (windSpeed * 1.4);
  const windDir = data.windDirection ?? 45;
  const rainRate = data.precipitation ?? data.rainRate ?? station?.rainfallRate ?? 0;
  const cloudCover = data.cloudCover ?? 60;
  const condition = data.condition || station?.condition || 'Convective Air Mass';
  const isLive = data.isLive ?? true;
  const source = data.source || 'Open-Meteo Real-Time (ECMWF/GFS)';

  const threat = data.threat || null;
  const isIndia = data.isIndia ?? (station ? isIndiaSector(station.lon ?? station.lng, station.lat) : true);

  const isCritical = threat?.severity === 'CRITICAL';
  const isHigh = threat?.severity === 'HIGH';
  const isModerate = threat?.severity === 'MODERATE';

  const WeatherIcon = WEATHER_ICONS[data.icon] || CloudRain;

  return (
    <aside
      className={`pointer-events-auto transition-all duration-300 select-none ${
        isMinimized ? 'w-72' : 'w-[360px] max-w-[calc(100vw-32px)]'
      }`}
    >
      <div className="apple-liquid-glass rounded-3xl p-4 flex flex-col gap-3 text-white max-h-[calc(100vh-120px)] overflow-y-auto no-scrollbar shadow-2xl">
        {/* Panel Header */}
        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10">
          <div>
            {/* Live Station Local Clock (API time, continuously ticking) */}
            <div className="apple-liquid-glass-pill flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono text-cyan-300 w-fit">
              <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
              <span className="font-semibold tracking-wide">{formattedTime}</span>
            </div>

            <h2 className="text-base font-extrabold text-white leading-tight mt-1.5">
              {data.stationName || station?.name || station?.stationName || "Himalayan Sector"}
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
              <span>Elev: <strong className="text-slate-200">{data.elevation ?? station?.elevation ?? 1800}m</strong></span>
              <span>•</span>
              <span>
                {data.coordinates ? `${data.coordinates[0].toFixed(2)}°N, ${data.coordinates[1].toFixed(2)}°E` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="apple-liquid-glass-pill p-1.5 rounded-full text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Refresh Live Data from WeatherAPI"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="apple-liquid-glass-pill p-1.5 rounded-full text-slate-300 hover:text-white transition-all cursor-pointer"
              title={isMinimized ? "Expand Panel" : "Minimize Panel"}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="apple-liquid-glass-pill p-1.5 rounded-full text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Minimized View */}
        {isMinimized ? (
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2.5">
              <WeatherIcon className="w-6 h-6 text-cyan-400" />
              <span className="text-2xl font-black text-white font-mono">
                {tempUnit === 'F' ? celsiusToFahrenheit(temp) : temp}°{tempUnit}
              </span>
            </div>
            {threat ? (
              <span className={`apple-liquid-glass-pill px-3 py-1 rounded-full text-[10px] font-bold ${
                isCritical ? 'apple-liquid-glass-crimson text-red-200' :
                isHigh ? 'apple-liquid-glass-amber text-amber-200' :
                'apple-liquid-glass-emerald text-emerald-200'
              }`}>
                {threat.riskPercent}% RISK
              </span>
            ) : (
              <span className="apple-liquid-glass-pill px-3 py-1 rounded-full text-[10px] font-bold text-sky-300">
                GLOBAL
              </span>
            )}
          </div>
        ) : (
          <>
            {/* Live Convective Cloudburst Threat Banner (India) vs Global Synoptic Banner */}
            {threat ? (
              <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-xl ${
                isCritical
                  ? 'apple-liquid-glass-crimson text-red-200'
                  : isHigh
                  ? 'apple-liquid-glass-amber text-amber-200'
                  : 'apple-liquid-glass-emerald text-emerald-200'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isCritical ? 'bg-red-500/30 text-red-300 animate-pulse' :
                    isHigh ? 'bg-amber-500/30 text-amber-300' : 'bg-emerald-500/30 text-emerald-300'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                      Live Convective Hazard (🇮🇳 India)
                    </div>
                    <div className="text-xs font-bold leading-tight">
                      {threat.severity} CLOUDBURST RISK
                    </div>
                  </div>
                </div>

                {/* Risk Percentage Badge */}
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-xl font-black font-mono leading-none">{threat.riskPercent}%</span>
                  <span className="text-[9px] uppercase font-semibold opacity-75">Index</span>
                </div>
              </div>
            ) : (
              <div className="apple-liquid-glass-cyan p-3.5 rounded-2xl text-sky-200 flex items-center justify-between gap-3 shadow-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-sky-500/25 text-sky-200">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-sky-300">
                      🌐 Global Synoptic Monitoring
                    </div>
                    <div className="text-xs font-semibold leading-tight text-slate-200">
                      Real-time WeatherAPI.com observations active
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="apple-liquid-glass-pill text-[9px] font-mono px-2.5 py-0.5 rounded-full text-sky-300">
                    Global Scope
                  </span>
                </div>
              </div>
            )}

            {/* Current Weather Card with Compass Dial */}
            <div className="apple-liquid-glass-well p-3.5 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="apple-liquid-glass-pill p-2.5 rounded-2xl text-cyan-300">
                  <WeatherIcon className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-white font-mono leading-none">
                      {tempUnit === 'F' ? celsiusToFahrenheit(temp) : temp}°
                    </span>
                    <span className="text-xs font-semibold text-slate-400">{tempUnit}</span>
                    {data.apparentTemperature != null && (
                      <span className="text-[11px] font-mono text-slate-400 ml-1">
                        Feels {tempUnit === 'F' ? celsiusToFahrenheit(data.apparentTemperature) : data.apparentTemperature}°
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-300 block mt-1 leading-tight">
                    {condition}
                  </span>
                </div>
              </div>

              {/* Wind Direction Dial */}
              <div className="apple-liquid-glass-pill flex flex-col items-center px-3 py-1.5 rounded-xl">
                <div className="relative w-6 h-6 flex items-center justify-center">
                  <Compass className="w-6 h-6 text-slate-400" />
                  <div 
                    style={{ transform: `rotate(${windDir}deg)` }} 
                    className="absolute transition-transform duration-500"
                  >
                    <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                    </svg>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-200 mt-0.5">
                  {windSpeed} <span className="text-[8px] text-slate-400">km/h</span>
                </span>
              </div>
            </div>

            {/* Primary Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Rainfall Rate */}
              <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                  <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Live Precip Rate</span>
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-base font-black text-white font-mono">{rainRate.toFixed(1)}</span>
                  <span className="text-[10px] text-slate-400 font-mono">mm/h</span>
                </div>
                <span className={`text-[9px] font-semibold ${
                  rainRate > 20 ? 'text-red-400' : rainRate > 5 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {rainRate > 20 ? 'Torrential Cloudburst' : rainRate > 5 ? 'Convective Showers' : 'Nominal'}
                </span>
              </div>

              {/* Pressure & Tendency */}
              <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  <span>Surface Pressure</span>
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-base font-black text-white font-mono">{pressure}</span>
                  <span className="text-[10px] text-slate-400 font-mono">hPa</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-rose-400">
                  <TrendingDown className="w-3 h-3" />
                  <span>{pressure < 1000 ? 'Deep Depression' : 'Stable'}</span>
                </div>
              </div>

              {/* Humidity */}
              <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                  <Droplets className="w-3.5 h-3.5 text-blue-400" />
                  <span>Rel. Humidity</span>
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-base font-black text-white font-mono">{humidity}%</span>
                  <span className="text-[10px] text-slate-400 font-mono">Sat</span>
                </div>
                <span className={`text-[9px] font-semibold truncate ${humidity > 85 ? 'text-rose-400' : 'text-blue-300'}`}>
                  {humidity > 85 ? 'Moisture Saturated' : 'Normal Vapor'}
                </span>
              </div>

              {/* Wind Gusts */}
              <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                  <Wind className="w-3.5 h-3.5 text-sky-400" />
                  <span>Peak Wind Gusts</span>
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-base font-black text-white font-mono">{Math.round(windGusts)}</span>
                  <span className="text-[10px] text-slate-400 font-mono">km/h</span>
                </div>
                <span className={`text-[9px] font-semibold ${windGusts > 45 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {windGusts > 45 ? 'High Orographic Shear' : 'Calm / Moderate'}
                </span>
              </div>
            </div>

            {/* Next 8 Hours Live Meteogram Strip */}
            {data.hourlySeries && data.hourlySeries.length > 0 && (
              <div className="apple-liquid-glass-well p-3 rounded-2xl flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-cyan-400" />
                    <span>Live 8-Hour Meteo Outlook</span>
                  </span>
                  <span className="text-cyan-400 font-mono">Hourly</span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {data.hourlySeries.slice(0, 8).map((hour, idx) => (
                    <div
                      key={idx}
                      className="apple-liquid-glass-pill flex-1 min-w-[42px] flex flex-col items-center gap-0.5 text-center p-1.5 rounded-xl"
                    >
                      <span className="text-[8px] font-mono text-slate-300">{hour.time}</span>
                      <CloudRain className="w-3.5 h-3.5 text-cyan-400 my-0.5" />
                      <span className="text-[10px] font-black font-mono text-white">
                        {tempUnit === 'F' ? celsiusToFahrenheit(hour.temp) : hour.temp}°
                      </span>
                      {hour.rainRate > 0 ? (
                        <span className="text-[8px] font-mono text-blue-300 font-bold leading-none">{hour.rainRate.toFixed(1)}</span>
                      ) : (
                        <span className="text-[8px] font-mono text-slate-500 leading-none">-</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Advanced Convective Model Diagnostics (Collapsible) */}
            <div className="border-t border-white/10 pt-1.5 flex flex-col gap-2">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-[11px] font-bold text-slate-300 hover:text-white px-2 py-1.5 rounded-xl apple-liquid-glass-pill transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Atmospheric & Orographic Physics</span>
                </div>
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAdvanced && (
                <div className="apple-liquid-glass-well grid grid-cols-2 gap-2 text-xs font-mono p-3 rounded-2xl">
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">Cloud Fraction</span>
                    <span className="font-bold text-cyan-300">{cloudCover}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">Pressure Deficit</span>
                    <span className="font-bold text-amber-300">{(1013 - pressure)} hPa</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">Model Engine</span>
                    <span className="font-bold text-slate-200">ECMWF IFS / GFS</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">Telemetry Sync</span>
                    <span className="font-bold text-emerald-400">Active Live</span>
                  </div>
                </div>
              )}
            </div>

            {/* Expand Bottom Synoptic Meteogram Graph Action */}
            {onOpenTrendDrawer && (
              <button
                onClick={onOpenTrendDrawer}
                className="apple-liquid-glass-pill w-full py-2.5 px-3 rounded-full text-cyan-200 text-xs font-bold flex items-center justify-center gap-2 border border-cyan-400/40 shadow-lg cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>Open Synoptic Meteogram Graph</span>
              </button>
            )}

            {/* Provider attribution footer */}
            <div className="text-[9px] font-mono text-slate-500 text-center pt-0.5">
              Live Weather Feed: <span className="text-slate-400">{source}</span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
