import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CloudRain, 
  RotateCw, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight, 
  ChevronLeft,
  X, 
  Search, 
  Droplets,
  Zap,
  Gauge
} from 'lucide-react';
import { MONITORED_RAIN_CITIES } from '../data/monitoredCities';
import { getLocalRadarDbz, estimateLocalRainRate } from '../utils/radarEchoesData';
import { getActiveCyclones } from '../services/cycloneService';

// Module-level persistent cache across component mount/unmount and layer toggles
let globalCityDataCache = {};
let globalHasCompletedInitialScan = false;
let globalScannedCount = 0;

const REGION_CATEGORIES = [
  { id: 'all', label: 'All India' },
  { id: 'raining', label: 'Raining Now', isSpecial: true },
  { id: 'himalayan', label: 'Himalayan' },
  { id: 'ghats', label: 'Western Ghats' },
  { id: 'northeast', label: 'Northeast' },
  { id: 'coastal', label: 'Coastal' },
  { id: 'central', label: 'Central Basins' },
  { id: 'plains', label: 'Plains & Metros' }
];

/**
 * Resolves WMO Weather interpretation code to human-readable meteorological text
 */
function getWeatherDescription(code) {
  if (code >= 95) return 'Thunderstorm';
  if (code >= 80) return 'Rain Showers';
  if (code >= 65) return 'Heavy Torrent';
  if (code >= 63) return 'Moderate Rain';
  if (code >= 61) return 'Light Rain';
  if (code >= 51) return 'Drizzle';
  if (code >= 45) return 'Mist / Fog';
  if (code >= 1 && code <= 3) return 'Cloudy';
  return 'Clear Sky';
}

/**
 * Resolves precipitation rate to visual badge styles
 */
function getRainIntensityBadge(rateMmPerHour) {
  if (rateMmPerHour >= 35.0) {
    return {
      label: 'Severe Torrent',
      textClass: 'text-rose-400',
      bgClass: 'bg-rose-500/20 border-rose-500/40',
      badgeColor: '#f43f5e'
    };
  }
  if (rateMmPerHour >= 10.0) {
    return {
      label: 'Heavy Rain',
      textClass: 'text-amber-300',
      bgClass: 'bg-amber-500/20 border-amber-500/40',
      badgeColor: '#f59e0b'
    };
  }
  if (rateMmPerHour >= 2.5) {
    return {
      label: 'Moderate',
      textClass: 'text-emerald-300',
      bgClass: 'bg-emerald-500/20 border-emerald-500/40',
      badgeColor: '#34d399'
    };
  }
  if (rateMmPerHour > 0.0) {
    return {
      label: 'Light Rain',
      textClass: 'text-cyan-300',
      bgClass: 'bg-cyan-500/20 border-cyan-500/40',
      badgeColor: '#38bdf8'
    };
  }
  return {
    label: 'No Rain',
    textClass: 'text-slate-400',
    bgClass: 'bg-slate-500/10 border-slate-500/20',
    badgeColor: '#94a3b8'
  };
}

