import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MapPin, 
  Loader2, 
  X, 
  LocateFixed 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FpsCounter from './FpsCounter';

export default function CloudburstHeader({
  searchQuery,
  setSearchQuery,
  onSelectStation,
  stations = [],
  is3D = false,
  onToggle3D,
  mapView = 'default',
  onToggleMapView,
  userLocation,
  onGoToMyLocation,
  isLocatingUser = false,
  isLiveMode = true,
  onToggleLiveMode,
  isMeteoLoading = false,
  onReplayIntro,
  cloudburstEvent = null,
  isCloudburstCardOpen = true,
  onToggleCloudburstAlert = null
}) {
  const [internalQuery, setInternalQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [onlineResults, setOnlineResults] = useState([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const searchContainerRef = useRef(null);

  const currentQuery = searchQuery !== undefined ? searchQuery : internalQuery;

  const handleQueryChange = (val) => {
    if (typeof setSearchQuery === 'function') {
      setSearchQuery(val);
    }
    setInternalQuery(val);
    setShowSearchDropdown(true);
  };

  const handleClearQuery = () => {
    if (typeof setSearchQuery === 'function') {
      setSearchQuery('');
    }
    setInternalQuery('');
  };

  const handleSelectStation = (station) => {
    if (onSelectStation) {
      onSelectStation(station);
    }
    setShowSearchDropdown(false);
    handleClearQuery();
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live Pan-India and Global Geocoding via OpenStreetMap Nominatim
  useEffect(() => {
    const queryTerm = currentQuery ? currentQuery.trim() : '';
    if (!queryTerm || queryTerm.length < 3) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearchingOnline(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(queryTerm)}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          const parsed = data.map(item => {
            const cityName = item.address?.city || item.address?.town || item.address?.village || item.address?.state_district || item.display_name.split(',')[0];
            const countryCode = item.address?.country_code?.toLowerCase();
            const countryName = item.address?.country || "Global";
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            const isIndia = countryCode === 'in' || (lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98);
            const stateName = item.address?.state || item.display_name.split(',').slice(-3, -2)[0]?.trim() || (isIndia ? "India" : countryName);
            const regionName = isIndia ? stateName : `${stateName ? stateName + ', ' : ''}${countryName}`;

            return {
              id: `geo-${item.place_id}`,
              name: cityName,
              region: regionName,
              state: stateName,
              country: countryName,
              isIndia,
              lat,
              lon,
              elevation: isIndia && lat > 28 ? 1800 : 350,
              status: isIndia ? "moderate" : "global-normal",
              riskScore: isIndia ? 72 : 35,
              rainfallRate: isIndia ? 40.0 : 15.0,
              humidity: 78,
              pressureDrop: isIndia ? 20 : 10,
              temp: 22.0,
              windSpeed: 24,
              isOnlineGeocoded: true
            };
          });
          setOnlineResults(parsed);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Geocoding search error:', err);
        }
      } finally {
        setIsSearchingOnline(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [currentQuery]);

  // Local matching across stations network
  const queryTerm = (currentQuery || '').trim().toLowerCase();
  const localMatches = queryTerm ? stations.filter(stn => 
    stn.name.toLowerCase().includes(queryTerm) ||
    stn.region.toLowerCase().includes(queryTerm) ||
    (stn.state && stn.state.toLowerCase().includes(queryTerm)) ||
    (stn.id && stn.id.toLowerCase().includes(queryTerm))
  ) : [];

  const popularSuggestions = stations.filter(s => s.status === 'critical' || s.riskScore >= 80).slice(0, 6);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (localMatches.length > 0) {
        handleSelectStation(localMatches[0]);
      } else if (onlineResults.length > 0) {
        handleSelectStation(onlineResults[0]);
      } else if (popularSuggestions.length > 0 && !queryTerm) {
        handleSelectStation(popularSuggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setShowSearchDropdown(false);
    }
  };

  const isSatellite = mapView === 'satellite';

  return (
    <header className="absolute top-3 left-4 right-4 z-40 flex items-center gap-3 pointer-events-none select-none">
      {/* 1. Left: Combined BurstWatch Brand + Search Box Pill */}
      <div ref={searchContainerRef} className="relative pointer-events-auto flex items-center gap-0">
        <div className="apple-liquid-glass-pill flex items-center gap-2 px-3.5 py-2 h-10 rounded-full focus-within:border-cyan-400/80 focus-within:ring-2 focus-within:ring-cyan-500/25 transition-all w-auto min-w-0">
          {/* Brand Logo & Name (Clickable to Replay Cinematic Intro) */}
          <button
            type="button"
            onClick={onReplayIntro}
            title="Click to Replay Cinematic Launch Animation"
            className="flex items-center gap-2 cursor-pointer hover:opacity-90 active:scale-95 transition-all shrink-0"
          >
            <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-tr from-[#f05542] to-[#ff6b57] text-white shadow-md shadow-[#f05542]/30 border border-white/20 shrink-0">
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
                <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
                <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
              </svg>
            </div>

            <span className="burstwatch-logo-orbitron text-[13px] uppercase tracking-[0.14em] text-white select-none shrink-0 pr-2 border-r border-white/15 mr-1 inline-flex items-center font-black">
              Burst<span className="text-cyan-400">Watch</span>
            </span>
          </button>

          {/* Search icon */}
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input 
            type="text"
            placeholder="Search city or station..."
            value={currentQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setShowSearchDropdown(true)}
            onKeyDown={handleKeyDown}
            className="w-40 sm:w-52 md:w-60 bg-transparent border-none outline-none text-xs text-white placeholder:text-slate-400 font-normal"
          />
          {isSearchingOnline && (
            <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
          )}
          {currentQuery && !isSearchingOnline && (
            <button 
              type="button"
              onClick={handleClearQuery}
              className="text-slate-400 hover:text-white cursor-pointer p-0.5 shrink-0"
              title="Clear Search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* In-Pill "My Location" GPS button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onGoToMyLocation) onGoToMyLocation();
            }}
            title={userLocation ? `Live Location Active (${userLocation.lat.toFixed(2)}°, ${userLocation.lng.toFixed(2)}°) - Click to Center` : "Go to My Location"}
            className={`p-1 rounded-full transition-all cursor-pointer shrink-0 ${
              userLocation 
                ? 'text-cyan-400 bg-cyan-500/20 hover:bg-cyan-500/30' 
                : 'text-slate-400 hover:text-cyan-300 hover:bg-white/10'
            }`}
          >
            {isLocatingUser ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Search Results Dropdown */}
        <AnimatePresence>
          {showSearchDropdown && (
            <motion.div 
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-12 w-80 sm:w-96 md:w-[400px] apple-liquid-glass rounded-3xl shadow-2xl overflow-hidden py-1.5 z-[100] divide-y divide-white/5 max-h-[440px] overflow-y-auto no-scrollbar"
            >
              {/* Option 1: Go to My Location */}
              <div className="p-2 bg-gradient-to-r from-cyan-950/45 via-[#101c30] to-cyan-950/25">
                <button
                  type="button"
                  onClick={() => {
                    if (onGoToMyLocation) onGoToMyLocation();
                    setShowSearchDropdown(false);
                    handleClearQuery();
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-400/60 transition-all flex items-center justify-between group cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                      userLocation 
                        ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/40' 
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                    }`}>
                      {isLocatingUser ? (
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                      ) : (
                        <LocateFixed className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-cyan-200 flex items-center gap-1.5">
                        <span>Go to My Location</span>
                        {userLocation ? (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Active GPS
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Live Device
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-300">
                        {isLocatingUser 
                          ? "Detecting live device coordinates..." 
                          : userLocation 
                            ? `Lat: ${userLocation.lat.toFixed(3)}°, Lon: ${userLocation.lng.toFixed(3)}°` 
                            : "Center map on current location & auto-sync weather"}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-cyan-400 group-hover:translate-x-0.5 transition-transform">
                    &rarr;
                  </span>
                </button>
              </div>

              {/* Local Station Matches */}
              {localMatches.length > 0 && (
                <div className="p-1">
                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Network Stations ({localMatches.length})
                  </div>
                  {localMatches.map(station => (
                    <button
                      key={station.id}
                      type="button"
                      onClick={() => handleSelectStation(station)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <div>
                          <div className="text-xs font-semibold text-white group-hover:text-cyan-200">
                            {station.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {station.region} • Elev: {station.elevation}m
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          station.status === 'critical' 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                            : station.status === 'high' 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {station.riskScore}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Online Global Geocoding Results */}
              {onlineResults.length > 0 && (
                <div className="p-1">
                  <div className="px-3 py-1 text-[10px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Global Search ({onlineResults.length})</span>
                  </div>
                  {onlineResults.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectStation(item)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-cyan-500/10 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <div>
                          <div className="text-xs font-semibold text-white group-hover:text-cyan-200 flex items-center gap-1.5">
                            <span>{item.name}</span>
                            {item.isIndia ? (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                                🇮🇳 India
                              </span>
                            ) : (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                🌐 Global
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {item.region} • Lat: {item.lat.toFixed(2)}°, Lon: {item.lon.toFixed(2)}°
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-400 group-hover:underline flex items-center gap-1">
                        Fly &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Popular Stations when search bar is focused without input */}
              {!queryTerm && popularSuggestions.length > 0 && (
                <div className="p-1">
                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    High-Risk Stations
                  </div>
                  {popularSuggestions.map(station => (
                    <button
                      key={station.id}
                      type="button"
                      onClick={() => handleSelectStation(station)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-white group-hover:text-rose-200">
                            {station.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {station.region}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-rose-400">
                        {station.riskScore}%
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {queryTerm && localMatches.length === 0 && onlineResults.length === 0 && !isSearchingOnline && (
                <div className="px-3.5 py-4 text-xs text-slate-400 text-center flex flex-col items-center gap-1">
                  <span>No matching location found.</span>
                  <span className="text-[10px] text-slate-500">Try searching any global city or station (e.g. London, Tokyo, Mumbai, Kedarnath)</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Right: Real-time FPS Monitor, Cloudburst Alert Button & LIVE Status Button */}
      <div className="pointer-events-auto hidden sm:flex items-center gap-2.5 ml-auto">
        {/* Real-time Fluidity FPS Monitor */}
        <FpsCounter />

        {/* Cloudburst Emergency Warning Button */}
        {cloudburstEvent && (
          <button
            type="button"
            onClick={onToggleCloudburstAlert}
            title={`${cloudburstEvent.title}: ${cloudburstEvent.metrics?.predictedRainRateMmh} mm/h — Click to toggle HUD Card`}
            className={`relative h-10 flex items-center justify-center gap-2 px-3.5 rounded-full transition-all cursor-pointer select-none box-border border ${
              isCloudburstCardOpen
                ? 'bg-gradient-to-r from-red-600/90 to-rose-600/90 border-red-400/80 shadow-[0_0_18px_rgba(239,68,68,0.45)] text-white'
                : 'apple-liquid-glass-pill text-red-300 border-red-500/40 hover:bg-red-500/20'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-90" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_8px_#ef4444]" />
            </span>
            <div className="flex items-center gap-1.5 font-bold text-xs tracking-tight">
              <span>⚡ Cloudburst Alert</span>
              <span className="font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-amber-300 border border-white/10">
                {cloudburstEvent.metrics?.predictedRainRateMmh} mm/h
              </span>
            </div>
          </button>
        )}

        {/* LIVE Status Button */}
        <button
          type="button"
          onClick={() => onToggleLiveMode && onToggleLiveMode(!isLiveMode)}
          title={isLiveMode ? "Data is streaming live in real-time — Click to pause" : "Live data sync is paused — Click to resume live feed"}
          className={`relative h-10 flex items-center justify-center gap-2 px-4 rounded-full transition-all cursor-pointer select-none box-border ${
            isLiveMode
              ? 'apple-liquid-glass-crimson border-red-500/50 shadow-red-500/20'
              : 'apple-liquid-glass-pill text-slate-400'
          }`}
        >
          {isLiveMode ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-80" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_10px_#ef4444]" />
            </span>
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="inline-flex rounded-full h-2 w-2 bg-slate-500" />
            </span>
          )}

          <span className={`text-xs font-extrabold tracking-wider ${isLiveMode ? 'text-white' : 'text-slate-400'}`}>
            {isLiveMode ? 'LIVE' : 'PAUSED'}
          </span>

          {isLiveMode && isMeteoLoading && (
            <Loader2 className="w-3 h-3 animate-spin text-red-400 shrink-0" />
          )}
        </button>
      </div>
    </header>
  );
}
