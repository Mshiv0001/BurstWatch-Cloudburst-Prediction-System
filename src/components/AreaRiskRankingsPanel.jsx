import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ArrowDownWideNarrow, 
  Search, 
  X, 
  Flame, 
  AlertTriangle, 
  ServerOff, 
  ChevronRight,
  TrendingUp,
  Cpu,
  Loader2,
  Zap
} from 'lucide-react';
import { getCachedMLRisk, predictLocationML } from '../services/mlPredictionService';
import { STATIONS_NETWORK } from '../data/cloudburstData';

export default function AreaRiskRankingsPanel({
  stations = STATIONS_NETWORK,
  selectedStation,
  onSelectStation,
  cloudburstEvent,
  threatData,
  onClose
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'high' | 'watch' | 'low'
  const [stationRisks, setStationRisks] = useState({});
  const [loadingIds, setLoadingIds] = useState(new Set());

  const isMlOnline = cloudburstEvent?.isLive === true;

  // Immediately store the active station's verified ML prediction whenever it updates
  useEffect(() => {
    if (selectedStation?.id && cloudburstEvent?.isLive && cloudburstEvent?.metrics?.riskPercent != null) {
      setStationRisks(prev => ({
        ...prev,
        [selectedStation.id]: cloudburstEvent.metrics.riskPercent
      }));
    }
  }, [selectedStation?.id, cloudburstEvent?.isLive, cloudburstEvent?.metrics?.riskPercent]);

  // When ML backend is live, progressively score stations via live ML model in the background
  useEffect(() => {
    if (!isMlOnline) return;

    let isCancelled = false;

    async function evaluateStations() {
      // Prioritize high-convective regions (Himalayas, Ghats, NE) first
      const priorityStations = [...stations].sort((a, b) => {
        const aElev = a.elevation || 0;
        const bElev = b.elevation || 0;
        return bElev - aElev;
      });

      for (const stn of priorityStations) {
        if (isCancelled) break;

        // Check if already scored or in client cache
        const cached = getCachedMLRisk(stn.lat, stn.lon);
        if (cached?.isLive && cached?.riskPercent != null) {
          setStationRisks(prev => {
            if (prev[stn.id] === cached.riskPercent) return prev;
            return { ...prev, [stn.id]: cached.riskPercent };
          });
          continue;
        }

        if (stationRisks[stn.id] != null) continue;

        // Mark as evaluating
        setLoadingIds(prev => new Set(prev).add(stn.id));

        try {
          const res = await predictLocationML(stn.lat, stn.lon);
          if (!isCancelled && res?.isLive && res?.riskPercent != null) {
            setStationRisks(prev => ({
              ...prev,
              [stn.id]: res.riskPercent
            }));
          }
        } catch {
          // Keep unblocked on timeout
        } finally {
          if (!isCancelled) {
            setLoadingIds(prev => {
              const next = new Set(prev);
              next.delete(stn.id);
              return next;
            });
          }
        }

        // 350ms pause between station queries to prevent Open-Meteo & backend throttling
        await new Promise(r => setTimeout(r, 350));
      }
    }

    evaluateStations();

    return () => {
      isCancelled = true;
    };
  }, [isMlOnline, stations]);

  // Rank stations strictly by real ML model outputs
  const rankedStations = useMemo(() => {
    const list = stations.map(stn => {
      let risk = stationRisks[stn.id];

      // Check if selected station has direct live event
      const isSelected = selectedStation && (
        stn.id === selectedStation.id || 
        (Math.abs(stn.lat - selectedStation.lat) < 0.05 && Math.abs(stn.lon - selectedStation.lon) < 0.05)
      );
      if (risk == null && isSelected && cloudburstEvent?.isLive && cloudburstEvent?.metrics?.riskPercent != null) {
        risk = cloudburstEvent.metrics.riskPercent;
      }

      // Check synchronous cache
      if (risk == null) {
        const cached = getCachedMLRisk(stn.lat, stn.lon);
        if (cached?.isLive && cached?.riskPercent != null) {
          risk = cached.riskPercent;
        }
      }

      return {
        ...stn,
        riskPercent: risk
      };
    });

    // If ML is online, sort stations with ML predictions highest to lowest
    if (isMlOnline) {
      return list.sort((a, b) => {
        if (a.riskPercent != null && b.riskPercent != null) {
          return b.riskPercent - a.riskPercent;
        }
        if (a.riskPercent != null) return -1;
        if (b.riskPercent != null) return 1;
        return (b.elevation || 0) - (a.elevation || 0);
      });
    }

    // When offline, sort by elevation
    return list.sort((a, b) => (b.elevation || 0) - (a.elevation || 0));
  }, [stations, selectedStation, cloudburstEvent, stationRisks, isMlOnline]);

  // Filter based on user search query and active tab
  const filteredStations = useMemo(() => {
    return rankedStations.filter(stn => {
      // Tab filter
      if (filterMode === 'high' && (stn.riskPercent == null || stn.riskPercent < 45)) return false;
      if (filterMode === 'watch' && (stn.riskPercent == null || stn.riskPercent < 20 || stn.riskPercent >= 45)) return false;
      if (filterMode === 'low' && (stn.riskPercent == null || stn.riskPercent >= 20)) return false;

      // Text search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        stn.name?.toLowerCase().includes(q) ||
        stn.region?.toLowerCase().includes(q) ||
        stn.state?.toLowerCase().includes(q)
      );
    });
  }, [rankedStations, searchQuery, filterMode]);

  const topScoredArea = rankedStations.find(s => s.riskPercent != null);
  const scoredCount = rankedStations.filter(s => s.riskPercent != null).length;

  return (
    <div className="w-[370px] sm:w-[410px] max-w-[calc(100vw-32px)] apple-liquid-glass rounded-3xl p-4 shadow-2xl border border-white/20 select-none flex flex-col max-h-[calc(100vh-95px)] backdrop-blur-2xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-500/30 to-amber-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 shadow-md">
            <ArrowDownWideNarrow className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">Area Risk Rankings</h2>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                isMlOnline 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              }`}>
                {isMlOnline ? 'ML Live' : 'ML Offline'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isMlOnline 
                ? `Real-time ML dual-ensemble (${scoredCount}/${stations.length} evaluated)` 
                : 'Model is offline, cannot calculate risk percentage'}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close Rankings Panel"
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer text-xs"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Offline Diagnostic Banner when ML is offline */}
      {!isMlOnline ? (
        <div className="mt-3 p-3 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-200 shrink-0 shadow-lg">
          <div className="flex items-center gap-2 font-bold text-xs text-rose-300">
            <ServerOff className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Model is offline, cannot calculate risk percentage</span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1 leading-snug">
            Prediction engine at <code className="font-mono text-cyan-300 text-[10px] bg-black/40 px-1 py-0.5 rounded border border-white/10">http://localhost:8000</code> is offline. No synthetic or fake percentages are shown.
          </p>
        </div>
      ) : topScoredArea && (
        /* Top Hotspot Highlight Callout (Only when live ML prediction exists) */
        <div 
          onClick={() => onSelectStation && onSelectStation(topScoredArea)}
          className="mt-3 p-2.5 rounded-2xl bg-gradient-to-r from-rose-950/70 via-red-950/40 to-slate-900/60 border border-rose-500/40 hover:border-rose-400/80 transition-all cursor-pointer shrink-0 group shadow-lg"
          title={`Click to inspect highest risk area: ${topScoredArea.name}`}
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-bold text-rose-300 uppercase tracking-wider text-[10px]">
              <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              Highest Evaluated ML Risk
            </span>
            <span className="font-mono font-black text-rose-300 text-xs px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30">
              {topScoredArea.riskPercent}% ML RISK
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white group-hover:text-rose-200 transition-colors">
                {topScoredArea.name}
              </div>
              <div className="text-[10px] text-slate-400">
                {topScoredArea.state || topScoredArea.region} • Elev: {topScoredArea.elevation}m
              </div>
            </div>
            <span className="text-[10px] font-medium text-rose-300/80 group-hover:text-rose-200 flex items-center gap-0.5">
              Fly &rarr;
            </span>
          </div>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="mt-3 space-y-2 shrink-0">
        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search areas, states, or valleys..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900/70 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/50 transition-colors font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              &times;
            </button>
          )}
        </div>

        {/* Filter Pills (only relevant when ML is online) */}
        {isMlOnline && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[10px] font-semibold">
            {[
              { id: 'all', label: `All (${rankedStations.length})` },
              { id: 'high', label: `High (≥45%)` },
              { id: 'watch', label: `Watch (20-44%)` },
              { id: 'low', label: `Low (<20%)` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-2.5 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  filterMode === tab.id
                    ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable Ranked Areas List */}
      <div className="mt-3 flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {filteredStations.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No areas found matching "{searchQuery}"
          </div>
        ) : (
          filteredStations.map((stn, index) => {
            const isSelected = selectedStation?.id === stn.id;
            const risk = stn.riskPercent;
            const isLoading = loadingIds.has(stn.id);

            return (
              <button
                key={`${stn.id}-${index}`}
                type="button"
                onClick={() => {
                  if (onSelectStation) {
                    onSelectStation(stn);
                  }
                }}
                className={`w-full text-left p-2.5 rounded-2xl transition-all flex flex-col gap-1.5 border group cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-400/60 shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-900/50 hover:bg-slate-800/60 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Rank badge + Area name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-[11px] shrink-0 ${
                      risk != null && index === 0
                        ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/40 font-black'
                        : risk != null && index === 1
                          ? 'bg-slate-300 text-slate-950 font-bold'
                          : risk != null && index === 2
                            ? 'bg-amber-700/80 text-amber-100 font-bold'
                            : 'bg-slate-800 text-slate-400'
                    }`}>
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate group-hover:text-cyan-200 transition-colors">
                        {stn.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {stn.state || stn.region} • {stn.elevation}m
                      </div>
                    </div>
                  </div>

                  {/* Risk percentage badge or status indicator */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {risk != null ? (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        risk >= 45 
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                          : risk >= 20 
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {risk}% ML Risk
                      </span>
                    ) : isMlOnline ? (
                      isLoading ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          SCORING...
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800/80 text-cyan-300/80 border border-white/10 group-hover:border-cyan-400/40">
                          RUN ML &rarr;
                        </span>
                      )
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-950/80 text-rose-300 border border-rose-500/40">
                        OFFLINE
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300 transition-transform group-hover:translate-x-0.5 shrink-0" />
                  </div>
                </div>

                {/* Subtext and progress bar */}
                {risk != null ? (
                  <div className="w-full bg-slate-950/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        risk >= 45 
                          ? 'bg-gradient-to-r from-red-500 to-rose-400' 
                          : risk >= 20 
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      }`}
                      style={{ width: `${Math.max(4, Math.min(100, risk))}%` }}
                    />
                  </div>
                ) : isMlOnline ? (
                  <div className="text-[10px] font-mono text-cyan-400/80 flex items-center gap-1">
                    {isLoading ? (
                      <span>Evaluating atmospheric features with LightGBM/XGBoost...</span>
                    ) : (
                      <span className="opacity-75">Click to run on-demand live ML inference</span>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] font-mono text-rose-400/90 flex items-center gap-1">
                    <span>Model is offline, cannot calculate risk percentage</span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
        <span>Click any area to inspect</span>
        <span className="font-mono text-cyan-400 font-bold">
          {isMlOnline 
            ? `${scoredCount}/${stations.length} Scored by ML`
            : 'ML Model Offline'}
        </span>
      </div>
    </div>
  );
}
