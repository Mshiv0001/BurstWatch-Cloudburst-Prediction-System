import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Wind, Waves, Thermometer, EyeOff } from 'lucide-react';
import { WIND_PARTICLE_STYLES, getWindParticleStyle } from '../utils/windParticleStyles';

export const WIND_PARTICLE_OPTIONS = WIND_PARTICLE_STYLES;

// Icon mapping per AeroSilk style
const STYLE_ICONS = {
  silk: Waves,
  thermal: Thermometer,
  grand: Wind,
  off: EyeOff,
};

export default function WindParticleDropdown({
  mode = 'silk',
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

  const currentOption = getWindParticleStyle(mode);
  const CurrentIcon = STYLE_ICONS[currentOption.id] || Waves;

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Dropdown Menu Popup (Opens downwards below the pill button) */}
      {isOpen && (
        <div
          className="absolute top-full mt-2 right-0 glass-panel-translucent rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.65)] p-1.5 min-w-[240px] sm:min-w-[260px] max-w-[calc(100vw-20px)] max-h-[calc(100dvh-5.5rem)] overflow-y-auto scrollbar-none z-50 animate-in fade-in zoom-in-95 duration-150 select-none text-white"
        >
          {/* Header */}
          <div className="px-3 pt-1.5 pb-1 border-b border-white/10 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-wider uppercase text-cyan-300 font-semibold">
              Wind Animation
            </span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
              Live Flow
            </span>
          </div>

          {/* Style Options */}
          <div className="flex flex-col gap-1">
            {WIND_PARTICLE_STYLES.map((style) => {
              const isSelected = (mode === style.id) || (mode === 'normal' && style.id === 'silk');
              const IconComponent = STYLE_ICONS[style.id] || Waves;

              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => {
                    if (onChangeMode) onChangeMode(style.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-full transition-all duration-150 cursor-pointer flex items-center gap-3 select-none group ${isSelected
                    ? 'bg-white/15 border border-white/25 shadow-inner'
                    : 'hover:bg-white/8 border border-transparent'
                    }`}
                >
                  {/* Miniature Gradient Swatch Badge */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform group-hover:scale-105 ${isSelected ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-[#090e1a]' : ''
                      }`}
                    style={{
                      background: style.id === 'off'
                        ? '#27272a'
                        : `linear-gradient(135deg, ${style.accentColor}40, ${style.accentColor}dd)`
                    }}
                  >
                    <IconComponent
                      className="w-3.5 h-3.5"
                      style={{ color: style.id === 'off' ? '#94a3b8' : '#ffffff' }}
                    />
                  </div>

                  {/* Text Details */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className={`text-[12.5px] font-sans font-medium tracking-tight truncate leading-tight ${isSelected ? 'text-white font-semibold' : 'text-slate-200 group-hover:text-white'
                      }`}>
                      {style.label}
                    </span>
                    <span className="text-[10.5px] font-sans text-slate-400 truncate mt-0.5 leading-snug">
                      {style.subtitle}
                    </span>
                  </div>

                  {/* Active Indicator Dot */}
                  {isSelected && (
                    <div
                      className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px_currentColor] mr-1"
                      style={{ backgroundColor: style.accentColor, color: style.accentColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pill Button (Matches header controls height and styling) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Select Wind Animation Style"
        className="h-9 sm:h-10 flex items-center justify-between gap-2 apple-liquid-glass-pill hover:bg-white/15 text-white pl-2.5 pr-3.5 rounded-full text-xs font-semibold shadow-md border border-white/20 transition-all cursor-pointer select-none active:scale-95 group"
      >
        {/* Style Icon Swatch with subtle glow */}
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm"
          style={{
            backgroundColor: currentOption.id === 'off' ? '#3f3f46' : `${currentOption.accentColor}30`,
            border: `1px solid ${currentOption.id === 'off' ? '#52525b' : currentOption.accentColor + '80'}`
          }}
        >
          <CurrentIcon
            className="w-3 h-3"
            style={{ color: currentOption.id === 'off' ? '#a1a1aa' : currentOption.accentColor }}
          />
        </div>

        <span className="font-sans font-medium text-[12px] sm:text-[13px] tracking-tight text-white/95 leading-none whitespace-nowrap">
          {currentOption.label}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-white/70 transition-transform duration-200 group-hover:text-white ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
    </div>
  );
}
