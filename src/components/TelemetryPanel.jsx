import { useState } from 'react';
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
  CloudLightning,
  CloudHail,
  Cloud,
  Sun,
  Moon,
  CloudDrizzle,
  CloudSun
} from 'lucide-react';

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

export default function TelemetryPanel({
  station,
  timeIndex = 3,
  onOpenTrendDrawer,
  onClose
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!station) {
    return null;
  }

  // Get metrics based on station primaryMetrics and timeIndex
  const currentTimePoint = station.timeSeries?.[timeIndex] || station.timeSeries?.[3] || {};
  const primary = station.primaryMetrics || {};
  const advanced = station.advancedMetrics || {};

  const temp = currentTimePoint.temp ?? primary.temperature?.value ?? 22;
  const rainRate = currentTimePoint.rainRate ?? primary.rainfallRate?.value ?? 0;
  const pressure = currentTimePoint.pressure ?? primary.atmosphericPressure?.value ?? 1013;
  const humidity = currentTimePoint.humidity ?? primary.relativeHumidity?.value ?? 60;
  const windSpeed = currentTimePoint.windSpeed ?? primary.windSpeed?.value ?? 15;
  const windDeg = currentTimePoint.windDeg ?? primary.windDirection?.deg ?? 45;
  const cape = currentTimePoint.cape ?? advanced.cape?.value ?? 500;
  const radarDbz = currentTimePoint.radarDbz ?? advanced.radarReflectivity?.value ?? 15;
  const aqi = currentTimePoint.aqi ?? primary.aqi?.value ?? 45;

  const isHighRisk = station.riskLevel === 'HIGH';
  const isModerateRisk = station.riskLevel === 'MODERATE';

  const WeatherIcon = WEATHER_ICONS[station.icon] || CloudRain;

  return (
    <aside
      className={`absolute left-3 top-20 z-30 pointer-events-auto transition-all duration-300 ${
        isMinimized ? 'w-72' : 'w-[94%] max-w-[390px]'
      }`}
    >
      <div className="windy-glass rounded-3xl p-4 shadow-2xl flex flex-col gap-3 max-h-[calc(100vh-140px)] overflow-y-auto no-scrollbar border border-white/10">
        {/* Panel Header */}
        <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400">
              <span className="font-mono text-cyan-400">{station.stationId}</span>
              <span>•</span>
              <span>{station.region}</span>
            </div>
            <h2 className="text-base font-black text-white leading-tight mt-0.5">
              {station.stationName}
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
              <span>Elev: <strong className="text-slate-200">{station.elevation}m</strong></span>
              <span>•</span>
              <span>{station.coordinates[0].toFixed(2)}°N, {station.coordinates[1].toFixed(2)}°E</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title={isMinimized ? "Expand Panel" : "Minimize Panel"}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
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
              <span className="text-2xl font-black text-white font-mono">{temp}°C</span>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
              isHighRisk ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
              isModerateRisk ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
              'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }`}>
              {station.riskLevel} RISK
            </span>
          </div>
        ) : (
          <>
            {/* Early Warning Convective Cloudburst Risk Banner */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
              isHighRisk
                ? 'bg-gradient-to-r from-red-950/90 to-rose-950/70 border-red-500/50 text-red-200'
                : isModerateRisk
                ? 'bg-gradient-to-r from-amber-950/80 to-yellow-950/60 border-amber-500/40 text-amber-200'
                : 'bg-gradient-to-r from-emerald-950/80 to-teal-950/60 border-emerald-500/40 text-emerald-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  isHighRisk ? 'bg-red-500/30 text-red-400 animate-pulse' :
                  isModerateRisk ? 'bg-amber-500/30 text-amber-400' : 'bg-emerald-500/30 text-emerald-400'
                }`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                    Convective Early Warning
                  </div>
                  <div className="text-xs font-black">
                    {station.alertType}
                  </div>
                </div>
              </div>

              {/* Risk Probability Badge */}
              <div className="flex flex-col items-end shrink-0">
                <span className="text-base font-black font-mono leading-none">{station.riskProbability}%</span>
                <span className="text-[9px] uppercase font-semibold opacity-75">Confidence</span>
              </div>
            </div>

            {/* Current Weather Big Card with Compass Dial */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-400">
                  <WeatherIcon className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-white font-mono leading-none">{temp}°</span>
                    <span className="text-xs font-semibold text-slate-400">C</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-300 block mt-1 leading-tight">
                    {station.condition}
                  </span>
                </div>
              </div>

              {/* Wind Direction Dial */}
              <div className="flex flex-col items-center bg-slate-950/70 p-2 rounded-xl border border-white/5">
                <div className="relative w-7 h-7 flex items-center justify-center">
                  <Compass className="w-7 h-7 text-slate-600" />
                  <div 
                    style={{ transform: `rotate(${windDeg}deg)` }} 
                    className="absolute transition-transform duration-500"
                  >
                    <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
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
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                  <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Rain Rate</span>
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-base font-black text-white font-mono">{rainRate}</span>
                  <span className="text-[10px] text-slate-400 font-mono">mm/h</span>
                </div>
                <span className={`text-[9px] font-semibold ${
                  rainRate > 50 ? 'text-red-400' : rainRate > 15 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {primary.rainfallRate?.status || 'Normal'}
                </span>
              </div>

              {/* Pressure & Tendency (Critical Cloudburst Indicator) */}
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  <span>MSL Pressure</span>
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-base font-black text-white font-mono">{pressure}</span>
                  <span className="text-[10px] text-slate-400 font-mono">hPa</span>
                </div>
                <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-rose-400">
                  <TrendingDown className="w-3 h-3" />
                  <span>{primary.pressureTendency?.value || '-0.0'}</span>
                </div>
              </div>

              {/* Humidity & Dew Point */}
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                  <Droplets className="w-3.5 h-3.5 text-blue-400" />
                  <span>Rel. Humidity</span>
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-base font-black text-white font-mono">{humidity}%</span>
                  <span className="text-[10px] text-slate-400 font-mono">Dew: {primary.dewPoint?.value || 20}°</span>
                </div>
                <span className="text-[9px] text-blue-300 font-semibold truncate">
                  {primary.relativeHumidity?.status || 'Stable'}
                </span>
              </div>

              {/* Air Quality AQI */}
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Air Quality</span>
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-base font-black text-white font-mono">{aqi}</span>
                  <span className="text-[10px] text-slate-400 font-mono">AQI</span>
                </div>
                <span className={`text-[9px] font-semibold ${
                  aqi > 150 ? 'text-rose-400' : aqi > 100 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {primary.aqi?.label || 'Moderate'}
                </span>
              </div>
            </div>

            {/* Windy Hourly Mini Meteogram Strip */}
            {station.hourlyForecast && station.hourlyForecast.length > 0 && (
              <div className="flex flex-col gap-1.5 bg-slate-900/80 p-2.5 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Next 8 Hours Outlook</span>
                  <span className="text-cyan-400 font-mono">Hourly</span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {station.hourlyForecast.map((hour, idx) => {
                    const HIcon = WEATHER_ICONS[hour.icon] || CloudRain;
                    return (
                      <div
                        key={idx}
                        className="flex-1 min-w-[42px] flex flex-col items-center gap-1 text-center bg-slate-950/60 p-1.5 rounded-xl border border-white/5"
                      >
                        <span className="text-[9px] font-mono text-slate-400">{hour.time}</span>
                        <HIcon className="w-4 h-4 text-cyan-400 my-0.5" />
                        <span className="text-[11px] font-black font-mono text-white">{hour.temp}°</span>
                        {hour.rain > 0 ? (
                          <span className="text-[9px] font-mono text-blue-400 font-bold leading-none">{hour.rain}</span>
                        ) : (
                          <span className="text-[8px] font-mono text-slate-600 leading-none">-</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Advanced Radar & Atmospheric Convection (Collapsible) */}
            <div className="border-t border-white/5 pt-2 flex flex-col gap-2">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between text-[11px] font-bold text-slate-300 hover:text-white px-1 py-1 rounded-lg hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Advanced Doppler & Convective Physics</span>
                </div>
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/70 p-2.5 rounded-xl border border-white/5">
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">Radar Reflectivity</span>
                    <span className="font-bold text-rose-400">{radarDbz} dBZ</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">CAPE Instability</span>
                    <span className="font-bold text-amber-300">{cape} J/kg</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">Echo Top Height</span>
                    <span className="font-bold text-slate-200">{advanced.echoTopHeight?.value || 12} km</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">Cloud Top Temp</span>
                    <span className="font-bold text-cyan-300">{advanced.cloudTopTemp?.value || -60}°C</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">CIN (Inhibition)</span>
                    <span className="font-bold text-slate-300">{advanced.cin?.value || 10} J/kg</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">Historical Anomaly</span>
                    <span className="font-bold text-red-400">{advanced.historicalAnomaly?.value || '+150%'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Expand Bottom Trend Drawer Action */}
            <button
              onClick={onOpenTrendDrawer}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/50 hover:to-blue-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Open Synoptic Meteogram Graph</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}