import React, { useState, useRef } from 'react';
import {
  Home,
  LayoutGrid,
  ArrowDownWideNarrow,
  BarChart3,
  CloudSun,
  Thermometer,
  Zap,
  CloudRain,
  Wind,
  Activity,
  Satellite,
  Bell,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import FpsCounter from './FpsCounter';

/**
 * Modern GlassAura™ Floating Navigation Dock (visionOS / Apple Liquid Glass)
 *
 * Architecture:
 * - Floating liquid glass capsule dock (rounded-full) detached from screen edges
 * - Map passes seamlessly underneath with full optical refraction and blur
 * - 3 functional zones:
 *   1. Primary Workspaces (Overview, Convective Grid, Rankings, Threat Analytics, Station Telemetry)
 *   2. Weather Overlays (Temperature, Cloudburst, Rain Radar, Wind Speed, Air Quality)
 *   3. System Map Tools (Satellite Imagery Mode, Weather Alert Subscriptions)
 */
export default function NavRail({
  activeNav = 'dashboard',
  onSelectNav,
  openNavIds = null,
  isAlertsOpen = false,
  activeLayer = 'convective',
  onChangeActiveLayer,
  isSatellite = false,
  onToggleSatellite,
  onOpenEmailModal = null,
  isEmailSubscribed = false,
  userProfile = null,
  isMlLive = false,
  isMlStale = false,
  mlStaleMinutes = null,
  mlStaleReason = null,
  isMlRetrying = false,
  onRefreshMlStatus = null,
  mlError = null
}) {
  const wrapperRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const showTooltip = (e, label) => {
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    const btnRect = e.currentTarget.getBoundingClientRect();
    if (!wrapperRect) return;
    const top = btnRect.top - wrapperRect.top + btnRect.height / 2;
    setTooltip({ label, top });
  };

  const hideTooltip = () => {
    setTooltip(null);
  };

  const navItems = [
    { id: 'home', icon: Home, label: 'Overview' },
    { id: 'dashboard', icon: LayoutGrid, label: 'Convective Grid' },
    { id: 'rankings', icon: ArrowDownWideNarrow, label: 'Risk Rankings (High → Low)' },
    { id: 'analytics', icon: BarChart3, label: 'Threat Analytics' },
    { id: 'meteo', icon: CloudSun, label: 'Station Telemetry' }
  ];

  const weatherLayers = [
    { id: 'temp', icon: Thermometer, label: 'Temperature Layer' },
    { id: 'convective', icon: Zap, label: 'Cloudburst Layer' },
    { id: 'precip', icon: CloudRain, label: 'Rain Radar Layer' },
    { id: 'wind', icon: Wind, label: 'Wind Speed Layer' },
    { id: 'aqi', icon: Activity, label: 'Air Quality (AQI) Layer' }
  ];

  const mlTooltipLabel = isMlRetrying
    ? 'Checking ML Engine...'
    : isMlLive && !isMlStale
      ? 'ML LIVE (Click to refresh)'
      : isMlStale
        ? `ML STALE — forecast from ${mlStaleMinutes ?? '?'} min ago`
        : 'ML OFFLINE (Click to retry)';

  return (
    <div ref={wrapperRef} className="relative flex items-start">
      <motion.aside
        initial={{ opacity: 0, x: -20, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="nav-rail-scroll scrollbar-none apple-liquid-glass rounded-full py-2 px-1.5 border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.65)] flex flex-col items-center gap-1 select-none pointer-events-auto"
        aria-label="Navigation & Layer Dock"
      >
        {/* 1. Top Section: Navigation Items */}
        <div className="flex flex-col items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = Array.isArray(openNavIds)
              ? openNavIds.includes(item.id)
              : activeNav === item.id;
            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                onClick={() => {
                  hideTooltip();
                  if (onSelectNav) onSelectNav(item.id);
                }}
                onMouseEnter={(e) => showTooltip(e, item.label)}
                onMouseLeave={hideTooltip}
                title={item.label}
                aria-label={item.label}
                className={`relative group w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer select-none ${isActive
                    ? 'text-cyan-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/15'
                  }`}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-full bg-cyan-500/25 border border-cyan-400/45 shadow-[0_0_12px_rgba(34,211,238,0.28)]" />
                )}
                <Icon className="relative z-10 w-4 h-4" />
              </motion.button>
            );
          })}
        </div>

        {/* Visual Section Divider */}
        <div className="w-5 h-[1.5px] bg-white/25 my-1 shrink-0 rounded-full" />

        {/* 2. Middle Section: Weather Overlay Layer Buttons */}
        <div className="flex flex-col items-center gap-1">
          {weatherLayers.map((layer) => {
            const Icon = layer.icon;
            const isActive = activeLayer === layer.id;
            return (
              <motion.button
                key={layer.id}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                onClick={() => {
                  hideTooltip();
                  if (onChangeActiveLayer) {
                    onChangeActiveLayer(isActive ? 'none' : layer.id);
                  }
                }}
                onMouseEnter={(e) => showTooltip(e, layer.label)}
                onMouseLeave={hideTooltip}
                title={layer.label}
                aria-label={layer.label}
                className={`relative group w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer select-none ${isActive
                    ? 'text-cyan-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/15'
                  }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="navRailActiveLayerPill"
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-cyan-500/20 border border-cyan-400/35 shadow-[0_0_12px_rgba(34,211,238,0.22)]"
                  />
                )}
                <Icon className="relative z-10 w-4 h-4" />

                {/* Active Indicator Pip */}
                {isActive && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute z-10 top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]"
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Visual Section Divider */}
        <div className="w-5 h-[1.5px] bg-white/25 my-1 shrink-0 rounded-full" />

        {/* 3. Bottom Section: System Tools (Satellite Imagery & Alerts) */}
        <div className="flex flex-col items-center gap-1">
          {/* Dedicated High-Resolution Satellite View Toggle */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              hideTooltip();
              onToggleSatellite?.();
            }}
            onMouseEnter={(e) => showTooltip(e, isSatellite ? 'Satellite Imagery: ON' : 'Satellite Imagery: OFF')}
            onMouseLeave={hideTooltip}
            title={isSatellite ? "Satellite View Active (Click to switch to Default Map)" : "Switch to High-Resolution Satellite Imagery"}
            aria-label="Toggle Satellite Imagery"
            className={`relative group w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-all cursor-pointer select-none ${isSatellite
                ? 'bg-emerald-500/20 text-emerald-300 border border-transparent'
                : 'text-slate-400 hover:text-white hover:bg-white/15 border border-transparent'
              }`}
          >
            <Satellite className={`w-4 h-4 ${isSatellite ? 'text-emerald-300 animate-pulse' : ''}`} />

            {/* Active indicator dot */}
            {isSatellite && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            )}
          </motion.button>

          {/* Email Weather Alerts Subscription Button */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              hideTooltip();
              onOpenEmailModal?.();
            }}
            onMouseEnter={(e) => showTooltip(e, isEmailSubscribed ? 'Weather Alerts Active' : 'Subscribe to Alerts')}
            onMouseLeave={hideTooltip}
            title={isEmailSubscribed ? `Email Weather Alerts Active (${userProfile?.email || 'Verified'})` : "Subscribe to Real-Time Weather Alerts"}
            aria-label="Weather Alerts Subscription"
            className={`relative group w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-all cursor-pointer select-none ${
              isAlertsOpen
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/45 shadow-[0_0_12px_rgba(34,211,238,0.28)]'
                : isEmailSubscribed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/15 border border-transparent'
              }`}
          >
            {userProfile?.picture ? (
              <img
                src={userProfile.picture}
                alt={userProfile.name || 'User'}
                className="w-5 h-5 rounded-full object-cover border border-emerald-400"
              />
            ) : (
              <Bell className={`w-4 h-4 ${isEmailSubscribed ? 'text-emerald-300 animate-pulse' : ''}`} />
            )}

            {/* Active emerald pulse badge when subscribed */}
            {isEmailSubscribed && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              </span>
            )}
          </motion.button>
        </div>

        {/* Visual Section Divider */}
        <div className="w-5 h-[1.5px] bg-white/25 my-1 shrink-0 rounded-full" />

        {/* 4. Telemetry Section: ML Engine Status & Hardware FPS */}
        <div className="flex flex-col items-center gap-1">
          {/* Dual-Engine ML Model Status Button */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              hideTooltip();
              onRefreshMlStatus?.();
            }}
            disabled={isMlRetrying}
            onMouseEnter={(e) => showTooltip(e, mlTooltipLabel)}
            onMouseLeave={hideTooltip}
            title={
              isMlLive && !isMlStale
                ? 'Physics-Informed Dual-Engine ML Model: LIVE (Click to refresh status)'
                : isMlStale
                  ? `Dual-Engine ML Model: STALE — forecast from ${mlStaleMinutes ?? '?'} min ago (${mlStaleReason || 'API quota limit'}) - Click to retry`
                  : `Dual-Engine ML Model: OFFLINE (${mlError || 'ML service unreachable'}) - Click to retry`
            }
            aria-label={mlTooltipLabel}
            className={`relative group w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-all cursor-pointer select-none border border-transparent ${isMlRetrying
                ? 'bg-white/10 text-slate-200'
                : isMlLive && !isMlStale
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : isMlStale
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-rose-500/20 text-rose-300'
              }`}
          >
            {isMlRetrying ? (
              <RefreshCw className="w-4 h-4 animate-spin text-slate-200" />
            ) : (
              <Cpu className={`w-4 h-4 ${
                isMlLive && !isMlStale
                  ? 'text-emerald-300'
                  : isMlStale
                    ? 'text-amber-300'
                    : 'text-rose-300'
              }`} />
            )}

            {isMlStale && !isMlRetrying && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-black/40" />
            )}
          </motion.button>

          {/* Hardware FPS Monitor Button */}
          <FpsCounter variant="rail" />
        </div>
      </motion.aside>

      {/* Unclipped Floating Tooltip (works in phone/short-height overflow-y scroll mode & touch) */}
      {tooltip && (
        <div
          style={{ top: `${tooltip.top}px` }}
          className="absolute left-full ml-3 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap pointer-events-none border border-white/20 shadow-2xl z-50"
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