export default function RainingCitiesPanel({
  onSelectCity,
  cloudburstEvent = null,
  isActive = true,
  className = ''
}) {
  const [cityDataMap, setCityDataMap] = useState(() => ({ ...globalCityDataCache }));
  const [currentScanningCity, setCurrentScanningCity] = useState(null);
  const [scannedCount, setScannedCount] = useState(() => globalScannedCount);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filterMode, setFilterMode] = useState('raining'); // 'raining' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [scanPass, setScanPass] = useState(0);
  const [hasStartedScan, setHasStartedScan] = useState(() => globalHasCompletedInitialScan);

  const abortControllerRef = useRef(null);
  const tabsRef = useRef(null);
  const cloudburstEventRef = useRef(cloudburstEvent);
  cloudburstEventRef.current = cloudburstEvent;

  const totalCitiesCount = MONITORED_RAIN_CITIES.length;

  // Activate initial scan on first open of the layer
  useEffect(() => {
    if (isActive && !hasStartedScan) {
      setHasStartedScan(true);
    }
  }, [isActive, hasStartedScan]);

  // Progressive micro-batch scanning engine - runs strictly ONCE unless manually re-triggered
  useEffect(() => {
    // If not activated yet, do not scan
    if (!hasStartedScan) return;

    // If initial scan was already completed and user didn't request a manual rescan (scanPass === 0), do not scan again!
    if (globalHasCompletedInitialScan && Object.keys(globalCityDataCache).length > 0 && scanPass === 0) {
      return;
    }

    let isCancelled = false;
    abortControllerRef.current = new AbortController();

    async function runProgressiveBatchScan() {
      // If manual rescan, reset count
      if (scanPass > 0) {
        setScannedCount(0);
        globalScannedCount = 0;
      }

      const BATCH_SIZE = 25;
      const batches = [];
      for (let i = 0; i < MONITORED_RAIN_CITIES.length; i += BATCH_SIZE) {
        batches.push(MONITORED_RAIN_CITIES.slice(i, i + BATCH_SIZE));
      }

      let currentScanned = scanPass > 0 ? 0 : globalScannedCount;

      for (let bIndex = 0; bIndex < batches.length; bIndex++) {
        if (isCancelled) break;

        const currentBatch = batches[bIndex];
        const lats = currentBatch.map((c) => c.lat).join(',');
        const lons = currentBatch.map((c) => c.lon).join(',');
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=precipitation,rain,showers,weather_code,relative_humidity_2m`;

        let batchResults = [];
        try {
          const res = await fetch(url, { signal: abortControllerRef.current?.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          batchResults = Array.isArray(data) ? data : [data];
        } catch (fetchErr) {
          batchResults = [];
        }

        const batchUpdates = {};
        const cyclonesList = getActiveCyclones();

        for (let j = 0; j < currentBatch.length; j++) {
          const city = currentBatch[j];
          const resultObj = batchResults[j];
          const curr = resultObj?.current || {};
          const openMeteoRain = Number(curr.precipitation || curr.rain || curr.showers || 0);

          const localConvectiveRain = estimateLocalRainRate(city.lon, city.lat, {
            cyclones: cyclonesList,
            cloudburstEvent: cloudburstEventRef.current
          });

          const finalRain = Math.max(openMeteoRain, localConvectiveRain);
          const dbz = getLocalRadarDbz(city.lon, city.lat, finalRain);

          const cityRecord = {
            ...city,
            rainMmPerHour: finalRain,
            humidity: curr.relative_humidity_2m ?? null,
            weatherCode: curr.weather_code ?? (finalRain > 0 ? 61 : 0),
            dbz,
            fetchedAt: Date.now()
          };

          globalCityDataCache[city.id] = cityRecord;
          batchUpdates[city.id] = cityRecord;
        }

        currentScanned += currentBatch.length;
        globalScannedCount = currentScanned;

        if (!isCancelled) {
          setCurrentScanningCity(currentBatch[currentBatch.length - 1]?.name || null);
          setCityDataMap((prev) => ({
            ...prev,
            ...batchUpdates
          }));
          setScannedCount(currentScanned);
        }

        // 18ms gentle pacing between batches for fluid 60 FPS UI responsiveness
        await new Promise((resolve) => setTimeout(resolve, 18));
      }

      if (!isCancelled) {
        globalHasCompletedInitialScan = true;
        setCurrentScanningCity(null);
      }
    }

    runProgressiveBatchScan();

    return () => {
      isCancelled = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [hasStartedScan, scanPass]);

  // Ranked cities sorted descending by rainfall rate (heaviest on top)
  const rankedCities = useMemo(() => {
    let list = MONITORED_RAIN_CITIES.map((c) => {
      const data = cityDataMap[c.id];
      return {
        ...c,
        rainMmPerHour: data?.rainMmPerHour ?? 0,
        humidity: data?.humidity ?? null,
        weatherCode: data?.weatherCode ?? 0,
        dbz: data?.dbz ?? 0,
        isEvaluated: !!data
      };
    });

    // Always sort descending by rainfall rate (heaviest on top)
    list.sort((a, b) => b.rainMmPerHour - a.rainMmPerHour);

    if (filterMode === 'raining') {
      list = list.filter((c) => c.rainMmPerHour > 0);
    } else if (filterMode !== 'all') {
      list = list.filter((c) => c.region === filterMode);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => 
        c.name.toLowerCase().includes(q) || 
        c.state.toLowerCase().includes(q) ||
        (c.region && c.region.toLowerCase().includes(q))
      );
    }

    return list;
  }, [cityDataMap, filterMode, searchQuery]);

  const rainingCount = useMemo(() => {
    return Object.values(cityDataMap).filter((c) => (c.rainMmPerHour || 0) > 0).length;
  }, [cityDataMap]);

  const topRainingCity = useMemo(() => {
    const raining = Object.values(cityDataMap).filter((c) => (c.rainMmPerHour || 0) > 0);
    if (raining.length === 0) return null;
    raining.sort((a, b) => b.rainMmPerHour - a.rainMmPerHour);
    return raining[0];
  }, [cityDataMap]);

  // Handle manual rescan trigger
  const handleTriggerRescan = () => {
    globalHasCompletedInitialScan = false;
    setScanPass((p) => p + 1);
  };

  // Minimized floating glass pill
  if (isCollapsed) {
    return (
      <div className={`select-none pointer-events-auto apple-liquid-glass-pill px-4 py-2 rounded-full shadow-2xl border border-cyan-400/30 text-white flex items-center gap-3 cursor-pointer hover:bg-white/15 transition-all ${className}`}>
        <div 
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 text-xs font-sans"
        >
          <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
            <CloudRain className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-100 flex items-center gap-1.5">
              <span>Rain Watch:</span>
              <span className="text-cyan-400 font-mono">{rainingCount} Raining</span>
            </div>
            {topRainingCity && (
              <div className="text-[10px] text-slate-300 font-mono">
                Top: {topRainingCity.name} ({topRainingCity.rainMmPerHour.toFixed(1)} mm/h)
              </div>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
        </div>
      </div>
    );
  }

  return (
    <div className={`select-none pointer-events-auto glass-panel-translucent rounded-3xl shadow-2xl border border-cyan-400/30 text-white flex flex-col w-[350px] sm:w-[390px] max-w-[calc(100vw-32px)] max-h-[440px] overflow-hidden animate-in fade-in duration-200 ${className}`}>
      {/* Header: Title, Real-Time Radar Scanner Pulse & Controls */}
      <div className="p-3 pb-2 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
            <CloudRain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Live Rain Tracker</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            </h3>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              {currentScanningCity ? (
                <span className="text-cyan-300 animate-pulse">
                  Probing: {currentScanningCity} ({scannedCount}/{totalCitiesCount})
                </span>
              ) : (
                <span className="text-slate-300">
                  Scan cycle complete · {rainingCount} active
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleTriggerRescan}
            title="Rescan all cities"
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${currentScanningCity ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            title="Minimize"
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter Tabs: Regional Corridors & Raining Only with Scroll Arrows & Wheel Scroll */}
      <div className="relative flex items-center bg-white/[0.03] border-b border-white/5 select-none px-1.5 py-1">
        <button
          type="button"
          onClick={() => {
            if (tabsRef.current) tabsRef.current.scrollBy({ left: -140, behavior: 'smooth' });
          }}
          title="Scroll categories left"
          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0 cursor-pointer z-10"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div
          ref={tabsRef}
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className="flex items-center gap-1 py-1 px-1 text-[10px] font-mono overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 hover:scrollbar-thumb-cyan-400/50 scrollbar-track-transparent scroll-smooth flex-1"
        >
          {REGION_CATEGORIES.map((cat) => {
            const isActive = filterMode === cat.id;
            const count = cat.id === 'raining'
              ? rainingCount
              : cat.id === 'all'
              ? totalCitiesCount
              : MONITORED_RAIN_CITIES.filter((c) => c.region === cat.id).length;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={(e) => {
                  setFilterMode(cat.id);
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
                className={`px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? cat.isSpecial
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50 shadow-[0_0_10px_rgba(251,191,36,0.25)]'
                      : 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            if (tabsRef.current) tabsRef.current.scrollBy({ left: 140, behavior: 'smooth' });
          }}
          title="Scroll categories right (Western Ghats, Northeast, Coastal, Central, Plains)"
          className="w-6 h-6 flex items-center justify-center text-cyan-300 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0 cursor-pointer z-10"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Input for Quick City Discovery */}
      <div className="relative px-3 py-2 border-b border-white/10 bg-white/[0.02] flex items-center">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${totalCitiesCount} Indian cities...`}
          className="w-full bg-slate-950/40 border border-white/12 rounded-full pl-8 pr-8 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/60 transition-colors font-sans"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Progress Bar for Progressive Scan */}
      <div className="w-full bg-slate-800/40 h-0.5 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-300"
          style={{ width: `${(scannedCount / totalCitiesCount) * 100}%` }}
        />
      </div>

      {/* Scrollable Ranked Cities List */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-[260px] scrollbar-thin scrollbar-thumb-white/15">
        {rankedCities.length === 0 ? (
          <div className="p-6 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-500">
              <Droplets className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold text-slate-300">
              {searchQuery
                ? `No matching cities found for "${searchQuery}"`
                : scannedCount < totalCitiesCount
                ? `Scanning in progress (${scannedCount}/${totalCitiesCount})...`
                : 'No active rainfall currently detected'}
            </div>
            <p className="text-[10px] text-slate-500 max-w-[220px]">
              {searchQuery
                ? 'Try searching by another city or state name.'
                : scannedCount < totalCitiesCount
                ? `Probing ${currentScanningCity || 'stations'} for precipitation echoes...`
                : 'All monitored Indian stations currently reporting clear conditions.'}
            </p>
          </div>
        ) : (
          rankedCities.map((city, idx) => {
            const badge = getRainIntensityBadge(city.rainMmPerHour);
            const condition = getWeatherDescription(city.weatherCode);
            const isTop = idx === 0 && city.rainMmPerHour > 0;

            return (
              <div
                key={city.id}
                onClick={() => onSelectCity?.({ 
                  id: city.id,
                  name: city.name, 
                  state: city.state,
                  lat: city.lat, 
                  lon: city.lon 
                })}
                className={`px-3 py-2 flex items-center justify-between gap-2.5 hover:bg-white/10 transition-colors cursor-pointer group ${
                  isTop ? 'bg-cyan-950/30' : ''
                }`}
                title={`Click to center map on ${city.name}`}
              >
                {/* Left: Rank & City Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                      idx === 0 && city.rainMmPerHour > 0
                        ? 'bg-amber-400/25 text-amber-300 border border-amber-400/50 shadow-sm shadow-amber-500/20'
                        : idx === 1 && city.rainMmPerHour > 0
                        ? 'bg-cyan-400/25 text-cyan-300 border border-cyan-400/50 shadow-sm shadow-cyan-500/20'
                        : idx === 2 && city.rainMmPerHour > 0
                        ? 'bg-emerald-400/25 text-emerald-300 border border-emerald-400/50'
                        : 'bg-white/5 text-slate-400 border border-white/10'
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                      <span>{city.name}</span>
                      {city.isCloudburstProne && (
                        <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                          PRONE
                        </span>
                      )}
                      {city.humidity != null && (
                        <span className="text-[9px] font-mono font-normal text-slate-400">
                          {city.humidity}% RH
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                      <span>{city.state}</span>
                      {city.region && (
                        <span className="text-[8px] uppercase font-mono px-1.5 py-0.2 rounded-full bg-white/5 text-slate-300 border border-white/5">
                          {city.region}
                        </span>
                      )}
                      <span>·</span>
                      <span className="text-slate-300">{condition}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Rain Rate & Badge */}
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <div className="text-xs font-mono font-bold text-white tracking-tight">
                      {city.rainMmPerHour.toFixed(1)}{' '}
                      <span className="text-[9px] font-normal text-slate-400">mm/h</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold border ${badge.bgClass} ${badge.textClass}`}>
                        {badge.label}
                      </span>
                      {city.dbz > 0 && (
                        <span className="text-[9px] font-mono text-slate-400">
                          {city.dbz} dBZ
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="px-3.5 py-1.5 bg-black/25 border-t border-white/10 flex items-center justify-between text-[9px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>Pan-India Doppler & Sensor Array ({totalCitiesCount})</span>
        </div>
        <span>Click city to center</span>
      </div>
    </div>
  );
}
