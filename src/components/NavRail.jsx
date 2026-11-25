import React from 'react';
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
  activeLayer = 'convective',
  onChangeActiveLayer,
  isSatellite = false,
  onToggleSatellite,
  onOpenEmailModal = null,
  isEmailSubscribed = false,
  userProfile = null,
  isMlLive = false,
  isMlRetrying = false,
  onRefreshMlStatus = null,
  mlError = null
}) {
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

  return (
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
          const isActive = activeNav === item.id;
          return (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 450, damping: 24 }}
              onClick={() => {
                if (onSelectNav) onSelectNav(item.id);
              }}
              title={item.label}
              className={`relative group w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer select-none ${isActive
                  ? 'text-cyan-300'
                  : 'text-slate-400 hover:text-white hover:bg-white/15'
                }`}
            >
              {isActive && (
                <motion.span
                  layoutId="navRailActiveNavPill"
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="absolute inset-0 rounded-full bg-cyan-500/20 border border-cyan-400/35 shadow-[0_0_12px_rgba(34,211,238,0.22)]"
                />
              )}
              <Icon className="relative z-10 w-4 h-4" />

              {/* Sleek Glass Hover Tooltip */}
              <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 translate-x-1 group-hover:translate-x-0 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 border border-white/20 shadow-2xl z-50">
                {item.label}
              </span>
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
                if (onChangeActiveLayer) {
                  onChangeActiveLayer(isActive ? 'none' : layer.id);
                }
              }}
              title={layer.label}
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

              {/* Sleek Glass Hover Tooltip */}
              <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 translate-x-1 group-hover:translate-x-0 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 border border-white/20 shadow-2xl z-50">
                {layer.label}
              </span>
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
          onClick={onToggleSatellite}
          title={isSatellite ? "Satellite View Active (Click to switch to Default Map)" : "Switch to High-Resolution Satellite Imagery"}
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

          {/* Tooltip */}
          <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-white/20 shadow-2xl z-50">
            {isSatellite ? 'Satellite Imagery: ON' : 'Satellite Imagery: OFF'}
          </span>
        </motion.button>

        {/* Email Weather Alerts Subscription Button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={onOpenEmailModal}
          title={isEmailSubscribed ? `Email Weather Alerts Active (${userProfile?.email || 'Verified'})` : "Subscribe to Real-Time Weather Alerts"}
          className={`relative group w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-all cursor-pointer select-none ${isEmailSubscribed
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

          {/* Tooltip */}
          <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-white/20 shadow-2xl z-50">
            {isEmailSubscribed ? `Weather Alerts Active: ${userProfile?.email || 'Verified'}` : 'Subscribe to Alerts'}
          </span>
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
          onClick={onRefreshMlStatus}
          disabled={isMlRetrying}
          title={
            isMlLive
              ? 'Physics-Informed Dual-Engine ML Model: LIVE (Click to refresh status)'
              : `Dual-Engine ML Model: OFFLINE (${mlError || 'Cannot reach localhost:8001'}) - Click to retry`
          }
          className={`relative group w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-all cursor-pointer select-none border border-transparent ${isMlRetrying
              ? 'bg-white/10 text-slate-200'
              : isMlLive
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/20 text-rose-300'
            }`}
        >
          {isMlRetrying ? (
            <RefreshCw className="w-4 h-4 animate-spin text-slate-200" />
          ) : (
            <Cpu className={`w-4 h-4 ${isMlLive ? 'text-emerald-300' : 'text-rose-300'}`} />
          )}

          {/* Tooltip */}
          <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-white/20 shadow-2xl z-50">
            {isMlRetrying ? 'Checking ML Engine...' : isMlLive ? 'ML LIVE (Click to refresh)' : 'ML OFFLINE (Click to retry)'}
          </span>
        </motion.button>

        {/* Hardware FPS Monitor Button */}
        <FpsCounter variant="rail" />
      </div>
    </motion.aside>
  );
}
