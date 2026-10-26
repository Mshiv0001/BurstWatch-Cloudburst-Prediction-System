import React, { useState } from 'react';
import { 
  Radio, 
  Eye, 
  Orbit, 
  Wind, 
  Thermometer, 
  Cloud, 
  CloudRain, 
  Zap, 
  ZoomIn, 
  Box, 
  LayoutGrid,
  ChevronDown,
  Search,
  Sliders,
  Droplets,
  Layers,
  Compass,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WindySidebar({
  activeLayer = "radar",
  onSelectLayer,
  mapView = "dark",
  onToggleMapView,
  is3D = false,
  onToggle3D,
  showParticles = true,
  onToggleParticles,
  showIsobars = false,
  onToggleIsobars,
  onZoomIn,
  onClose
}) {
  const [filterQuery, setFilterQuery] = useState('');
  const [openSections, setOpenSections] = useState({
    base: true,
    modelAtmospheric: true,
    modelPrecipitation: true,
    viewControls: true
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Model features categorized for Windy-style filtering
  const allLayers = [
    { id: 'radar', name: 'Doppler Radar', category: 'base', icon: Radio, sub: 'Convective Nowcasting' },
    { id: 'satellite', name: 'Satellite Imagery', category: 'base', icon: Eye, sub: 'Visible Earth' },
    { id: 'satellite-ir', name: 'IR Cloud Tops', category: 'base', icon: Orbit, sub: 'Thermal Radiance' },
    
    // Model Atmospheric Features
    { id: 'humidity', name: 'Humidity Max', feature: 'relative_humidity_2m_max', category: 'atmospheric', icon: Droplets, sub: 'Relative Humidity 2m' },
    { id: 'temp', name: 'Temp Max', feature: 'temperature_2m_max', category: 'atmospheric', icon: Thermometer, sub: '2m Surface Temperature' },
    { id: 'clouds', name: 'Cloud Cover', feature: 'cloud_cover_max', category: 'atmospheric', icon: Cloud, sub: 'Total Cloud Fraction' },
    { id: 'pressure', name: 'Pressure Min', feature: 'surface_pressure_min', category: 'atmospheric', icon: Sliders, sub: 'Surface & MSL Pressure' },
    { id: 'tcwv', name: 'Water Vapour', feature: 'total_column_integrated_water_vapour_max', category: 'atmospheric', icon: Orbit, sub: 'Total Column (TCWV)' },
    { id: 'dew_point', name: 'Dew Point Max', feature: 'dew_point_2m_max', category: 'atmospheric', icon: Droplets, sub: 'Condensation Level' },

    // Model Precipitation & Dynamics
    { id: 'rain', name: 'Rain Max', feature: 'precipitation_max', category: 'precipitation', icon: CloudRain, sub: 'Rainfall Intensity (mm/h)' },
    { id: 'wind', name: 'Wind Gusts', feature: 'wind_gusts_10m_max', category: 'precipitation', icon: Wind, sub: 'Orographic Gusts (km/h)' },
    { id: 'soil', name: 'Soil Moisture', feature: 'soil_moisture_0_to_7cm_mean', category: 'precipitation', icon: Layers, sub: '0-7cm Soil Saturation' },
    { id: 'extreme', name: 'Extreme Rain ML', feature: 'Logistic Regression', category: 'precipitation', icon: Zap, sub: 'Target: >=50mm/day (0.875)' }
  ];

  const filteredLayers = allLayers.filter(l => 
    l.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (l.feature && l.feature.toLowerCase().includes(filterQuery.toLowerCase())) ||
    l.sub.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <aside className="absolute right-3 top-3 bottom-14 z-30 flex flex-col justify-start pointer-events-auto select-none">
      {/* Floating Frosted Glass Card: Refined Layer Panel */}
      <div className="w-64 windy-glass rounded-3xl p-3 shadow-2xl flex flex-col gap-2.5 max-h-full overflow-y-auto no-scrollbar border border-white/15 bg-[#0a1220]/95 backdrop-blur-2xl">
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10 px-1">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-100 tracking-tight uppercase">Windy Layers</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-500/30">
              {activeLayer.toUpperCase()}
            </span>
            {onClose && (
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Search / Filter System */}
        <div className="relative px-0.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 focus-within:border-cyan-400/50 transition-colors text-xs text-slate-200">
            <Search className="w-3 h-3 text-slate-400 shrink-0" />
            <input 
              type="text"
              placeholder="Filter model layers..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-[11px] placeholder:text-slate-500 text-white"
            />
            {filterQuery && (
              <button onClick={() => setFilterQuery('')} className="text-slate-400 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Quick View Controls: 2D vs 3D & Satellite vs Non-Satellite */}
        <div className="flex flex-col gap-1.5 p-2 rounded-2xl bg-slate-900/60 border border-white/10">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider px-1">
            Map Projection &amp; Basemap
          </span>

          <div className="grid grid-cols-2 gap-1.5">
            {/* 2D / 3D Toggle */}
            <button
              onClick={onToggle3D}
              className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                is3D 
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.3)]' 
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
              }`}
            >
              <Compass className={`w-3.5 h-3.5 ${is3D ? 'rotate-45 text-cyan-400' : ''} transition-transform`} />
              <span>{is3D ? '3D View' : '2D View'}</span>
            </button>

            {/* Satellite / Dark Canvas Toggle */}
            <button
              onClick={onToggleMapView}
              className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mapView === 'satellite' 
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.3)]' 
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{mapView === 'satellite' ? 'Satellite' : 'Non-Satellite'}</span>
            </button>
          </div>
        </div>

        {/* 1. BASE & RADAR ACCORDION */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => toggleSection('base')}
            className="flex items-center justify-between px-1 text-[10px] font-bold text-slate-400 tracking-wider uppercase hover:text-slate-200 transition-colors"
          >
            <span>Base &amp; Radar</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${openSections.base ? 'rotate-180' : ''}`} />
          </button>

          {openSections.base && (
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {filteredLayers.filter(l => l.category === 'base').map(item => {
                const Icon = item.icon;
                const isActive = activeLayer === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectLayer(item.id)}
                    className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                      isActive
                        ? 'windy-glass-tile-active text-amber-200 border-amber-400/80'
                        : 'windy-glass-tile text-slate-200'
                    }`}
                    title={item.sub}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-semibold text-center leading-tight">{item.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. ATMOSPHERIC MODEL FEATURES ACCORDION */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => toggleSection('modelAtmospheric')}
            className="flex items-center justify-between px-1 text-[10px] font-bold text-slate-400 tracking-wider uppercase hover:text-slate-200 transition-colors"
          >
            <span>Atmospheric Features</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${openSections.modelAtmospheric ? 'rotate-180' : ''}`} />
          </button>

          {openSections.modelAtmospheric && (
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {filteredLayers.filter(l => l.category === 'atmospheric').map(item => {
                const Icon = item.icon;
                const isActive = activeLayer === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectLayer(item.id)}
                    className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                      isActive
                        ? 'windy-glass-tile-active text-amber-200 border-amber-400/80'
                        : 'windy-glass-tile text-slate-200'
                    }`}
                    title={`${item.feature} (${item.sub})`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-semibold text-center leading-tight">{item.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. PRECIPITATION & DYNAMICS ACCORDION */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => toggleSection('modelPrecipitation')}
            className="flex items-center justify-between px-1 text-[10px] font-bold text-slate-400 tracking-wider uppercase hover:text-slate-200 transition-colors"
          >
            <span>Precipitation &amp; ML</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${openSections.modelPrecipitation ? 'rotate-180' : ''}`} />
          </button>

          {openSections.modelPrecipitation && (
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              {filteredLayers.filter(l => l.category === 'precipitation').map(item => {
                const Icon = item.icon;
                const isActive = activeLayer === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectLayer(item.id)}
                    className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                      isActive
                        ? 'windy-glass-tile-active text-amber-200 border-amber-400/80'
                        : 'windy-glass-tile text-slate-200'
                    }`}
                    title={`${item.feature || ''} (${item.sub})`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-semibold text-center leading-tight">{item.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. TOGGLES: Pressure & Particles */}
        <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5">
          {/* Pressure Isobar Toggle */}
          <div className="flex items-center justify-between text-xs text-slate-200 font-medium px-2 py-1.5 rounded-xl windy-glass-pill">
            <span className="text-[10px] font-semibold">isobars / pressure</span>
            <button
              onClick={onToggleIsobars}
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors relative cursor-pointer ${
                showIsobars ? 'bg-cyan-500' : 'bg-slate-700/80'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                  showIsobars ? 'translate-x-3.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Particles Animation Toggle */}
          <div className="flex items-center justify-between text-xs text-slate-200 font-medium px-2 py-1.5 rounded-xl windy-glass-pill">
            <span className="text-[10px] font-semibold">particles animation</span>
            <button
              onClick={onToggleParticles}
              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors relative cursor-pointer ${
                showParticles ? 'bg-cyan-500' : 'bg-slate-700/80'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                  showParticles ? 'translate-x-3.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Official Model Info Card */}
        <div className="mt-1 p-2 rounded-2xl bg-black/40 border border-white/10 text-[9px] text-slate-400 font-mono flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-200 font-sans font-semibold text-[10px]">
            <span>Model: Logistic Regression</span>
            <span className="text-amber-400">τ = 0.875</span>
          </div>
          <div>Target: Next-day rain &ge;50 mm/day</div>
          <div className="text-[8px] text-slate-500">Trained on 12,783 rows (1990–2024 IMD cells)</div>
        </div>
      </div>
    </aside>
  );
}
