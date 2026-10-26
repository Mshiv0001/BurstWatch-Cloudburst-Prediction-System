import { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  User, 
  Share2, 
  Settings
} from 'lucide-react';
import { STATIONS_DATA } from '../data/mockData';

export default function TopNav({
  selectedKey = 'dehradun',
  onSelectStation
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef(null);

  const stationsList = Object.values(STATIONS_DATA);

  // Filter stations based on search query
  const filteredStations = stationsList.filter(
    (stn) =>
      stn.stationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stn.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none select-none h-11">
      {/* Left: Perfectly Baseline-Aligned Search Bar + 3 Action Buttons */}
      <div className="pointer-events-auto flex items-center gap-2 h-11">
        {/* Rounded Frosted Search Input Pill (h-10) */}
        <div ref={searchRef} className="relative w-64 sm:w-72 h-10">
          <div className="windy-glass-pill rounded-full px-3.5 h-10 flex items-center gap-2.5 shadow-2xl transition-all">
            <Search className="w-4 h-4 text-slate-300 shrink-0" />
            <input
              type="text"
              placeholder="Search cities, coordinates..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              className="w-full bg-transparent border-none outline-none text-xs text-white placeholder:text-slate-400 font-medium leading-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white text-xs font-bold px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl windy-glass overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 border border-white/20">
              <div className="p-2 border-b border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Monitoring Stations</span>
                <span>{filteredStations.length} found</span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-white/5">
                {filteredStations.map((station) => (
                  <button
                    key={station.key}
                    onClick={() => {
                      onSelectStation(station.key);
                      setSearchQuery('');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-white/10 transition-colors ${
                      selectedKey === station.key ? 'bg-cyan-500/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-white">{station.stationName}</div>
                        <div className="text-[10px] text-slate-400">{station.region}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-white">
                        {station.primaryMetrics?.temperature?.value}°C
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        station.riskLevel === 'HIGH' ? 'bg-red-500/30 text-red-300' :
                        station.riskLevel === 'MODERATE' ? 'bg-amber-500/30 text-amber-300' :
                        'bg-emerald-500/30 text-emerald-300'
                      }`}>
                        {station.riskLevel}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3 Circular Frosted Action Buttons (h-10 w-10) */}
        <button
          className="windy-glass-pill hover:bg-slate-700/80 w-10 h-10 rounded-full flex items-center justify-center text-slate-200 hover:text-white shadow-xl transition-transform active:scale-95 shrink-0"
          title="User Profile"
        >
          <User className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(window.location.href);
            }
          }}
          className="windy-glass-pill hover:bg-slate-700/80 w-10 h-10 rounded-full flex items-center justify-center text-slate-200 hover:text-white shadow-xl transition-transform active:scale-95 shrink-0"
          title="Share Coordinates & Radar View"
        >
          <Share2 className="w-4 h-4" />
        </button>

        <button
          className="windy-glass-pill hover:bg-slate-700/80 w-10 h-10 rounded-full flex items-center justify-center text-slate-200 hover:text-white shadow-xl transition-transform active:scale-95 shrink-0"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Center: Current Conditions Hub Badge (h-10, exactly on the same baseline) */}
      <div className="pointer-events-auto flex items-center gap-3 px-4 h-10 rounded-2xl windy-glass shadow-2xl border border-white/20 select-none">
        <div className="text-left border-r border-white/15 pr-3 flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Avg. Temp
          </span>
          <span className="text-base font-black text-white font-mono leading-none">
            26.5°C
          </span>
        </div>
        <div className="text-left flex items-baseline gap-2">
          <span className="text-xs font-bold text-slate-200">
            Current Conditions Hub
          </span>
          <span className="text-[11px] font-mono text-slate-300 font-medium">
            H: 33.2°C / L: 14.5°C
          </span>
        </div>
      </div>

      {/* Right Balance Spacer */}
      <div className="w-16 hidden lg:block pointer-events-none" />
    </header>
  );
}