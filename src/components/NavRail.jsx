import { useState, useRef } from 'react';
import {
  Menu,
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
import { motion, AnimatePresence } from 'framer-motion';
import FpsCounter from './FpsCounter';

const SMOOTH_SPRING = { type: 'spring', stiffness: 320, damping: 28, mass: 0.8 };
const LABEL_TRANSITION = { duration: 0.24, ease: [0.16, 1, 0.3, 1] };

/**
 * Modern GlassAura™ Floating Navigation Dock (visionOS / Apple Liquid Glass)
 *
 * - Top 3-line Menu button smoothly expands/collapses button labels
 * - ML Engine status indicator & FPS counter stay compact circular telemetry badges
 */
export default function NavRail({
  activeNav = 'dashboard',
  onSelectNav,
  openNavIds = null,
  isAlertsOpen = false,
  isExpanded: controlledExpanded = undefined,
  onToggleExpand = null,
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
  isMlRetrying = false,
  onRefreshMlStatus = null,
  mlError = null
}) {
  const wrapperRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const showTooltip = (e, label, force = false) => {
    if (isExpanded && !force) return;
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    const btnRect = e.currentTarget.getBoundingClientRect();
    if (!wrapperRect) return;
    const top = btnRect.top - wrapperRect.top + btnRect.height / 2;
    setTooltip({ label, top });
  };

  const hideTooltip = () => {
    setTooltip(null);
  };

  const handleToggleExpand = () => {
    hideTooltip();
    if (onToggleExpand) {
      onToggleExpand(!isExpanded);
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  const navItems = [
    { id: 'dashboard', icon: LayoutGrid, label: 'Convective Grid' },
    { id: 'rankings', icon: ArrowDownWideNarrow, label: 'Risk Rankings' },
    { id: 'analytics', icon: BarChart3, label: 'Threat Analytics' },
    { id: 'meteo', icon: CloudSun, label: 'Station Telemetry' }
  ];

  const weatherLayers = [
    { id: 'temp', icon: Thermometer, label: 'Temperature' },
    { id: 'convective', icon: Zap, label: 'Cloudburst' },
    { id: 'precip', icon: CloudRain, label: 'Rain Radar' },
    { id: 'wind', icon: Wind, label: 'Wind Speed' },
    { id: 'aqi', icon: Activity, label: 'Air Quality (AQI)' }
  ];

  const mlTooltipLabel = isMlRetrying
    ? 'Checking ML Engine...'
    : isMlLive && !isMlStale
      ? 'ML LIVE (Click to refresh)'
      : isMlStale
        ? `ML STALE — forecast from ${mlStaleMinutes ?? '?'} min ago`
        : 'ML OFFLINE (Click to retry)';

  const renderLabel = (text, colorClass = 'text-slate-100') => (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.span
          initial={{ opacity: 0, x: -8, width: 0 }}
          animate={{ opacity: 1, x: 0, width: 'auto' }}
          exit={{ opacity: 0, x: -8, width: 0 }}
          transition={LABEL_TRANSITION}
          className={`relative z-10 overflow-hidden whitespace-nowrap text-[11.5px] font-medium tracking-tight pr-1.5 ${colorClass}`}
        >
          {text}
        </motion.span>
      )}
    </AnimatePresence>
  );

  const btnLayoutClass = 'w-full h-10 sm:h-9 justify-start';
  const iconSlotClass = 'relative z-10 w-10 sm:w-9 h-10 sm:h-9 shrink-0 flex items-center justify-center';

  return (
    <div ref={wrapperRef} className="relative flex items-start">
      <motion.aside
        initial={{ opacity: 0, x: -20, scale: 0.96 }}
        animate={{
          opacity: 1,
          x: 0,
          scale: 1,
          width: isExpanded ? 196 : (typeof window !== 'undefined' && window.innerWidth < 640 ? 52 : 48)
        }}
        transition={SMOOTH_SPRING}
        className="nav-rail-scroll scrollbar-none apple-liquid-glass rounded-[26px] sm:rounded-[24px] py-2 px-1.5 border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.65)] flex flex-col items-stretch gap-1.5 sm:gap-1 select-none pointer-events-auto overflow-x-hidden"
        aria-label="Navigation & Layer Dock"
      >
        {/* 0. Expand / Collapse 3-Line Menu Button */}
        <div className={`flex flex-col ${isExpanded ? 'items-stretch' : 'items-center'}`}>
          <motion.button
            type="button"
            whileHover={{ scale: isExpanded ? 1.02 : 1.1 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            onClick={handleToggleExpand}
            onMouseEnter={(e) => showTooltip(e, isExpanded ? 'Collapse Menu' : 'Expand Menu')}
            onMouseLeave={hideTooltip}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse navigation labels' : 'Expand navigation labels'}
            title={isExpanded ? 'Collapse Menu' : 'Menu'}
            className={`relative group flex items-center rounded-full transition-colors cursor-pointer select-none ${btnLayoutClass} ${
              isExpanded
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                : 'text-slate-300 hover:text-white hover:bg-white/15 border border-transparent'
            }`}
          >
            <span className={iconSlotClass}>
              <Menu className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
            </span>
            {renderLabel('Menu', 'text-cyan-200 font-semibold')}
          </motion.button>
        </div>

        {/* Visual Section Divider */}
        <div className={`h-[1.5px] bg-white/25 my-0.5 shrink-0 rounded-full transition-all duration-300 ${isExpanded ? 'w-full opacity-50' : 'w-5 self-center'}`} />

        {/* 1. Top Section: Navigation Items */}
        <div className={`flex flex-col gap-1 ${isExpanded ? 'items-stretch' : 'items-center'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = Array.isArray(openNavIds)
              ? openNavIds.includes(item.id)
              : activeNav === item.id;
            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: isExpanded ? 1.02 : 1.12 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                onClick={() => {
                  hideTooltip();
                  if (onSelectNav) onSelectNav(item.id);
                }}
                onMouseEnter={(e) => showTooltip(e, item.label)}
                onMouseLeave={hideTooltip}
                title={item.label}
                aria-label={item.label}
                className={`relative group flex items-center rounded-full transition-colors cursor-pointer select-none ${btnLayoutClass} ${
                  isActive
                    ? 'text-cyan-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/15'
                }`}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-full bg-cyan-500/25 border border-cyan-400/45 shadow-[0_0_12px_rgba(34,211,238,0.28)]" />
                )}
                <span className={iconSlotClass}>
                  <Icon className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
                </span>
                {renderLabel(item.label, isActive ? 'text-cyan-200 font-semibold' : 'text-slate-200')}
              </motion.button>
            );
          })}
        </div>

        {/* Visual Section Divider */}
        <div className={`h-[1.5px] bg-white/25 my-1 shrink-0 rounded-full transition-all duration-300 ${isExpanded ? 'w-full opacity-50' : 'w-5 self-center'}`} />

        {/* 2. Middle Section: Weather Overlay Layer Buttons */}
        <div className={`flex flex-col gap-1 ${isExpanded ? 'items-stretch' : 'items-center'}`}>
          {weatherLayers.map((layer) => {
            const Icon = layer.icon;
            const isActive = activeLayer === layer.id;
            return (
              <motion.button
                key={layer.id}
                whileHover={{ scale: isExpanded ? 1.02 : 1.12 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                onClick={() => {
                  hideTooltip();
                  if (onChangeActiveLayer) {
                    onChangeActiveLayer(isActive ? 'none' : layer.id);
                  }
                }}
                onMouseEnter={(e) => showTooltip(e, `${layer.label} Layer`)}
                onMouseLeave={hideTooltip}
                title={`${layer.label} Layer`}
                aria-label={`${layer.label} Layer`}
                className={`relative group flex items-center rounded-full transition-colors cursor-pointer select-none ${btnLayoutClass} ${
                  isActive
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
                <span className={iconSlotClass}>
                  <Icon className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
                </span>
                {renderLabel(layer.label, isActive ? 'text-cyan-200 font-semibold' : 'text-slate-200')}

                {/* Active Indicator Pip */}
                {isActive && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`absolute z-10 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8] ${
                      isExpanded ? 'right-2.5 top-1/2 -translate-y-1/2' : 'top-1.5 right-1.5'
                    }`}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Visual Section Divider */}
        <div className={`h-[1.5px] bg-white/25 my-1 shrink-0 rounded-full transition-all duration-300 ${isExpanded ? 'w-full opacity-50' : 'w-5 self-center'}`} />

        {/* 3. Bottom Section: System Tools (Satellite Imagery & Alerts) */}
        <div className={`flex flex-col gap-1 ${isExpanded ? 'items-stretch' : 'items-center'}`}>
          {/* Dedicated High-Resolution Satellite View Toggle */}
          <motion.button
            whileHover={{ scale: isExpanded ? 1.02 : 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              hideTooltip();
              onToggleSatellite?.();
            }}
            onMouseEnter={(e) => showTooltip(e, isSatellite ? 'Satellite Imagery: ON' : 'Satellite Imagery: OFF')}
            onMouseLeave={hideTooltip}
            title={isSatellite ? 'Satellite View Active (Click to switch to Default Map)' : 'Switch to High-Resolution Satellite Imagery'}
            aria-label="Toggle Satellite Imagery"
            className={`relative group flex items-center rounded-full transition-all cursor-pointer select-none ${btnLayoutClass} ${
              isSatellite
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                : 'text-slate-400 hover:text-white hover:bg-white/15 border border-transparent'
            }`}
          >
            <span className={iconSlotClass}>
              <Satellite className={`w-[18px] h-[18px] sm:w-4 sm:h-4 ${isSatellite ? 'text-emerald-300 animate-pulse' : ''}`} />
            </span>
            {renderLabel('Satellite View', isSatellite ? 'text-emerald-200 font-semibold' : 'text-slate-200')}

            {isSatellite && (
              <span
                className={`absolute w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981] ${
                  isExpanded ? 'right-2.5 top-1/2 -translate-y-1/2' : 'top-1.5 right-1.5'
                }`}
              />
            )}
          </motion.button>

          {/* Email Weather Alerts Subscription Button */}
          <motion.button
            whileHover={{ scale: isExpanded ? 1.02 : 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              hideTooltip();
              onOpenEmailModal?.();
            }}
            onMouseEnter={(e) => showTooltip(e, isEmailSubscribed ? 'Weather Alerts Active' : 'Subscribe to Alerts')}
            onMouseLeave={hideTooltip}
            title={isEmailSubscribed ? `Email Weather Alerts Active (${userProfile?.email || 'Verified'})` : 'Subscribe to Real-Time Weather Alerts'}
            aria-label="Weather Alerts Subscription"
            className={`relative group flex items-center rounded-full transition-all cursor-pointer select-none ${btnLayoutClass} ${
              isAlertsOpen
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/45 shadow-[0_0_12px_rgba(34,211,238,0.28)]'
                : isEmailSubscribed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/15 border border-transparent'
            }`}
          >
            <span className={iconSlotClass}>
              {userProfile?.picture ? (
                <img
                  src={userProfile.picture}
                  alt={userProfile.name || 'User'}
                  className="w-5 h-5 rounded-full object-cover border border-emerald-400"
                />
              ) : (
                <Bell className={`w-[18px] h-[18px] sm:w-4 sm:h-4 ${isEmailSubscribed ? 'text-emerald-300 animate-pulse' : ''}`} />
              )}
            </span>
            {renderLabel('Weather Alerts', isAlertsOpen ? 'text-cyan-200 font-semibold' : isEmailSubscribed ? 'text-emerald-200 font-semibold' : 'text-slate-200')}

            {isEmailSubscribed && (
              <span
                className={`absolute flex h-2 w-2 ${
                  isExpanded ? 'right-2.5 top-1/2 -translate-y-1/2' : 'top-1.5 right-1.5'
                }`}
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              </span>
            )}
          </motion.button>
        </div>

        {/* Visual Section Divider */}
        <div className={`h-[1.5px] bg-white/25 my-1 shrink-0 rounded-full transition-all duration-300 ${isExpanded ? 'w-full opacity-50' : 'w-5 self-center'}`} />

        {/* 4. Telemetry Section (Excluded from text expansion — compact circular badges) */}
        <div className={`flex items-center transition-all duration-300 ${isExpanded ? 'flex-row justify-center gap-2.5 py-0.5' : 'flex-col gap-1'}`}>
          {/* Dual-Engine ML Model Status Button */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              hideTooltip();
              onRefreshMlStatus?.();
            }}
            disabled={isMlRetrying}
            onMouseEnter={(e) => showTooltip(e, mlTooltipLabel, true)}
            onMouseLeave={hideTooltip}
            title={
              isMlLive && !isMlStale
                ? 'Physics-Informed Dual-Engine ML Model: LIVE (Click to refresh status)'
                : isMlStale
                  ? `Dual-Engine ML Model: STALE — forecast from ${mlStaleMinutes ?? '?'} min ago - Click to retry`
                  : `Dual-Engine ML Model: OFFLINE (${mlError || 'ML service unreachable'}) - Click to retry`
            }
            aria-label={mlTooltipLabel}
            className={`relative group w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-all cursor-pointer select-none border border-transparent ${
              isMlRetrying
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

      {/* Unclipped Floating Tooltip on hover */}
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
