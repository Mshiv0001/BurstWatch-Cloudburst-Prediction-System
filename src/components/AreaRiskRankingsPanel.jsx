import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowDownWideNarrow, 
  Search, 
  X, 
  Flame, 
  ServerOff, 
  ChevronRight,
  Loader2,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
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

  const topRisk = topScoredArea?.riskPercent ?? 0;
  const topRiskTier = topRisk >= 45
    ? {
        hoverBorder: 'hover:border-rose-400/50',
        titleText: 'text-rose-300',
        iconText: 'text-rose-400 animate-pulse',
        pill: 'bg-rose-500/20 text-rose-300 border-rose-500/35',
        nameHover: 'group-hover:text-rose-200',
      }
    : topRisk >= 20
      ? {
          hoverBorder: 'hover:border-amber-400/50',
          titleText: 'text-amber-300',
          iconText: 'text-amber-400',
          pill: 'bg-amber-500/20 text-amber-300 border-amber-500/35',
          nameHover: 'group-hover:text-amber-200',
        }
      : {
          hoverBorder: 'hover:border-emerald-400/50',
          titleText: 'text-emerald-300',
          iconText: 'text-emerald-400',
          pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35',
          nameHover: 'group-hover:text-emerald-200',
        };

  const glowColor = !isMlOnline
    ? '#f43f5e'
    : topScoredArea?.riskPercent >= 75
      ? '#f43f5e'
      : topScoredArea?.riskPercent >= 25
        ? '#f59e0b'
        : '#22d3ee';

  return (
    <motion.aside
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full sm:w-[340px] select-none z-20 text-slate-100 flex flex-col gap-2.5 font-sans"
      aria-label="Area Risk Rankings Intelligence Panel"
    >
      {/* ===================================================================
          MASTER CONTAINER: GlassAura™ Translucent Liquid Glass Console
          =================================================================== */}
      <div className="glass-panel-translucent rounded-3xl p-4 border border-white/12 shadow-[0_24px_64px_rgba(0,0,0,0.55)] flex flex-col gap-3 relative overflow-hidden max-h-[calc(100dvh-11.5rem)] md:max-h-[calc(100dvh-9.5rem)]">
        
        {/* Subtle Ambient Radial Glow */}
        <div
          className="absolute -top-16 -left-16 w-44 h-44 rounded-full pointer-events-none opacity-20 blur-3xl transition-colors duration-500"
          style={{ backgroundColor: glowColor }}
        />

        {/* -----------------------------------------------------------------
            1. HEADER: Area Risk Rankings Identity & Ensemble Context
            ----------------------------------------------------------------- */}
        <div className="flex flex-col gap-2 pb-2.5 border-b border-white/10 relative z-10 shrink-0">
          <div className="flex items-center justify-between gap-1.5">
            {/* Header Identity Badge */}
            <div className="flex items-center gap-1.5 apple-liquid-glass-cyan px-2.5 py-1 rounded-full border border-cyan-400/40 text-cyan-200 min-w-0">
              <ArrowDownWideNarrow className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase whitespace-nowrap truncate">
                Area Risk Rankings
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border whitespace-nowrap ${
                  isMlOnline
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                    : 'bg-rose-500/15 text-rose-300 border-rose-400/35'
                }`}
              >
                {isMlOnline ? 'ML Live' : 'ML Offline'}
              </span>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  title="Close Rankings Panel"
                  className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-all cursor-pointer border border-white/10 active:scale-95"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Ensemble Context & Evaluation Count */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate">
                  {isMlOnline ? 'Real-Time ML Dual-Ensemble' : 'Prediction Engine Offline'}
                </span>
                <span className="text-[10px] text-slate-400 truncate">
                  {isMlOnline
                    ? 'Illustrative model · not an official forecast'
                    : 'Model offline, cannot calculate risk percentage'}
                </span>
              </div>
            </div>

            <span className="font-mono text-[10px] text-cyan-300/90 bg-cyan-950/50 px-2 py-0.5 rounded-full border border-cyan-800/40 shrink-0 font-medium">
              {scoredCount}/{stations.length} ML
            </span>
          </div>
        </div>

        {/* -----------------------------------------------------------------
            2. TOP HOTSPOT CALLOUT / OFFLINE BANNER
            ----------------------------------------------------------------- */}
        {!isMlOnline ? (
          <div className="apple-liquid-glass-crimson rounded-2xl p-3 border border-rose-500/40 text-rose-200 shrink-0 relative z-10">
            <div className="flex items-center gap-2 font-bold text-xs text-rose-300">
              <ServerOff className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Model is offline, cannot calculate risk percentage</span>
            </div>
            <p className="text-[10.5px] text-slate-300 mt-1 leading-snug">
              The ML prediction service is currently unreachable. No synthetic or fake percentages are shown.
            </p>
          </div>
        ) : topScoredArea && (
          <div
            onClick={() => onSelectStation && onSelectStation(topScoredArea)}
            className={`apple-liquid-glass-well rounded-2xl p-3 border border-white/10 ${topRiskTier.hoverBorder} transition-all cursor-pointer shrink-0 group relative z-10`}
            title={`Click to inspect highest risk area: ${topScoredArea.name}`}
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className={`flex items-center gap-1.5 font-bold ${topRiskTier.titleText} uppercase tracking-wider text-[10px] font-mono`}>
                <Flame className={`w-3.5 h-3.5 ${topRiskTier.iconText}`} />
                Highest Evaluated Risk
              </span>
              <span className={`font-mono font-black text-[11px] px-2 py-0.5 rounded-full border ${topRiskTier.pill}`}>
                {topScoredArea.riskPercent}% ML
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className={`text-xs font-bold text-white truncate ${topRiskTier.nameHover} transition-colors`}>
                  {topScoredArea.name}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {topScoredArea.state || topScoredArea.region} • Elev: {topScoredArea.elevation}m
                </div>
              </div>
              <span className="text-[10px] font-mono font-semibold text-cyan-300 group-hover:text-cyan-200 flex items-center gap-0.5 shrink-0">
                Fly &rarr;
              </span>
            </div>
          </div>
        )}

        {/* -----------------------------------------------------------------
            3. SEARCH & FILTER CONTROLS
            ----------------------------------------------------------------- */}
        <div className="flex flex-col gap-2 shrink-0 relative z-10">
          {/* Search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search areas, states, or valleys..."
              className="w-full pl-9 pr-8 py-1.5 glass-search-pill text-xs text-white placeholder-slate-400 focus:outline-none font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>

          {/* Filter Pills (only relevant when ML is online) */}
          {isMlOnline && (
            <div className="flex items-center justify-between gap-1 overflow-x-auto scrollbar-none">
              {[
                { id: 'all', label: `All (${rankedStations.length})` },
                { id: 'high', label: 'High ≥45%' },
                { id: 'watch', label: 'Watch 20-44%' },
                { id: 'low', label: 'Low <20%' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id)}
                  className={`px-2 py-1 rounded-full font-mono text-[9.5px] font-semibold transition-all cursor-pointer whitespace-nowrap border ${
                    filterMode === tab.id
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/45 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* -----------------------------------------------------------------
            4. RANKED SECTORS LIST
            ----------------------------------------------------------------- */}
        <div className="flex flex-col gap-1.5 min-h-0 flex-1 relative z-10">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 px-0.5 font-semibold shrink-0">
            <span>Ranked Sectors</span>
            <span className="text-cyan-400">{filteredStations.length} Areas</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
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
                        ? 'apple-liquid-glass-cyan border-cyan-400/60'
                        : 'apple-liquid-glass-well border-white/10'
                    }`}
                  >
                <div className="flex items-center justify-between gap-2">
                  {/* Rank badge + Area name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-[11px] shrink-0 ${
                      risk != null && index === 0
                        ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/40 font-black'
                        : risk != null && index === 1
                          ? 'bg-slate-300 text-slate-950 font-bold'
                          : risk != null && index === 2
                            ? 'bg-amber-700/80 text-amber-100 font-bold'
                            : 'bg-white/10 text-slate-300'
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
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
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          SCORING...
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white/10 text-cyan-300 border border-white/10 group-hover:border-cyan-400/40">
                          RUN ML &rarr;
                        </span>
                      )
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-950/60 text-rose-300 border border-rose-500/40">
                        OFFLINE
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300 transition-transform group-hover:translate-x-0.5 shrink-0" />
                  </div>
                </div>

                {/* Subtext and progress bar */}
                {risk != null ? (
                  <div className="w-full bg-slate-950/80 border border-white/10 rounded-full h-1.5 overflow-hidden">
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
        </div>

        {/* -----------------------------------------------------------------
            5. FOOTER STATUS BAR
            ----------------------------------------------------------------- */}
        <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-400 pt-1.5 border-t border-white/10 px-0.5 shrink-0 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isMlOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="text-slate-300">Click any area to inspect</span>
          </div>
          <span className="text-cyan-400 font-semibold">
            {isMlOnline
              ? `${scoredCount}/${stations.length} Scored by ML`
              : 'ML Model Offline'}
          </span>
        </div>

      </div>
    </motion.aside>
  );
}
