import { 
  Home, 
  LayoutGrid, 
  Radar, 
  Sliders, 
  BarChart3,
  Radio,
  Thermometer,
  Wind,
  Satellite
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function NavRail({
  activeNav = 'dashboard',
  onSelectNav,
  onToggleMeteo,
  showTemperature = true,
  onToggleTemperature,
  showParticles = true,
  onToggleParticles,
  isSatellite = false,
  onToggleSatellite,
  tempUnit = 'C',
  onToggleTempUnit
}) {
  const navItems = [
    { id: 'home', icon: Home, label: 'Overview' },
    { id: 'dashboard', icon: LayoutGrid, label: 'Convective Grid' },
    { id: 'meteo', icon: Radio, label: 'Open-Meteo Live Data' },
    { id: 'radar', icon: Radar, label: 'Doppler Radar Scan' },
    { id: 'analytics', icon: BarChart3, label: 'Threat Analytics' }
  ];

  return (
    <aside className="apple-liquid-glass relative z-20 flex flex-col items-center justify-between py-4 w-16 border-r border-white/20 select-none shadow-2xl">
      {/* Navigation Item Icons */}
      <div className="flex flex-col items-center gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                if (item.id === 'meteo' && onToggleMeteo) {
                  onToggleMeteo();
                }
                if (onSelectNav) onSelectNav(item.id);
              }}
              title={item.label}
              className={`relative group p-2.5 rounded-2xl transition-all cursor-pointer ${
                isActive
                  ? 'apple-liquid-glass-crimson text-white shadow-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <Icon className="w-5 h-5" />

              {/* Subtle active line indicator */}
              {isActive && (
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-[#f05542] shadow-[0_0_8px_#f05542]" />
              )}

              {/* Tooltip */}
              <span className="absolute left-18 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-white/20 shadow-xl z-50">
                {item.label}
              </span>
            </motion.button>
          );
        })}

        {/* Divider */}
        <div className="w-8 h-[1px] bg-white/10 my-1" />

        {/* Dedicated Thermodynamic Temperature Layer Toggle */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={onToggleTemperature}
          title={showTemperature ? "Temperature Layer Active (Click to Hide)" : "Show Thermodynamic Temperature Layer"}
          className={`relative group p-2.5 rounded-2xl transition-all cursor-pointer ${
            showTemperature
              ? 'apple-liquid-glass-amber text-amber-300 shadow-md border border-amber-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <Thermometer className={`w-5 h-5 ${showTemperature ? 'animate-pulse text-amber-300' : ''}`} />

          {/* Active indicator dot */}
          {showTemperature && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
          )}

          {/* Tooltip */}
          <span className="absolute left-18 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-white/20 shadow-xl z-50">
            {showTemperature ? 'Temperature Overlay: ON' : 'Temperature Overlay: OFF'}
          </span>
        </motion.button>

        {/* Dedicated Atmospheric Wind Streamline Particles Toggle */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={onToggleParticles}
          title={showParticles ? "Wind Streamlines Active (Click to Hide)" : "Show Smooth Wind Streamlines"}
          className={`relative group p-2.5 rounded-2xl transition-all cursor-pointer ${
            showParticles
              ? 'apple-liquid-glass-cyan text-cyan-300 shadow-md border border-cyan-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <Wind className={`w-5 h-5 ${showParticles ? 'text-cyan-300' : ''}`} />

          {/* Active indicator dot */}
          {showParticles && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
          )}

          {/* Tooltip */}
          <span className="absolute left-18 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-white/20 shadow-xl z-50">
            {showParticles ? 'Wind Streamlines: ON' : 'Wind Streamlines: OFF'}
          </span>
        </motion.button>

        {/* Dedicated High-Resolution Satellite View Toggle */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={onToggleSatellite}
          title={isSatellite ? "Satellite View Active (Click to switch to Default Map)" : "Switch to High-Resolution Satellite Imagery"}
          className={`relative group p-2.5 rounded-2xl transition-all cursor-pointer ${
            isSatellite
              ? 'apple-liquid-glass-emerald text-emerald-300 shadow-md border border-emerald-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <Satellite className={`w-5 h-5 ${isSatellite ? 'text-emerald-300' : ''}`} />

          {/* Active indicator dot */}
          {isSatellite && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
          )}

          {/* Tooltip */}
          <span className="absolute left-18 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-white/20 shadow-xl z-50">
            {isSatellite ? 'Satellite Imagery: ON' : 'Satellite Imagery: OFF'}
          </span>
        </motion.button>
      </div>

      {/* Bottom Controls: Unit Switcher (°C / °F) & Doppler Frequency Indicator */}
      <div className="flex flex-col items-center gap-2.5">
        {/* Interactive °C ⇄ °F Unit Switcher Pill */}
        <button
          type="button"
          onClick={onToggleTempUnit}
          title={`Active Temperature Unit: °${tempUnit} — Click to switch to °${tempUnit === 'C' ? 'F' : 'C'}`}
          className="apple-liquid-glass-pill px-2.5 py-1 rounded-xl text-[11px] font-mono font-black text-cyan-300 hover:text-white transition-all cursor-pointer border border-white/20 shadow-md active:scale-95"
        >
          <span>°{tempUnit}</span>
        </button>

        {/* Doppler Telemetry Radio */}
        <div 
          className="apple-liquid-glass-well p-2.5 rounded-2xl text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
          title="Doppler Feed Active: 5.6 GHz"
        >
          <Radio className="w-4 h-4" />
        </div>
      </div>
    </aside>
  );
}
