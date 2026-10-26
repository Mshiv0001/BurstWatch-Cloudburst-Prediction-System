import React, { useEffect } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { HISTORICAL_EVENTS, TIMELINE_POINTS } from '../data/cloudburstData';

export default function HistoricalEventReplay({
  currentTimeIndex,
  onSelectTimeIndex,
  isPlaying,
  onTogglePlay,
  selectedEventId,
  onSelectEvent
}) {
  const [selectedModel, setSelectedModel] = React.useState('ECMWF 9km');

  // Auto-play interval effect
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        onSelectTimeIndex((prev) => (prev + 1) % TIMELINE_POINTS.length);
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, onSelectTimeIndex]);

  const handlePrev = () => {
    onSelectTimeIndex((prev) => (prev > 0 ? prev - 1 : TIMELINE_POINTS.length - 1));
  };

  const handleNext = () => {
    onSelectTimeIndex((prev) => (prev + 1) % TIMELINE_POINTS.length);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="tint-glass-base rounded-2xl px-4 py-2.5 border border-white/10 select-none z-20 flex flex-col gap-2 relative w-full shadow-xl"
    >
      {/* Top Row: Title + Historical Landmark Milestones */}
      <div className="flex items-center justify-between gap-3">
        {/* Title & Active Time Indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <Clock className="w-3.5 h-3.5 text-[#f05542]" />
          <span className="text-xs font-semibold tracking-tight text-slate-200">
            Timeline Replay
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#ff9f00] text-slate-950 font-bold font-mono text-[10px] shadow-sm shadow-amber-500/30">
            {TIMELINE_POINTS[currentTimeIndex]?.label || "14:00"}
          </span>
        </div>

        {/* Landmark Event Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {HISTORICAL_EVENTS.map((evt) => {
            const isSelected = selectedEventId === evt.id;
            return (
              <button
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-normal whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#f05542] text-white border border-[#f05542] shadow-sm shadow-[#f05542]/30'
                    : 'bg-[#141f33]/80 hover:bg-[#1c2a42] text-slate-300 hover:text-white border border-white/5'
                }`}
              >
                {evt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Middle Row: Media Controls + Timeline Track */}
      <div className="flex items-center gap-3 pt-0.5">
        {/* Media Buttons */}
        <div className="flex items-center gap-1 shrink-0 bg-[#131d2e] p-1 rounded-xl border border-white/10">
          <button
            onClick={handlePrev}
            title="Step Back"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onTogglePlay}
            title={isPlaying ? "Pause Simulation" : "Play Timeline Replay"}
            className="p-1.5 rounded-lg bg-[#f05542] hover:bg-[#df3b28] text-white transition-colors shadow-md shadow-[#f05542]/35"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={handleNext}
            title="Step Forward"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timeline Track with Timestamps */}
        <div className="relative flex-1 flex flex-col justify-center gap-1.5">
          {/* Timeline Bar Track */}
          <div className="relative w-full h-1.5 rounded-full bg-[#131d2e] border border-white/10 overflow-hidden cursor-pointer">
            <motion.div 
              className="h-full bg-gradient-to-r from-amber-500 via-[#f05542] to-[#dc2626]"
              style={{
                width: `${(currentTimeIndex / (TIMELINE_POINTS.length - 1)) * 100}%`
              }}
              transition={{ duration: 0.2 }}
            />
          </div>

          {/* Time Marker Ticks */}
          <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400 px-0.5">
            {TIMELINE_POINTS.map((pt, idx) => {
              const isCurrent = idx === currentTimeIndex;
              return (
                <button
                  key={idx}
                  onClick={() => onSelectTimeIndex(idx)}
                  className={`transition-colors hover:text-white ${
                    isCurrent 
                      ? 'text-[#ff9f00] font-bold' 
                      : pt.isPeak 
                        ? 'text-amber-400 font-medium' 
                        : ''
                  }`}
                >
                  {pt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row: Windy Weather Model Selector & Meteorological Rain Scale */}
      <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-[10px]">
        {/* Windy Forecast Model Selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400 font-medium mr-0.5">Model:</span>
          {['ECMWF 9km', 'GFS 22km', 'ICON 13km', 'IMD 3km'].map((model) => {
            const isSelected = selectedModel === model;
            return (
              <button
                key={model}
                onClick={() => setSelectedModel(model)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium transition-all ${
                  isSelected
                    ? 'bg-[#ff9f00] text-slate-950 font-bold shadow-sm shadow-amber-500/30'
                    : 'bg-[#141f33]/80 hover:bg-[#1a2842] text-slate-300'
                }`}
              >
                {model}
              </button>
            );
          })}
        </div>

        {/* Windy Meteorological Rain Scale Legend */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-medium">Rain (mm/h):</span>
          <div className="flex flex-col gap-0.5">
            <div 
              className="w-32 sm:w-36 h-2 rounded-full shadow-inner" 
              style={{
                background: 'linear-gradient(to right, #38bdf8 0%, #22c55e 20%, #eab308 40%, #f97316 65%, #f05542 85%, #a855f7 100%)'
              }}
            />
            <div className="flex justify-between text-[8px] font-mono text-slate-400 px-0.5">
              <span>0</span>
              <span>1</span>
              <span>5</span>
              <span>10</span>
              <span>20</span>
              <span>40</span>
              <span>80+</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
