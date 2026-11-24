import React from 'react';
import { 
  Home, 
  LayoutGrid, 
  ArrowDownWideNarrow,
  BarChart3,
  CloudSun,
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
 *   1. Views & Workspaces (Overview, Convective Grid, Rankings, Threat Analytics, Meteo)
 *   2. System Tools (Satellite Mode, Weather Alerts, ML Engine Live/Offline Status)
 *   3. Hardware Telemetry (Compact Circular FPS Fluidity Monitor with slide-out Diagnostics HUD)
 */
export default function NavRail({
  activeNav = 'dashboard',
  onSelectNav,
  isSatellite = false,
  onToggleSatellite,
  cloudburstEvent = null,
  isMlRetrying = false,
  onRefreshMlStatus = null,
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

  const isMlLive = cloudburstEvent?.isLive === true;

  return (
    <aside
      className="apple-liquid-glass rounded-full py-2.5 px-1.5 border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.65)] flex flex-col items-center gap-1.5 select-none pointer-events-auto"
      aria-label="Navigation & Telemetry Dock"
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

      {/* 2. Middle Section: System Tools (Satellite, Alerts, ML Engine Status) */}
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

        {/* Real-Time ML Engine Status & Click-to-Retry Button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={onRefreshMlStatus}
          disabled={isMlRetrying}
          title={isMlLive
            ? 'Dual-Engine ML Model is LIVE (Click to refresh status)'
            : `ML Engine is OFFLINE: ${cloudburstEvent?.error || 'Cannot reach http://localhost:8001'} (Click to retry)`}
          className={`relative group w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer select-none border shadow-md ${
            isMlLive
              ? 'apple-liquid-glass-emerald text-emerald-300 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              : 'apple-liquid-glass-crimson text-rose-300 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
          }`}
        >
          {isMlRetrying ? (
            <RefreshCw className="w-4 h-4 animate-spin text-slate-200" />
          ) : (
            <Cpu className={`w-4.5 h-4.5 ${isMlLive ? 'text-emerald-300' : 'text-rose-300'}`} />
          )}

          {/* Status Indicator Dot */}
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            {isMlLive ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
            )}
          </span>

          {/* Tooltip */}
          <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-white/20 shadow-2xl z-50">
            {isMlLive ? 'ML Engine: LIVE (Click to refresh)' : 'ML Engine: OFFLINE (Click to retry)'}
          </span>
        </motion.button>
      </div>

      {/* Visual Section Divider */}
      <div className="w-5 h-px bg-white/15 my-0.5" />

      {/* 3. Bottom Section: Hardware FPS Monitor */}
      <div className="flex flex-col items-center">
        <FpsCounter variant="rail" />
      </div>
    </aside>
  );
}
