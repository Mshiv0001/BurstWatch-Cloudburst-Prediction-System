import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Wind } from 'lucide-react';

export const WIND_PARTICLE_OPTIONS = [
  { id: 'off', label: 'Off' },
  { id: 'normal', label: 'Normal' },
  { id: 'strong', label: 'Strong' },
  { id: 'dark', label: 'Dark' },
  { id: 'fast', label: 'Fast-motion' },
];

export default function WindParticleDropdown({ 
  mode = 'normal', 
  onChangeMode,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('pointerdown', handlePointerDown);
      return () => document.removeEventListener('pointerdown', handlePointerDown);
    }
  }, [isOpen]);

  const currentOption = WIND_PARTICLE_OPTIONS.find((opt) => opt.id === mode) || WIND_PARTICLE_OPTIONS[1];

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Dropdown Menu Popup (Opens upwards above the pill button, matching Ventusky reference) */}
      {isOpen && (
        <div 
          className="absolute bottom-full mb-1.5 left-0 bg-white rounded-lg shadow-2xl border border-slate-200/90 py-1 min-w-[130px] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {WIND_PARTICLE_OPTIONS.map((opt) => {
            const isSelected = mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (onChangeMode) onChangeMode(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3.5 py-1.5 text-[13px] font-sans transition-colors cursor-pointer block select-none ${
                  isSelected 
                    ? 'bg-[#1a73e8] text-white font-medium' 
                    : 'text-slate-800 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Pill Button (Dark rounded pill matching Ventusky reference) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Wind Particle Mode"
        className="flex items-center justify-between gap-2.5 bg-[#2b272e]/92 hover:bg-[#38333c] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xl border border-white/15 backdrop-blur-md transition-all cursor-pointer select-none active:scale-95"
      >
        <span className="font-sans font-medium text-[13px] tracking-tight text-white/95 leading-none">
          {currentOption.label}
        </span>
        <ChevronDown 
          className={`w-3.5 h-3.5 text-white/80 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
    </div>
  );
}
