import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import CloudburstHeader from './components/CloudburstHeader';
import NavRail from './components/NavRail';
import CloudburstMap from './components/CloudburstMap';

import ThreatAnalyticsPanel from './components/ThreatAnalyticsPanel';
import IncidentModal from './components/IncidentModal';
import PermissionPrompt from './components/PermissionPrompt';
import SubscribeAlertPopup from './components/SubscribeAlertPopup';
import LiveMeteoPanel from './components/LiveMeteoPanel';
import AreaRiskRankingsPanel from './components/AreaRiskRankingsPanel';
import RainingCitiesPanel from './components/RainingCitiesPanel';
import CinematicIntroSplash from './components/CinematicIntroSplash';
import EmailAlertModal from './components/EmailAlertModal';
import AlertsPanel from './components/AlertsPanel';
import { getLocalSubscription, checkSubscriberStatus } from './services/subscriberService';
import { getCloudburstEventData } from './services/cloudburstEventModel';

import { fetchWeatherApiLiveData } from './services/weatherApiService';
import { sendBrowserNotification } from './utils/notifications';
import {
  STATIONS_NETWORK,
  calculateCloudburstThreat,
  getHighestRiskStation,
  MODEL_METADATA
} from './data/cloudburstData';
import { preloadTemperatureEngine } from './utils/temperatureUtils';
import { MapPin, Loader2, CheckCircle2 } from 'lucide-react';

