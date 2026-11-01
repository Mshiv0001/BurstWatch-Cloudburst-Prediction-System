import React, { useState } from 'react';
import { 
  AlertTriangle, 
  MapPin, 
  Zap, 
  Clock, 
  Crosshair, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  CloudRain,
  X,
  Cpu,
  RefreshCw,
  ServerOff,
  Activity,
  CheckCircle2
} from 'lucide-react';

export default function CloudburstEventCard({
  event,
  riskPercent,
  onFocusEpicenter,
  onRetry,
  isRetrying = false,
  onClose,
  className = ""
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!event) return null;

  const isLive = event.isLive !== false && event.status !== 'OFFLINE';
  const displayRisk = riskPercent ?? event.metrics?.riskPercent ?? event.mlModel?.confidencePercent ?? 0;
  const isCritical = displayRisk >= 75 || event.status === 'CRITICAL';
  const isElevated = displayRisk >= 25 || event.isAlertActive;

  // 1. Backend Offline / Unreachable Diagnostic Report View
  if (!isLive) {
    return (
      <aside 
        className={`select-none pointer-events-auto transition-all duration-300 z-30 ${className}`}
        aria-label="Cloudburst Prediction Engine Offline Report"
      >
        <div className="w-[330px] sm:w-[380px] bg-[#0c1524]/95 backdrop-blur-xl border border-rose-500/40 rounded-2xl shadow-[0_8px_32px_rgba(244,63,94,0.25)] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 px-3.5 py-2 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <ServerOff className="w-3.5 h-3.5 text-rose-200" />
              <span className="text-[11px] font-mono font-black tracking-wider uppercase">
                PREDICTION ENGINE OFFLINE
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                title={isExpanded ? "Collapse Alert Card" : "Expand Alert Card"}
                className="p-1 rounded-md hover:bg-white/20 transition-colors cursor-pointer"
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  title="Dismiss Card"
                  className="p-1 rounded-md hover:bg-white/20 transition-colors cursor-pointer text-white/80 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Compact View */}
          {!isExpanded && (
            <div className="px-3.5 py-2.5 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  ML Backend Unreachable
                </span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                  http://localhost:8000
                </span>
              </div>
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                className="px-2.5 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry
              </button>
            </div>
          )}

          {/* Expanded Diagnostics */}
          {isExpanded && (
            <div className="p-3.5 flex flex-col gap-3">
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-rose-200">
                <div className="flex items-center gap-2 mb-1.5 font-bold text-xs text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Real-Time Prediction Engine Not Responding</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  The dashboard is connected directly to the Dual-Engine ML service (LightGBM + XGBoost). Zero hardcoded preset scenarios are in use.
                </p>
                <div className="mt-2.5 p-2 rounded-lg bg-black/60 border border-white/10 font-mono text-[10px] text-rose-300 break-all">
                  {event.error || 'Connection refused at http://localhost:8000'}
                </div>
              </div>

              {/* Startup Instruction */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex flex-col gap-1 text-[11px]">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  To start the backend ML service:
                </span>
                <code className="bg-black/60 border border-white/10 p-1.5 rounded text-[10px] font-mono text-cyan-300 select-all">
                  uvicorn app.main:create_app --factory --port 8000
                </code>
              </div>

              {/* Action Bar */}
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/20 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Connecting to ML Engine...' : 'Retry Connection to Backend'}</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // 2. Live ML Cloudburst Warning Telemetry Card
  return (
    <aside 
      className={`select-none pointer-events-auto transition-all duration-300 z-30 ${className}`}
      aria-label="Live Cloudburst Prediction Alert"
    >
      <div className={`w-[330px] sm:w-[380px] bg-[#0c1524]/92 backdrop-blur-xl rounded-2xl overflow-hidden border ${
        isCritical 
          ? 'border-rose-500/50 shadow-[0_8px_32px_rgba(244,63,94,0.3)]' 
          : isElevated 
            ? 'border-amber-500/50 shadow-[0_8px_32px_rgba(245,158,11,0.25)]' 
            : 'border-emerald-500/30 shadow-[0_8px_32px_rgba(16,185,129,0.15)]'
      }`}>
        {/* Banner */}
        <div className={`px-3.5 py-1.5 flex items-center justify-between text-white ${
          isCritical 
            ? 'bg-gradient-to-r from-rose-600 via-red-600 to-orange-600' 
            : isElevated
              ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600'
              : 'bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isElevated ? 'bg-white animate-pulse' : 'bg-emerald-300'}`} />
            <span className="text-[11px] font-mono font-black tracking-wider uppercase">
              {isCritical ? 'LIVE CLOUDBURST WARNING' : isElevated ? 'LIVE CONVECTIVE ALERT' : 'LIVE ML: NORMAL CONVECTIVE STATE'}
            </span>
            <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-black border ${
              isElevated 
                ? 'bg-black/40 text-rose-200 border-white/20' 
                : 'bg-emerald-950/70 text-emerald-200 border-emerald-400/30'
            }`}>
              {displayRisk}% ML RISK
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? "Collapse Alert Card" : "Expand Alert Card"}
              className="p-1 rounded-md hover:bg-white/20 transition-colors cursor-pointer"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Dismiss Cloudburst Alert Card"
                className="p-1 rounded-md hover:bg-white/20 transition-colors cursor-pointer text-white/80 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Collapsed View */}
        {!isExpanded && (
          <div className="px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white flex items-center gap-1">
                <MapPin className={`w-3 h-3 ${isElevated ? 'text-rose-400' : 'text-emerald-400'}`} />
                {event.locationName}
              </span>
              <span className={`text-[10px] font-mono ${isElevated ? 'text-rose-200' : 'text-emerald-200'}`}>
                <span className={`font-bold px-1.5 py-0.2 rounded border mr-1.5 ${
                  isElevated 
                    ? 'text-rose-200 bg-rose-950/80 border-rose-500/30' 
                    : 'text-emerald-200 bg-emerald-950/80 border-emerald-500/30'
                }`}>
                  {displayRisk}% ML
                </span>
                {event.metrics?.predictedRainRateMmh || 0} mm/h • {event.leadTimeMinutes}m lead time
              </span>
            </div>
            <button
              type="button"
              onClick={onFocusEpicenter}
              className={`px-2.5 py-1 rounded-full text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow ${
                isElevated ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <Crosshair className="w-3 h-3" />
              {isElevated ? 'Focus' : 'Locate'}
            </button>
          </div>
        )}

        {/* Expanded Telemetry View */}
        {isExpanded && (
          <div className="p-3.5 flex flex-col gap-3">
            {/* Location & Time Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5 tracking-tight">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{event.locationName}</span>
                </h3>
                <p className="text-[11px] text-slate-300 pl-5">
                  Elevation: <span className="font-mono text-white">{event.elevationMeters}m</span> • Sector: {event.state}
                </p>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-xs font-mono font-black text-white">{displayRisk}% CRI</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1">
                  Ensemble: {event.mlModel?.riskLevel || 'HIGH_RISK'}
                </span>
                <span className="text-[9px] text-slate-400 mt-0.5">
                  Timestamp {event.detectedAt}
                </span>
              </div>
            </div>

            {/* Key Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 bg-black/40 p-2.5 rounded-xl border border-white/10">
              {/* Rain Rate */}
              <div className="flex flex-col bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                  <CloudRain className="w-3 h-3 text-cyan-400" />
                  Predicted Rain Rate
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-mono font-black text-white">
                    {event.metrics?.predictedRainRateMmh}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-300">mm/h</span>
                </div>
                <span className="text-[9px] text-rose-400 font-semibold mt-0.5">
                  Cloudburst threshold ≥100mm/h
                </span>
              </div>

              {/* Early Warning Lead Time */}
              <div className="flex flex-col bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  Estimated Lead Time
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-mono font-black text-amber-300">
                    ~{event.leadTimeMinutes}
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">mins</span>
                </div>
                <span className="text-[9px] text-amber-400/90 font-semibold mt-0.5">
                  Advance warning window
                </span>
              </div>

              {/* CAPE Energy */}
              <div className="flex flex-col bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  CAPE Convective Energy
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-base font-mono font-bold text-yellow-300">
                    {event.metrics?.capeJkg}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">J/kg</span>
                </div>
                <span className="text-[9px] text-yellow-400/80 font-medium">Extreme updraft energy</span>
              </div>

              {/* Pressure Collapse */}
              <div className="flex flex-col bg-white/5 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] font-medium text-slate-400">
                  Tropospheric Drop (ΔP)
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-base font-mono font-bold text-rose-300">
                    -{event.metrics?.pressureDropHpa}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">hPa/3h</span>
                </div>
                <span className="text-[9px] text-rose-400/80 font-medium">Rapid barometric plunge</span>
              </div>
            </div>

            {/* Top ML Risk Factors if returned by backend */}
            {event.topFactors && event.topFactors.length > 0 && (
              <div className="flex flex-col gap-1 text-[11px]">
                <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                  Top Atmospheric Risk Factors:
                </span>
                <div className="flex flex-wrap gap-1">
                  {event.topFactors.map((factor, idx) => (
                    <span 
                      key={idx}
                      className="px-2 py-0.5 rounded bg-white/10 text-cyan-200 font-mono text-[9px] border border-cyan-500/20"
                    >
                      {factor.name || factor.feature || factor}: {factor.value ? Number(factor.value).toFixed(1) : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Affected River Drainage Corridors */}
            {event.affectedBasins && event.affectedBasins.length > 0 && (
              <div className="flex flex-col gap-1 text-[11px]">
                <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                  High-Risk Basins ({event.hazardRadiusKm} km radius):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {event.affectedBasins.map((basin) => (
                    <span 
                      key={basin}
                      className="px-2 py-0.5 rounded-md bg-red-950/60 text-red-200 border border-red-500/30 text-[10px] font-medium"
                    >
                      {basin}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Advisory */}
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 text-[11px] text-rose-100 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="leading-tight font-medium">
                {event.advisory}
              </p>
            </div>

            {/* Focus Epicenter Button */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onFocusEpicenter}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/20 cursor-pointer active:scale-95 transition-all"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Focus Hazard Epicenter
              </button>
            </div>

            {/* Backend ML Engine Footer */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-white/10 pt-2 px-0.5">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-semibold">Dual-Engine ML Live:</span>
              </div>
              <span className="font-mono text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30 text-[9px] flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                LightGBM + XGBoost
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
