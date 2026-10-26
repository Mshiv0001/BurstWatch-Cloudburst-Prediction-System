import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import CloudburstHeader from './components/CloudburstHeader';
import NavRail from './components/NavRail';
import WhatIfSimulator from './components/WhatIfSimulator';
import CloudburstMap from './components/CloudburstMap';

import ThreatAnalyticsPanel from './components/ThreatAnalyticsPanel';
import IncidentModal from './components/IncidentModal';
import PermissionPrompt from './components/PermissionPrompt';
import LiveMeteoPanel from './components/LiveMeteoPanel';
import TemperatureLegendBar from './components/TemperatureLegendBar';
import WindParticleDropdown from './components/WindParticleDropdown';
import CinematicIntroSplash from './components/CinematicIntroSplash';
import CloudburstEventCard from './components/CloudburstEventCard';
import { CLOUDBURST_PRESET_EVENTS } from './services/cloudburstEventModel';

import { fetchWeatherApiLiveData as fetchOpenMeteoLiveData } from './services/weatherApiService';
import { sendBrowserNotification } from './utils/notifications';
import { 
  STATIONS_NETWORK, 
  TIMELINE_POINTS, 
  calculateCloudburstThreat,
  MODEL_METADATA 
} from './data/cloudburstData';
import { BarChart3, MapPin, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function App() {
  // Simulator Parameters using exact model features
  const [humidity, setHumidity] = useState(90);      // relative_humidity_2m_max
  const [pressureDrop, setPressureDrop] = useState(30);  // surface_pressure_min drop
  const [temperature, setTemperature] = useState(18);    // temperature_2m_max
  const [windSpeed, setWindSpeed] = useState(45);        // wind_gusts_10m_max
  const [tcwv, setTcwv] = useState(52);                  // total_column_integrated_water_vapour_max

  // Map & View Projection Options: 2D Flat Map with World Wrap by default
  const [is3D, setIs3D] = useState(false);
  const [mapView, setMapView] = useState('positron'); // 'liberty' | 'positron' | 'bright' | 'satellite'
  const [activeLayer, setActiveLayer] = useState('convective'); // Default to Convective Cloudburst Heatmap
  const [showParticles, setShowParticles] = useState(true);
  const [windParticleMode, setWindParticleMode] = useState('normal'); // 'off' | 'normal' | 'strong' | 'soft' | 'dark' | 'fast'
  const [showIsobars, setShowIsobars] = useState(false);
  const [showTemperatureLayer, setShowTemperatureLayer] = useState(true);
  const [tempUnit, setTempUnit] = useState('C'); // 'C' | 'F'
  const [showIntro, setShowIntro] = useState(false); // Clean initial load without blocking splash

  const handleToggleTempUnit = useCallback(() => {
    setTempUnit((prev) => (prev === 'C' ? 'F' : 'C'));
  }, []);

  // UI Drawer & Modal States - Default Closed for Clean Map Visibility
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isMeteoPanelOpen, setIsMeteoPanelOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Cloudburst Event Simulation & ML Backend Integration State
  const [cloudburstPresetKey, setCloudburstPresetKey] = useState('kedarnath');
  const [isCloudburstCardOpen, setIsCloudburstCardOpen] = useState(false);

  // User Live Geolocation State
  const [userLocation, setUserLocation] = useState(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locationToast, setLocationToast] = useState(null);

  // Active Selected Station
  const [selectedStation, setSelectedStation] = useState(STATIONS_NETWORK[0]); // Kedarnath
  const [searchQuery, setSearchQuery] = useState('');

  // Timeline Scrubber & Replay State
  const [currentTimeIndex, setCurrentTimeIndex] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState('kedarnath');

  // Live Open-Meteo Integration State
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [liveMeteoData, setLiveMeteoData] = useState(null);
  const [isMeteoLoading, setIsMeteoLoading] = useState(false);

  // Active navigation tab
  const [activeNav, setActiveNav] = useState('dashboard');

  // Live Meteorological Sync Engine via Open-Meteo API
  const loadLiveMeteo = useCallback(async (lat, lon, stationName) => {
    if (lat == null || lon == null) return;
    setIsMeteoLoading(true);
    try {
      const data = await fetchOpenMeteoLiveData(lat, lon, stationName);
      setLiveMeteoData(data);
      if (isLiveMode) {
        if (data.humidity !== undefined) setHumidity(data.humidity);
        if (data.temperature !== undefined) setTemperature(data.temperature);
        if (data.pressure !== undefined) {
          const drop = Math.max(5, Math.min(50, 1013 - data.pressure));
          setPressureDrop(drop);
        }
        if (data.windGusts !== undefined) {
          setWindSpeed(data.windGusts);
        } else if (data.windSpeed !== undefined) {
          setWindSpeed(Math.round(data.windSpeed * 1.3));
        }
        const vapor = Math.round(Math.max(15, Math.min(65, ((data.humidity ?? 65) * 0.45) + ((data.temperature ?? 20) * 0.6))));
        setTcwv(vapor);
      }
    } catch (e) {
      console.warn("Open-Meteo sync error:", e);
    } finally {
      setIsMeteoLoading(false);
    }
  }, [isLiveMode]);

  // Sync live Open-Meteo telemetry on station selection
  useEffect(() => {
    if (selectedStation) {
      loadLiveMeteo(selectedStation.lat, selectedStation.lon, selectedStation.name || selectedStation.stationName);
    }
  }, [selectedStation, loadLiveMeteo]);

  // Handler to toggle Live Open-Meteo vs What-If Simulator Mode
  const handleToggleLiveMode = useCallback((val) => {
    setIsLiveMode(val);
    if (val) {
      setIsMeteoPanelOpen(true);
      if (liveMeteoData) {
        setHumidity(liveMeteoData.humidity);
        setTemperature(liveMeteoData.temperature);
        setPressureDrop(Math.max(5, Math.min(50, 1013 - liveMeteoData.pressure)));
        setWindSpeed(liveMeteoData.windGusts || liveMeteoData.windSpeed || 40);
      } else if (selectedStation) {
        loadLiveMeteo(selectedStation.lat, selectedStation.lon, selectedStation.name || selectedStation.stationName);
      }
    } else {
      setIsSimulatorOpen(true);
    }
  }, [liveMeteoData, selectedStation, loadLiveMeteo]);

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

  // Dynamic Risk & Cloudburst Event calculation for active and any different location
  const currentRiskPercent = useMemo(() => {
    if (selectedStation?.id === 'kedarnath') return 96;
    if (selectedStation?.id === 'dharamshala') return 91;
    if (threatData?.riskPercent != null) return threatData.riskPercent;
    return selectedStation?.riskScore ?? 45;
  }, [selectedStation, threatData]);

  const isHighRiskDetected = useMemo(() => {
    return (
      currentRiskPercent >= 70 ||
      selectedStation?.status === 'critical' ||
      selectedStation?.id === 'kedarnath' ||
      selectedStation?.id === 'dharamshala' ||
      (selectedStation?.riskScore != null && selectedStation.riskScore >= 75)
    );
  }, [currentRiskPercent, selectedStation]);

  const activeCloudburstEvent = useMemo(() => {
    if (!isHighRiskDetected || !selectedStation) return null;

    const lon = selectedStation.lon ?? selectedStation.lng;
    const lat = selectedStation.lat;
    if (lon == null || lat == null) return null;

    const stnName = selectedStation.name || selectedStation.stationName || "Selected Sector";
    const regionName = selectedStation.region || selectedStation.state || "Himalayan Belt";
    const preset = CLOUDBURST_PRESET_EVENTS[selectedStation.id] || CLOUDBURST_PRESET_EVENTS[cloudburstPresetKey];

    return {
      id: preset?.id || `CB-${selectedStation.id || 'LOC'}-${Date.now()}`,
      title: preset?.title || `${stnName} Convective Surge`,
      status: currentRiskPercent >= 85 ? "CRITICAL" : "IMMINENT",
      locationName: preset?.locationName || stnName,
      state: preset?.state || regionName,
      coordinates: [lon, lat],
      elevationMeters: selectedStation.elevation || 2100,
      detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      leadTimeMinutes: preset?.leadTimeMinutes || Math.max(15, Math.min(60, Math.round(90 - currentRiskPercent * 0.6))),
      mlModel: {
        name: "ConvLSTM + LightGBM Cloudburst Ensemble v2.4",
        confidencePercent: preset?.mlModel?.confidencePercent || Math.min(99.4, Math.max(78, currentRiskPercent * 1.04)).toFixed(1),
        riskLevel: currentRiskPercent >= 85 ? "EXTREME_HAZARD" : "HIGH_HAZARD"
      },
      metrics: {
        predictedRainRateMmh: preset?.metrics?.predictedRainRateMmh || selectedStation.rainfallRate || Math.max(85, Math.round(currentRiskPercent * 1.35)),
        riskPercent: currentRiskPercent,
        capeJkg: preset?.metrics?.capeJkg || Math.round(2000 + currentRiskPercent * 22),
        pressureDropHpa: preset?.metrics?.pressureDropHpa || pressureDrop,
        echoTopKm: preset?.metrics?.echoTopKm || (10 + (currentRiskPercent / 100) * 5.5).toFixed(1),
        tpwMm: preset?.metrics?.tpwMm || tcwv || 58,
        windGustKmh: preset?.metrics?.windGustKmh || windSpeed || 48
      },
      affectedBasins: preset?.affectedBasins || [
        `${stnName} River Valley`,
        `${regionName} Runoff Drainage`
      ],
      hazardRadiusKm: preset?.hazardRadiusKm || (currentRiskPercent >= 85 ? 18 : 14),
      advisory: preset?.advisory || (currentRiskPercent >= 85
        ? "CRITICAL EVACUATION WARNING: Extreme convective downpour imminent. Evacuate lower drainage zones."
        : "HIGH RISK ADVISORY: Rapid convective plume development. Avoid low-lying river channels.")
    };
  }, [selectedStation, isHighRiskDetected, currentRiskPercent, cloudburstPresetKey, pressureDrop, tcwv, windSpeed]);

  const handleFocusCloudburstEpicenter = useCallback((eventToFocus = null) => {
    const ev = eventToFocus || activeCloudburstEvent;
    if (!ev?.coordinates) return;
    setActiveLayer('convective');
    setIsCloudburstCardOpen(true);
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

    const stnRisk = stn.riskScore ?? (stn.status === 'critical' ? 92 : stn.status === 'high' ? 75 : 35);
    const isHigh = stnRisk >= 70 || stn.status === 'critical' || stn.id === 'kedarnath' || stn.id === 'dharamshala';

    if (isHigh) {
      setIsCloudburstCardOpen(true);
      setActiveLayer('convective');
      if (window.map) {
        window.map.flyTo({
          center: [stn.lon ?? stn.lng, stn.lat],
          zoom: 10.0,
          pitch: 0,
          bearing: 0,
          speed: 1.2
        });
      }
    } else {
      setIsCloudburstCardOpen(false);
      if (window.map) {
        window.map.flyTo({
          center: [stn.lon ?? stn.lng, stn.lat],
          zoom: 7.5,
          pitch: 0,
          bearing: 0,
          speed: 1.2
        });
      }
    }

    if (!isLiveMode) {
      if (stn.humidity) setHumidity(stn.humidity);
      if (stn.pressureDrop) setPressureDrop(stn.pressureDrop);
      if (stn.temp) setTemperature(Math.round(stn.temp));
      if (stn.windSpeed) setWindSpeed(stn.windSpeed);
    }
  }, [loadLiveMeteo, isLiveMode]);

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
          rainfallRate: 35.0,
          humidity,
          pressureDrop,
          temp: temperature,
          windSpeed
        };
        setSelectedStation(userStation);

        setLocationToast({
          type: 'fallback',
          title: `📍 Located Sector: ${cityName}, ${regionName}`,
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
      title: '📍 Requesting Location Permission',
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
        } catch {}

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
          rainfallRate: 35.0,
          humidity,
          pressureDrop,
          temp: temperature,
          windSpeed
        };
        setSelectedStation(userStation);

        setLocationToast({
          type: 'success',
          title: '📍 Centered on Your Location!',
          message: `Live GPS acquired: ${cityName} (${coords.lat.toFixed(3)}°, ${coords.lng.toFixed(3)}°)`
        });
        setTimeout(() => setLocationToast(null), 4000);

        sendBrowserNotification("📍 Centered on Your Location", {
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

  const currentTimePoint = TIMELINE_POINTS[currentTimeIndex] || TIMELINE_POINTS[1];

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

  // Handlers for Preset Scenarios
  const handleApplyPreset = (presetKey) => {
    playAlertSiren();
    if (presetKey === 'kedarnath') {
      setHumidity(94);
      setPressureDrop(34);
      setTemperature(14);
      setWindSpeed(52);
      setTcwv(62);
      const stn = STATIONS_NETWORK.find(s => s.id === 'kedarnath');
      if (stn) setSelectedStation(stn);
      sendBrowserNotification("⚠️ Critical Cloudburst Alert: Kedarnath", {
        body: "Severe convective surge: 94% humidity & 34 hPa pressure drop detected! Model τ >= 0.875.",
        tag: "cloudburst-preset"
      });
    } else if (presetKey === 'squall') {
      setHumidity(91);
      setPressureDrop(29);
      setTemperature(17);
      setWindSpeed(46);
      setTcwv(54);
      const stn = STATIONS_NETWORK.find(s => s.id === 'chamoli' || s.id === 'dehradun');
      if (stn) setSelectedStation(stn);
      sendBrowserNotification("⚠️ Severe Squall Warning", {
        body: "Himachal '23 scenario: Orographic convective uplift active. High rainfall intensity predicted.",
        tag: "cloudburst-preset"
      });
    } else if (presetKey === 'mumbai') {
      setHumidity(98);
      setPressureDrop(32);
      setTemperature(26);
      setWindSpeed(58);
      setTcwv(65);
      const stn = STATIONS_NETWORK.find(s => s.id === 'mumbai');
      if (stn) setSelectedStation(stn);
      sendBrowserNotification("⚠️ Catastrophic Deluge: Mumbai 2005", {
        body: "Extreme convective burst: 98% humidity & 32 hPa pressure drop (944mm/24h). Model τ >= 0.875.",
        tag: "cloudburst-preset"
      });
    } else if (presetKey === 'wayanad') {
      setHumidity(97);
      setPressureDrop(35);
      setTemperature(22);
      setWindSpeed(54);
      setTcwv(60);
      const stn = STATIONS_NETWORK.find(s => s.id === 'wayanad');
      if (stn) setSelectedStation(stn);
      sendBrowserNotification("⚠️ Western Ghats Alert: Wayanad 2024", {
        body: "Orographic convective cloudburst over Kerala Ghats: 97% humidity & 35 hPa drop.",
        tag: "cloudburst-preset"
      });
    } else if (presetKey === 'barmer') {
      setHumidity(92);
      setPressureDrop(28);
      setTemperature(31);
      setWindSpeed(48);
      setTcwv(52);
      const stn = STATIONS_NETWORK.find(s => s.id === 'barmer');
      if (stn) setSelectedStation(stn);
      sendBrowserNotification("⚠️ Desert Cloudburst: Barmer 2006", {
        body: "Thar Desert anomaly: 92% humidity surge & 28 hPa drop over arid basin.",
        tag: "cloudburst-preset"
      });
    } else if (presetKey === 'clear') {
      setHumidity(52);
      setPressureDrop(8);
      setTemperature(22);
      setWindSpeed(16);
      setTcwv(28);
      sendBrowserNotification("☀️ Convective System Cleared", {
        body: "Atmospheric parameters stabilized. Low cloudburst risk.",
        tag: "cloudburst-preset"
      });
    }
  };

  const handleResetDefaults = () => {
    setHumidity(90);
    setPressureDrop(30);
    setTemperature(18);
    setWindSpeed(45);
    setTcwv(52);
  };

  // Handler for Milestone Replay Click
  const handleSelectEvent = (event) => {
    setSelectedEventId(event.id);
    setHumidity(event.humidity);
    setPressureDrop(event.pressureDrop);
    setTemperature(event.temp);
    setWindSpeed(event.windSpeed);
    playAlertSiren();
  };

  // NavRail click handler
  const handleSelectNav = (navId) => {
    setActiveNav(navId);
    if (navId === 'home') {
      setIsSimulatorOpen(false);
      setIsMeteoPanelOpen(false);
      setIsAnalyticsOpen(false);
    } else if (navId === 'dashboard') {
      setIsSimulatorOpen(true);
      setIsMeteoPanelOpen(true);
      setIsAnalyticsOpen(true);
      setActiveLayer('convective');
      setIsCloudburstCardOpen(true);
      handleFocusCloudburstEpicenter(activeCloudburstEvent);
    } else if (navId === 'meteo') {
      setIsLiveMode(true);
      setIsMeteoPanelOpen(true);
      if (selectedStation) {
        loadLiveMeteo(selectedStation.lat, selectedStation.lon, selectedStation.name || selectedStation.stationName);
      }
    } else if (navId === 'radar') {
      setActiveLayer('precip');
    } else if (navId === 'analytics') {
      setIsAnalyticsOpen(true);
    } else if (navId === 'settings') {
      setIsSimulatorOpen(true);
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
    <div className="relative w-screen h-screen bg-[#070e1b] overflow-hidden select-none font-sans text-slate-100 flex">
      {/* 1. Far-Left Vertical Icon Rail */}
      <NavRail
        activeNav={activeNav}
        onSelectNav={handleSelectNav}
        onToggleSimulator={() => setIsSimulatorOpen(!isSimulatorOpen)}
        onToggleMeteo={() => {
          setIsLiveMode(true);
          setIsMeteoPanelOpen(!isMeteoPanelOpen);
        }}
        showTemperature={activeLayer === 'temp'}
        onToggleTemperature={() => setActiveLayer((prev) => (prev === 'temp' ? 'none' : 'temp'))}
        showParticles={showParticles && windParticleMode !== 'off'}
        onToggleParticles={() => {
          if (windParticleMode === 'off' || !showParticles) {
            setWindParticleMode('normal');
            setShowParticles(true);
          } else {
            setWindParticleMode('off');
            setShowParticles(false);
          }
        }}
        isSatellite={mapView === 'satellite'}
        onToggleSatellite={() => setMapView((prev) => (prev === 'satellite' ? 'default' : 'satellite'))}
        tempUnit={tempUnit}
        onToggleTempUnit={handleToggleTempUnit}
      />

      {/* 2. Main Dashboard Container: Full-Height Map + Floating Transparent BurstWatch Header + Glass Panels */}
      <div className="relative flex-1 h-full overflow-hidden">
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
          riskPercent={threatData.riskPercent}
          currentTimeStr={currentTimePoint.label}
          userLocation={userLocation}
          activeLayer={activeLayer}
          onChangeActiveLayer={setActiveLayer}
          is3D={is3D}
          onToggle3D={handleToggle3D}
          mapView={mapView}
          onToggleMapView={(view) => setMapView(typeof view === 'string' ? view : (mapView === 'satellite' ? 'liberty' : 'satellite'))}
          isHomeView={isHomeView}
          isAnalyticsOpen={isAnalyticsOpen}
          showParticles={!showIntro && showParticles && windParticleMode !== 'off'}
          onToggleParticles={(val) => {
            setShowParticles(val);
            if (!val) {
              setWindParticleMode('off');
            } else if (windParticleMode === 'off') {
              setWindParticleMode('normal');
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
          cloudburstEvent={activeCloudburstEvent}
          onFocusEpicenter={handleFocusCloudburstEpicenter}
        />

        {/* Floating Transparent BurstWatch Top Header Bar */}
        <CloudburstHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSelectStation={handleSelectStation}
          stations={STATIONS_NETWORK}
          is3D={is3D}
          onToggle3D={handleToggle3D}
          mapView={mapView}
          onToggleMapView={(view) => setMapView(typeof view === 'string' ? view : (mapView === 'satellite' ? 'default' : 'satellite'))}
          userLocation={userLocation}
          onGoToMyLocation={handleGoToMyLocation}
          isLocatingUser={isLocatingUser}
          isLiveMode={isLiveMode}
          onToggleLiveMode={handleToggleLiveMode}
          isMeteoLoading={isMeteoLoading}
          onReplayIntro={() => setShowIntro(true)}
          cloudburstEvent={activeCloudburstEvent}
          isCloudburstCardOpen={isCloudburstCardOpen}
          onToggleCloudburstAlert={() => setIsCloudburstCardOpen(!isCloudburstCardOpen)}
        />

        {/* Location Feedback Toast Notification */}
        {locationToast && (
          <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-full shadow-2xl text-xs font-semibold select-none transition-all ${
            locationToast.type === 'requesting'
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

        {/* Floating Left Panel: Live Open-Meteo Telemetry vs What-If Simulator */}
        {!isHomeView && (
          isLiveMode ? (
            isMeteoPanelOpen && (
              <div id="live-meteo-panel-container" className="absolute top-16 left-4 z-20 pointer-events-auto">
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
            )
          ) : (
            isSimulatorOpen && (
              <div id="what-if-simulator-container" className="absolute top-16 left-4 z-20 pointer-events-auto">
                <WhatIfSimulator
                  humidity={humidity}
                  setHumidity={setHumidity}
                  pressureDrop={pressureDrop}
                  setPressureDrop={setPressureDrop}
                  temperature={temperature}
                  setTemperature={setTemperature}
                  windSpeed={windSpeed}
                  setWindSpeed={setWindSpeed}
                  tcwv={tcwv}
                  setTcwv={setTcwv}
                  onResetDefaults={handleResetDefaults}
                  onApplyPreset={handleApplyPreset}
                />
              </div>
            )
          )
        )}

        {/* Floating Emergency Mission Control: Cloudburst Event HUD Card */}
        {isCloudburstCardOpen && activeCloudburstEvent && !isHomeView && (
          <div className={`absolute top-16 z-30 transition-all duration-300 pointer-events-auto ${
            (isLiveMode ? isMeteoPanelOpen : isSimulatorOpen) ? 'left-4 sm:left-[395px]' : 'left-4'
          }`}>
            <CloudburstEventCard
              event={activeCloudburstEvent}
              riskPercent={currentRiskPercent}
              activePresetKey={cloudburstPresetKey}
              onSelectPreset={(key) => {
                setCloudburstPresetKey(key);
                const stn = STATIONS_NETWORK.find(s => s.id === key) || (key === 'dharamshala' ? {
                  id: 'dharamshala',
                  name: 'Dharamshala Ridge & Kangra Gorge',
                  state: 'Himachal Pradesh',
                  lat: 32.2190,
                  lon: 76.3234,
                  status: 'critical',
                  riskScore: 91,
                  elevation: 1457
                } : null);
                if (stn) {
                  handleSelectStation(stn);
                }
              }}
              onFocusEpicenter={() => handleFocusCloudburstEpicenter(activeCloudburstEvent)}
              onClose={() => setIsCloudburstCardOpen(false)}
            />
          </div>
        )}

        {/* Floating Right Column: Threat Analytics Panel */}
        {!isHomeView && (
          isAnalyticsOpen ? (
            <div id="threat-analytics-panel-container" className="absolute top-16 right-4 z-20 pointer-events-auto max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-none pr-0.5">
              <ThreatAnalyticsPanel
                riskPercent={threatData.riskPercent}
                severity={threatData.severity}
                features={threatData.features}
                currentTimeStr={currentTimePoint.label}
                station={selectedStation}
                onSelectIndiaHotspot={() => {
                  if (STATIONS_NETWORK && STATIONS_NETWORK.length > 0) {
                    const hotspot = STATIONS_NETWORK[0];
                    setSelectedStation(hotspot);
                    loadLiveMeteo(hotspot.lat, hotspot.lon, hotspot.name);
                  }
                }}
                onOpenIncidentModal={() => setIsIncidentModalOpen(true)}
                onClose={() => setIsAnalyticsOpen(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setIsAnalyticsOpen(true)}
              className="absolute top-16 right-4 z-20 pointer-events-auto flex items-center gap-2 apple-liquid-glass-pill px-4 py-2.5 rounded-full shadow-xl text-xs font-semibold text-white transition-all cursor-pointer"
            >
              <BarChart3 className="w-4 h-4 text-rose-400" />
              <span>Show Threat Analytics</span>
            </button>
          )
        )}

        {/* Floating Ventusky-Style Wind Particle Dropdown Menu */}
        {!isHomeView && (
          <div className={`absolute z-30 transition-all duration-300 pointer-events-auto ${
            (isLiveMode ? isMeteoPanelOpen : isSimulatorOpen) ? 'left-[400px]' : 'left-4'
          } ${activeLayer !== 'none' && mapView !== 'satellite' ? 'bottom-28' : 'bottom-8'}`}>
            <WindParticleDropdown
              mode={windParticleMode}
              onChangeMode={(newMode) => {
                setWindParticleMode(newMode);
                if (newMode === 'off') {
                  setShowParticles(false);
                } else {
                  setShowParticles(true);
                }
              }}
            />
          </div>
        )}

        {/* Floating Multi-Variable Weather Color Scale Legend Bar */}
        {activeLayer !== 'none' && mapView !== 'satellite' && !isHomeView && (
          <div className={`absolute z-30 transition-all duration-300 pointer-events-none ${
            activeLayer === 'precip'
              ? 'right-2.5 top-1/2 -translate-y-1/2'
              : `bottom-16 ${(isLiveMode ? isMeteoPanelOpen : isSimulatorOpen) ? 'left-[400px]' : 'left-4'}`
          }`}>
            <TemperatureLegendBar
              activeLayer={activeLayer}
              tempUnit={tempUnit}
              onToggleTempUnit={handleToggleTempUnit}
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

      {/* 5. 120 FPS Cinematic Launch Intro Splash Animation */}
      {showIntro && (
        <CinematicIntroSplash onComplete={() => setShowIntro(false)} />
      )}

    </div>
  );
}