export default function App() {
  // Simulator Parameters using exact model features (ambient normal baseline)
  const [humidity, setHumidity] = useState(55);      // relative_humidity_2m_max
  const [pressureDrop, setPressureDrop] = useState(6);  // surface_pressure_min drop
  const [temperature, setTemperature] = useState(20);    // temperature_2m_max
  const [windSpeed, setWindSpeed] = useState(16);        // wind_gusts_10m_max
  const [tcwv, setTcwv] = useState(28);                  // total_column_integrated_water_vapour_max

  // Map & View Projection Options: 2D Flat Map with World Wrap by default
  const [is3D, setIs3D] = useState(false);
  const [mapView, setMapView] = useState('positron'); // 'liberty' | 'positron' | 'bright' | 'satellite'
  const [activeLayer, setActiveLayer] = useState('convective'); // Default to Convective Cloudburst Heatmap
  const [showParticles, setShowParticles] = useState(true);
  const [windParticleMode, setWindParticleMode] = useState(() => {
    try {
      const saved = localStorage.getItem('cloudburst_wind_particle_style');
      if (saved) {
        if (['silk', 'thermal', 'grand', 'off'].includes(saved)) {
          return saved;
        }
        if (['starry', 'aurora'].includes(saved)) return 'grand';
        if (['hokusai', 'normal', 'soft'].includes(saved)) return 'silk';
      }
      return 'silk';
    } catch (e) {
      return 'silk';
    }
  });

  const [windUnit, setWindUnit] = useState('km/h');

  useEffect(() => {
    try {
      if (windParticleMode && windParticleMode !== 'off') {
        localStorage.setItem('cloudburst_wind_particle_style', windParticleMode);
      }
    } catch (e) { }
  }, [windParticleMode]);
  const [showIsobars, setShowIsobars] = useState(false);
  const [showTemperatureLayer, setShowTemperatureLayer] = useState(true);
  const [tempUnit, setTempUnit] = useState('C'); // 'C' | 'F'
  const [hoveredMapTemp, setHoveredMapTemp] = useState(null);
  const [showIntro, setShowIntro] = useState(false); // Clean initial load without blocking splash

  const handleToggleTempUnit = useCallback(() => {
    setTempUnit((prev) => (prev === 'C' ? 'F' : 'C'));
  }, []);

  // Pre-warm Open-Meteo WebAssembly engine & S3 metadata on idle (0ms cold start)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const triggerWarmup = () => preloadTemperatureEngine();
    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(triggerWarmup, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const timer = setTimeout(triggerWarmup, 1200);
    return () => clearTimeout(timer);
  }, []);

  // UI Drawer & Modal States - Default Closed for Clean Map Visibility
  const [isRankingsOpen, setIsRankingsOpen] = useState(false);
  const [isMeteoPanelOpen, setIsMeteoPanelOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isAlertsPanelOpen, setIsAlertsPanelOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(() => getLocalSubscription());
  const [isEmailSubscribed, setIsEmailSubscribed] = useState(() => getLocalSubscription().isVerified);
  const [isMuted, setIsMuted] = useState(false);

  // Silent session validation and synchronization on mount
  useEffect(() => {
    let mounted = true;
    const sub = getLocalSubscription();
    if (sub.token || sub.email) {
      checkSubscriberStatus(sub.email).then(() => {
        if (mounted) {
          const fresh = getLocalSubscription();
          setUserProfile(fresh);
          setIsEmailSubscribed(fresh.isVerified);
        }
      });
    }
    return () => { mounted = false; };
  }, []);

  // Live Dual-Engine Cloudburst ML Prediction State (Zero Hardcoded Presets)
  const [cloudburstEvent, setCloudburstEvent] = useState(null);
  const [isMlRetrying, setIsMlRetrying] = useState(false);

  // User Live Geolocation State
  const [userLocation, setUserLocation] = useState(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locationToast, setLocationToast] = useState(null);

  // Active Selected Station (defaults to primary monitoring station across the network)
  const [selectedStation, setSelectedStation] = useState(() => getHighestRiskStation(STATIONS_NETWORK));
  const [searchQuery, setSearchQuery] = useState('');

  // Live weather integration state
  const [liveMeteoData, setLiveMeteoData] = useState(null);
  const [isMeteoLoading, setIsMeteoLoading] = useState(false);

  // Active navigation tab
  const [activeNav, setActiveNav] = useState('dashboard');

  // Sync current weather data for the selected station (with intelligent caching)
  const loadLiveMeteo = useCallback(async (lat, lon, stationName, forceRefresh = false) => {
    if (lat == null || lon == null) return;
    setIsMeteoLoading(true);
    try {
      const data = await fetchWeatherApiLiveData(lat, lon, stationName, forceRefresh);
      setLiveMeteoData(data);
      if (data.humidity !== undefined) setHumidity(data.humidity);
      if (data.temperature !== undefined) setTemperature(data.temperature);
      if (data.pressure !== undefined) {
        const elev = selectedStation?.elevation || data.elevation || 0;
        const standardP = 1013.25 * Math.pow(1 - (0.0065 * elev) / 288.15, 5.255);
        const rawDrop = Math.max(0, standardP - data.pressure);
        const drop = Math.max(2, Math.min(45, Math.round(rawDrop)));
        setPressureDrop(drop);
      }
      if (data.windGusts !== undefined) {
        setWindSpeed(data.windGusts);
      } else if (data.windSpeed !== undefined) {
        setWindSpeed(Math.round(data.windSpeed * 1.3));
      }
      const vapor = Math.round(Math.max(15, Math.min(65, ((data.humidity ?? 65) * 0.45) + ((data.temperature ?? 20) * 0.6))));
      setTcwv(vapor);
    } catch (e) {
      console.warn("Weather data sync error:", e);
    } finally {
      setIsMeteoLoading(false);
    }
  }, [selectedStation?.elevation]);

  // Refresh weather data when the selected station changes
  useEffect(() => {
    if (selectedStation) {
      loadLiveMeteo(selectedStation.lat, selectedStation.lon, selectedStation.name || selectedStation.stationName, false);
    }
  }, [selectedStation, loadLiveMeteo]);

  // Compute dynamic convective cloudburst threat metrics in real-time
  const threatData = useMemo(() => {
    return calculateCloudburstThreat({
      humidity,
      pressureDrop,
      temp: temperature,
      windSpeed,
      tcwv
    });
  }, [humidity, pressureDrop, temperature, windSpeed, tcwv]);

  // Strictly use real ML model prediction; NEVER calculate fake numbers when ML is offline
  const currentRiskPercent = useMemo(() => {
    if (cloudburstEvent?.isLive && cloudburstEvent?.metrics?.riskPercent != null) {
      return cloudburstEvent.metrics.riskPercent;
    }
    return null;
  }, [cloudburstEvent]);

  const isHighRiskDetected = useMemo(() => {
    return currentRiskPercent != null && currentRiskPercent >= 25;
  }, [currentRiskPercent]);

  // Fetch live ML cloudburst prediction directly from backend service (with intelligent caching)
  const fetchLivePrediction = useCallback(async (stn = null, forceRefresh = false) => {
    setIsMlRetrying(true);
    try {
      const data = await getCloudburstEventData(stn || selectedStation, forceRefresh);
      setCloudburstEvent(data);
    } catch (err) {
      setCloudburstEvent({
        isLive: false,
        status: 'OFFLINE',
        error: err.message || 'Cannot reach prediction engine at http://localhost:8001',
        title: 'Cloudburst Prediction Engine Offline',
        locationName: stn?.name || selectedStation?.name || 'Kedarnath Temple Valley',
        coordinates: stn ? [stn.lon, stn.lat] : (selectedStation ? [selectedStation.lon, selectedStation.lat] : [79.0669, 30.7346]),
        elevationMeters: stn?.elevation || selectedStation?.elevation || 600,
        detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        metrics: {
          riskPercent: null,
          predictedRainRateMmh: null
        },
        advisory: 'ML Prediction System is offline. Real-time physical sensor telemetry remains active.'
      });
    } finally {
      setIsMlRetrying(false);
    }
  }, [selectedStation]);

  useEffect(() => {
    fetchLivePrediction(selectedStation, false);
  }, [selectedStation?.id, selectedStation?.lat, selectedStation?.lon]);

  // 15–30 Minute Adaptive Reassessment Scheduler (Pauses when tab is hidden to save resources)
  useEffect(() => {
    const REASSESS_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

    const triggerReassessment = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return; // Skip background cycles when tab is minimized
      }
      if (selectedStation?.lat && selectedStation?.lon) {
        loadLiveMeteo(selectedStation.lat, selectedStation.lon, selectedStation.name || selectedStation.stationName, false);
        fetchLivePrediction(selectedStation, false);
      }
    };

    const timerId = window.setInterval(triggerReassessment, REASSESS_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerReassessment();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(timerId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [selectedStation, loadLiveMeteo, fetchLivePrediction]);

  // Manual Force-Refresh Handler
  const handleManualTelemetryRefresh = useCallback(() => {
    if (selectedStation) {
      loadLiveMeteo(selectedStation.lat, selectedStation.lon, selectedStation.name || selectedStation.stationName, true);
      fetchLivePrediction(selectedStation, true);
    }
  }, [selectedStation, loadLiveMeteo, fetchLivePrediction]);

  const activeCloudburstEvent = useMemo(() => {
    return cloudburstEvent;
  }, [cloudburstEvent]);

  const handleFocusCloudburstEpicenter = useCallback((eventToFocus = null) => {
    const ev = eventToFocus || activeCloudburstEvent;
    if (!ev?.coordinates) return;
    setActiveLayer('convective');
    if (window.map) {
      window.map.flyTo({
        center: ev.coordinates,
        zoom: 10.5,
        pitch: 0,
        bearing: 0,
        speed: 1.2
      });
    }
  }, [activeCloudburstEvent]);

  const handleSelectStation = useCallback((stn) => {
    if (!stn) return;
    setSelectedStation(stn);
    loadLiveMeteo(stn.lat, stn.lon, stn.name || stn.stationName);
    fetchLivePrediction(stn);
    setIsMeteoPanelOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsRankingsOpen(false);
      setIsAnalyticsOpen(false);
    }

    if (window.map) {
      window.map.flyTo({
        center: [stn.lon ?? stn.lng, stn.lat],
        zoom: (stn.elevation || 0) > 1500 ? 9.5 : 8.2,
        pitch: is3D ? 58 : 0,
        bearing: 0,
        speed: 1.2
      });
    }
  }, [loadLiveMeteo, fetchLivePrediction, is3D]);

  // Fallback to high-accuracy IP location if browser GPS fails, times out, or is blocked
  const fetchIpFallbackLocation = useCallback(async (reason) => {
    try {
      const res = await fetch('https://ipwho.is/');
      const data = await res.json();
      if (data && data.success !== false && data.latitude && data.longitude) {
        const cityName = data.city || "Local Sector";
        const regionName = data.region || "India";
        const loc = {
          lat: data.latitude,
          lng: data.longitude,
          name: `${cityName}, ${regionName}`,
          isNetwork: true,
          timestamp: Date.now()
        };
        setUserLocation(loc);
        setIsLocatingUser(false);

        const userStation = {
          id: 'user-live-gps',
          name: `${cityName}`,
          region: `${regionName} (Live Sector)`,
          state: regionName,
          lat: data.latitude,
          lon: data.longitude,
          elevation: 450,
          status: threatData.riskPercent > 80 ? 'critical' : threatData.riskPercent > 50 ? 'high' : 'moderate',
          riskScore: threatData.riskPercent,
          rainfallRate: liveMeteoData?.rainRate ?? 0.0,
          humidity,
          pressureDrop,
          temp: temperature,
          windSpeed
        };
        setSelectedStation(userStation);

        setLocationToast({
          type: 'fallback',
          title: `Located Sector: ${cityName}, ${regionName}`,
          message: reason === 'denied'
            ? 'Browser GPS was blocked by site settings. Centered via network location. (Allow location in browser for exact GPS).'
            : `Radar centered on ${cityName}, ${regionName}.`
        });

        setTimeout(() => setLocationToast(null), 5000);
        return;
      }
    } catch (e) {
      console.warn("Fallback location error:", e);
    }

    setIsLocatingUser(false);
    setLocationToast({
      type: 'error',
      title: 'Location Unavailable',
      message: 'Please allow browser location permissions to fly to your sector.'
    });
    setTimeout(() => setLocationToast(null), 4000);
  }, [threatData.riskPercent, humidity, pressureDrop, temperature, windSpeed]);

  // Handler to locate user via browser GPS and center radar map
  const handleGoToMyLocation = useCallback(() => {
    setIsLocatingUser(true);
    setLocationToast({
      type: 'requesting',
      title: 'Requesting Location Permission',
      message: 'Please click "Allow" on the browser prompt to fly to your exact position...'
    });

    if (!('geolocation' in navigator)) {
      fetchIpFallbackLocation('unsupported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };

        // Try reverse-geocoding city name for clean badge
        let cityName = "Your Location";
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=12`);
          if (res.ok) {
            const data = await res.json();
            cityName = data.address?.city || data.address?.town || data.address?.state_district || data.address?.suburb || "Your Sector";
          }
        } catch { }

        const loc = {
          ...coords,
          name: cityName,
          isGPS: true,
          timestamp: Date.now()
        };

        setUserLocation(loc);
        setIsLocatingUser(false);

        const userStation = {
          id: 'user-live-gps',
          name: cityName,
          region: 'Live GPS Sector',
          state: 'India',
          lat: coords.lat,
          lon: coords.lng,
          elevation: 450,
          status: threatData.riskPercent > 80 ? 'critical' : threatData.riskPercent > 50 ? 'high' : 'moderate',
          riskScore: threatData.riskPercent,
          rainfallRate: liveMeteoData?.rainRate ?? 0.0,
          humidity,
          pressureDrop,
          temp: temperature,
          windSpeed
        };
        setSelectedStation(userStation);

        setLocationToast({
          type: 'success',
          title: 'Centered on Your Location',
          message: `Live GPS acquired: ${cityName} (${coords.lat.toFixed(3)}°, ${coords.lng.toFixed(3)}°)`
        });
        setTimeout(() => setLocationToast(null), 4000);

        sendBrowserNotification("Centered on Your Location", {
          body: `GPS coordinates acquired: ${cityName} (Lat ${coords.lat.toFixed(3)}°, Lon ${coords.lng.toFixed(3)}°). Radar focused.`,
          tag: "user-relocated"
        });
      },
      (err) => {
        console.warn('Geolocation error / denied:', err);
        fetchIpFallbackLocation(err.code === 1 ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, [fetchIpFallbackLocation, threatData.riskPercent, humidity, pressureDrop, temperature, windSpeed]);

  // Synthesize gentle radar/alert audio tone via Web Audio API
  const playAlertSiren = useCallback(() => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // AudioContext policy fallback
    }
  }, [isMuted]);

  // NavRail click handler
  const handleSelectNav = (navId) => {
    setActiveNav(navId);
    const isNarrow = typeof window !== 'undefined' && window.innerWidth < 1024;
    if (navId === 'home') {
      setIsMeteoPanelOpen(false);
      setIsAnalyticsOpen(false);
      setIsRankingsOpen(false); // Collapsed on home tab as requested (pill view)
    } else if (navId === 'dashboard') {
      setIsRankingsOpen(false);
      if (isNarrow) setIsMeteoPanelOpen(false);
      setIsAnalyticsOpen(true);
      setActiveLayer('convective');
      handleFocusCloudburstEpicenter(activeCloudburstEvent);
    } else if (navId === 'rankings') {
      setIsRankingsOpen((prev) => {
        const next = !prev;
        if (next && window.innerWidth < 1280) {
          setIsAnalyticsOpen(false);
        }
        if (next && isNarrow) {
          setIsMeteoPanelOpen(false);
        }
        return next;
      });
    } else if (navId === 'meteo') {
      setIsMeteoPanelOpen((prev) => {
        const next = !prev;
        if (next && isNarrow) {
          setIsAnalyticsOpen(false);
          setIsRankingsOpen(false);
        }
        return next;
      });
      if (selectedStation) {
        loadLiveMeteo(selectedStation.lat, selectedStation.lon, selectedStation.name || selectedStation.stationName);
      }
    } else if (navId === 'radar') {
      setActiveLayer('precip');
      if (window.innerWidth < 1536) {
        setIsMeteoPanelOpen(false);
      }
      if (isNarrow) {
        setIsAnalyticsOpen(false);
        setIsRankingsOpen(false);
      }
    } else if (navId === 'analytics') {
      setIsAnalyticsOpen((prev) => {
        const next = !prev;
        if (next && window.innerWidth < 1280) {
          setIsRankingsOpen(false);
        }
        if (next && isNarrow) {
          setIsMeteoPanelOpen(false);
        }
        return next;
      });
    }
  };

  // Resilient 2D vs 3D switcher with zero-latency projection synchronization
  const handleToggle3D = useCallback((val) => {
    setIs3D((prev) => {
      const nextVal = typeof val === 'boolean' ? val : !prev;
      window.__burstwatch_apply3D?.(nextVal);
      return nextVal;
    });
  }, []);

  const isHomeView = activeNav === 'home';

  return (
    <div className="relative w-dvw h-dvh bg-[#070e1b] overflow-hidden select-none font-sans text-slate-100">
      {/* 1. Main Dashboard Container: Edge-to-Edge Map + Floating Glass Overlays */}
      <div className="relative w-full h-full overflow-hidden">
        {/* Base Interactive 2D/3D & Satellite Map (Spans Full Screen) */}
        <CloudburstMap
          stations={STATIONS_NETWORK}
          selectedStation={selectedStation}
          onSelectStation={handleSelectStation}
          threatData={threatData}
          humidity={humidity}
          pressureDrop={pressureDrop}
          temperature={temperature}
          windSpeed={windSpeed}
          tcwv={tcwv}
          riskPercent={currentRiskPercent}
          currentTimeStr={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          userLocation={userLocation}
          activeLayer={activeLayer}
          onChangeActiveLayer={setActiveLayer}
          is3D={is3D}
          onToggle3D={handleToggle3D}
          mapView={mapView}
          isHomeView={isHomeView}
          isAnalyticsOpen={isAnalyticsOpen}
          isRankingsOpen={isRankingsOpen}
          isMeteoPanelOpen={isMeteoPanelOpen}
          showParticles={!showIntro && showParticles && windParticleMode !== 'off'}
          onToggleParticles={(val) => {
            setShowParticles(val);
            if (!val) {
              setWindParticleMode('off');
            } else if (windParticleMode === 'off') {
              const rawSaved = localStorage.getItem('cloudburst_wind_particle_style');
              const saved = ['silk', 'thermal', 'grand'].includes(rawSaved) ? rawSaved : 'silk';
              setWindParticleMode(saved);
            }
          }}
          windParticleMode={windParticleMode}
          onWindParticleModeChange={(mode) => {
            setWindParticleMode(mode);
            if (mode === 'off') {
              setShowParticles(false);
            } else {
              setShowParticles(true);
            }
          }}
          liveMeteoData={liveMeteoData}
          showTemperature={!showIntro && activeLayer !== 'none'}
          tempUnit={tempUnit}
          onToggleTempUnit={handleToggleTempUnit}
          windUnit={windUnit}
          onWindUnitChange={setWindUnit}
          cloudburstEvent={activeCloudburstEvent}
          isMlRetrying={isMlRetrying}
          onRefreshMlStatus={() => fetchLivePrediction(selectedStation)}
          onFocusEpicenter={handleFocusCloudburstEpicenter}
          onHoverTemp={setHoveredMapTemp}
        />

        {/* Floating Transparent BurstWatch Top Header Bar */}
        <CloudburstHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSelectStation={handleSelectStation}
          stations={STATIONS_NETWORK}
          userLocation={userLocation}
          onGoToMyLocation={handleGoToMyLocation}
          isLocatingUser={isLocatingUser}
          isMeteoLoading={isMeteoLoading}
          onReplayIntro={() => setShowIntro(true)}
          windParticleMode={windParticleMode}
          onWindParticleModeChange={(newMode) => {
            setWindParticleMode(newMode);
            if (newMode === 'off') {
              setShowParticles(false);
            } else {
              setShowParticles(true);
            }
          }}
        />

        {/* Location Feedback Toast Notification */}
        {locationToast && (
          <div className={`fixed bottom-[calc(6.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-20px)] flex items-center gap-3 px-4 py-2 rounded-full shadow-2xl text-xs font-semibold select-none transition-all ${locationToast.type === 'requesting'
            ? 'apple-liquid-glass-cyan text-cyan-200'
            : locationToast.type === 'success'
              ? 'apple-liquid-glass-emerald text-emerald-200'
              : 'apple-liquid-glass-amber text-amber-200'
            }`}>
            {locationToast.type === 'requesting' ? (
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
            ) : locationToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="font-bold text-white text-[12px]">{locationToast.title}</span>
              <span className="text-[11px] opacity-90">{locationToast.message}</span>
            </div>
            <button
              onClick={() => setLocationToast(null)}
              className="ml-2 text-slate-300 hover:text-white text-base leading-none cursor-pointer p-0.5"
              title="Dismiss"
            >
              &times;
            </button>
          </div>
        )}

        {/* Floating Left Vertical Navigation Capsule Dock */}
        <div className="absolute top-[calc(3.75rem+env(safe-area-inset-top,0px))] left-2.5 sm:left-4 z-30 pointer-events-auto">
          <NavRail
            activeNav={activeNav}
            onSelectNav={handleSelectNav}
            activeLayer={activeLayer}
            onChangeActiveLayer={(layer) => {
              setActiveLayer(layer);
              if (layer === 'precip' && window.innerWidth < 1536) {
                setIsMeteoPanelOpen(false);
              }
              if (layer === 'precip' && window.innerWidth < 1024) {
                setIsAnalyticsOpen(false);
                setIsRankingsOpen(false);
              }
              if (layer === 'wind') {
                setShowParticles(true);
                if (windParticleMode === 'off') {
                  setWindParticleMode('silk');
                }
              }
            }}
            isSatellite={mapView === 'satellite'}
            onToggleSatellite={() => setMapView((prev) => (prev === 'satellite' ? 'default' : 'satellite'))}
            onOpenEmailModal={() => setIsAlertsPanelOpen(true)}
            isEmailSubscribed={isEmailSubscribed}
            userProfile={userProfile}
            isMlLive={activeCloudburstEvent?.isLive === true}
            isMlRetrying={isMlRetrying}
            onRefreshMlStatus={() => fetchLivePrediction(selectedStation)}
            mlError={activeCloudburstEvent?.error}
          />
        </div>

        {/* Floating Right Panel: Area Risk Rankings (Highest to Lowest Risk %) - Controlled Authoritatively from NavRail */}
        {isRankingsOpen && (
          <div
            id="area-risk-rankings-container"
            className={`absolute top-[calc(3.75rem+env(safe-area-inset-top,0px))] left-[62px] right-2.5 sm:left-auto z-20 pointer-events-auto transition-all flex justify-end ${!isHomeView && isAnalyticsOpen ? 'sm:right-4 xl:right-[372px]' : 'sm:right-4'
              }`}
          >
            <AreaRiskRankingsPanel
              stations={STATIONS_NETWORK}
              selectedStation={selectedStation}
              onSelectStation={handleSelectStation}
              cloudburstEvent={activeCloudburstEvent}
              threatData={threatData}
              onClose={() => setIsRankingsOpen(false)}
            />
          </div>
        )}

        {/* Floating Left Panel: Current Weather Data */}
        {!isHomeView && isMeteoPanelOpen && (
          <div id="live-meteo-panel-container" className="absolute top-[calc(3.75rem+env(safe-area-inset-top,0px))] left-[62px] right-2.5 sm:right-auto sm:left-20 z-25 pointer-events-auto transition-all">
            <LiveMeteoPanel
              liveData={liveMeteoData}
              station={selectedStation}
              isLoading={isMeteoLoading}
              onRefresh={() => {
                if (selectedStation) {
                  loadLiveMeteo(selectedStation.lat, selectedStation.lon, selectedStation.name || selectedStation.stationName);
                }
              }}
              onClose={() => setIsMeteoPanelOpen(false)}
              tempUnit={tempUnit}
            />
          </div>
        )}

        {/* Floating Real-Time Raining Cities Ranked Panel (Rain Radar Layer) */}
        {!isHomeView && (
          <div className={`absolute top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-20 transition-all duration-300 max-w-[calc(100vw-72px)] ${activeLayer === 'precip'
            ? (isMeteoPanelOpen ? 'opacity-100 visible pointer-events-auto hidden 2xl:block 2xl:left-[432px]' : 'opacity-100 visible pointer-events-auto left-[62px] right-2.5 sm:right-auto sm:left-20')
            : 'opacity-0 invisible pointer-events-none left-[62px] right-2.5 sm:right-auto sm:left-20'
            }`}>
            <RainingCitiesPanel
              isActive={activeLayer === 'precip'}
              onSelectCity={(city) => {
                handleSelectStation({
                  id: city.id,
                  name: city.name,
                  stationName: city.name,
                  state: city.state,
                  lat: city.lat,
                  lon: city.lon
                });
              }}
              cloudburstEvent={cloudburstEvent}
            />
          </div>
        )}

        {/* Floating Right Column: Convective Grid Panel */}
        {!isHomeView && isAnalyticsOpen && (
          <div id="threat-analytics-panel-container" className="absolute top-[calc(3.75rem+env(safe-area-inset-top,0px))] left-[62px] right-2.5 sm:left-auto sm:right-4 z-20 pointer-events-auto flex justify-end max-h-[calc(100dvh-11.5rem)] md:max-h-[calc(100dvh-9.5rem)] overflow-y-auto scrollbar-none pr-0.5">
            <ThreatAnalyticsPanel
              riskPercent={currentRiskPercent}
              severity={currentRiskPercent != null ? (currentRiskPercent >= 75 ? "SEVERE THREAT" : currentRiskPercent >= 25 ? "ELEVATED RISK" : "NORMAL") : "OFFLINE"}
              station={selectedStation}
              liveData={liveMeteoData}
              onRefresh={handleManualTelemetryRefresh}
              isRefreshing={isMeteoLoading || isMlRetrying}
              onSelectIndiaHotspot={() => {
                const hotspot = getHighestRiskStation(STATIONS_NETWORK);
                if (hotspot) {
                  setSelectedStation(hotspot);
                  loadLiveMeteo(hotspot.lat, hotspot.lon, hotspot.name, false);
                  fetchLivePrediction(hotspot, false);
                }
              }}
              onOpenIncidentModal={() => setIsIncidentModalOpen(true)}
              onClose={() => setIsAnalyticsOpen(false)}
            />
          </div>
        )}


      </div>

      {/* 3. Emergency Incident Management Modal */}
      <IncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        riskPercent={threatData.riskPercent}
        severity={threatData.severity}
        onPlaySiren={playAlertSiren}
      />

      {/* 4. Native Browser Location & Notification Permission Prompt */}
      <PermissionPrompt onLocationAcquired={(coords) => setUserLocation(coords)} />

      {/* 4b. Notification Service Subscription Popup */}
      <SubscribeAlertPopup
        isSubscribed={isEmailSubscribed}
        isModalOpen={isAlertsPanelOpen || isEmailModalOpen || showIntro}
        hasLeftDrawerOpen={!isHomeView && (isMeteoPanelOpen || activeLayer === 'precip')}
        onSubscribeClick={() => setIsAlertsPanelOpen(true)}
      />

      {/* 5. 120 FPS Cinematic Launch Intro Splash Animation */}
      {showIntro && (
        <CinematicIntroSplash onComplete={() => setShowIntro(false)} />
      )}

      {/* 6. Convective Weather Alerts Control Panel */}
      <AlertsPanel
        isOpen={isAlertsPanelOpen}
        onClose={() => setIsAlertsPanelOpen(false)}
        onOpenModal={() => setIsEmailModalOpen(true)}
        onSubscribedChange={(status) => {
          setIsEmailSubscribed(status);
          setUserProfile(getLocalSubscription());
        }}
      />

      {/* 7. Convective Weather Email Alerts Subscription Modal */}
      <EmailAlertModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSubscribedChange={(status) => {
          setIsEmailSubscribed(status);
          setUserProfile(getLocalSubscription());
        }}
      />

    </div>
  );
}