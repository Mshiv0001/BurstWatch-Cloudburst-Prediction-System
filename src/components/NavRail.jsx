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
  Bell
} from 'lucide-react';
import { motion } from 'framer-motion';

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
  isEmailSubscribed = false
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
    <aside
      className="apple-liquid-glass rounded-full py-2.5 px-1.5 border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.65)] flex flex-col items-center gap-1.5 select-none pointer-events-auto max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-none"
      aria-label="Navigation & Layer Dock"
    >
      {/* 1. Top Section: Navigation Items */}
      <div className="flex flex-col items-center gap-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                if (onSelectNav) onSelectNav(item.id);
              }}
              title={item.label}
              className={`relative group w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer select-none ${
                isActive
                  ? 'apple-liquid-glass-cyan text-cyan-200 border border-cyan-400/50 shadow-[0_0_12px_rgba(56,189,248,0.35)] scale-105'
                  : 'text-slate-400 hover:text-white hover:bg-white/15 border border-transparent'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />

              {/* Sleek Glass Hover Tooltip */}
              <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-white/20 shadow-2xl z-50">
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Visual Section Divider */}
      <div className="w-5 h-px bg-white/15 my-0.5" />

      {/* 2. Middle Section: Weather Overlay Layer Buttons */}
      <div className="flex flex-col items-center gap-1.5">
        {weatherLayers.map((layer) => {
          const Icon = layer.icon;
          const isActive = activeLayer === layer.id;
          return (
            <motion.button
              key={layer.id}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                if (onChangeActiveLayer) {
                  onChangeActiveLayer(isActive ? 'none' : layer.id);
                }
              }}
              title={layer.label}
              className={`relative group w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer select-none ${
                isActive
                  ? 'apple-liquid-glass-cyan text-cyan-200 border border-cyan-400/50 shadow-[0_0_12px_rgba(56,189,248,0.35)] scale-105'
                  : 'text-slate-400 hover:text-white hover:bg-white/15 border border-transparent'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />

              {/* Active Indicator Pip */}
              {isActive && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]" />
              )}

              {/* Sleek Glass Hover Tooltip */}
              <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-white/20 shadow-2xl z-50">
                {layer.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Visual Section Divider */}
      <div className="w-5 h-px bg-white/15 my-0.5" />

      {/* 3. Bottom Section: System Tools (Satellite Imagery & Alerts) */}
      <div className="flex flex-col items-center gap-1.5">
        {/* Dedicated High-Resolution Satellite View Toggle */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={onToggleSatellite}
          title={isSatellite ? "Satellite View Active (Click to switch to Default Map)" : "Switch to High-Resolution Satellite Imagery"}
          className={`relative group w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer select-none border shadow-md ${
            isSatellite
              ? 'apple-liquid-glass-emerald text-emerald-300 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.35)] scale-105'
              : 'text-slate-400 hover:text-white hover:bg-white/15 border-transparent'
          }`}
        >
          <Satellite className={`w-4.5 h-4.5 ${isSatellite ? 'text-emerald-300 animate-pulse' : ''}`} />

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
          title={isEmailSubscribed ? "Email Weather Alerts Active (Click to manage)" : "Subscribe to Real-Time Weather Alerts"}
          className={`relative group w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer select-none border shadow-md ${
            isEmailSubscribed
              ? 'apple-liquid-glass-emerald text-emerald-300 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.35)] scale-105'
              : 'text-slate-400 hover:text-white hover:bg-white/15 border-transparent'
          }`}
        >
          <Bell className={`w-4.5 h-4.5 ${isEmailSubscribed ? 'text-emerald-300 animate-pulse' : ''}`} />

          {/* Active emerald pulse badge when subscribed */}
          {isEmailSubscribed && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            </span>
          )}

          {/* Tooltip */}
          <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-white/20 shadow-2xl z-50">
            {isEmailSubscribed ? 'Weather Alerts: Active' : 'Subscribe to Alerts'}
          </span>
        </motion.button>
      </div>
    </aside>
  );
}
