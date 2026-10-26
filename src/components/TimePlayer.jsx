import { useEffect, useRef } from 'react';
import { 
  Play, 
  Pause,
  ChevronDown
} from 'lucide-react';

const RADAR_TIMELINE_SEGMENTS = [
  { id: 'r0', label: '24h ago', hasDot: true, timeDisplay: 'Yesterday' },
  { id: 'r1', label: '6h ago', hasDot: true, timeDisplay: '12:12 PM - 6h ago' },
  { id: 'r2', label: '1h ago', hasDot: false, timeDisplay: '5:12 PM - 1h ago' },
  { id: 'r3', label: 'Now (Live)', isLive: true, timeDisplay: '6:12 PM - 0m ago' },
  { id: 'r4', label: 'Next 1h', isForecast: true, timeDisplay: '7:12 PM - +1h (Nowcast)' },
];

export default function TimePlayer({
  timeIndex,
  onSelectTimeIndex,
  isPlaying,
  onTogglePlay,
  playbackSpeed
}) {
  const currentSlot = RADAR_TIMELINE_SEGMENTS[timeIndex] || RADAR_TIMELINE_SEGMENTS[3];
  const timerRef = useRef(null);

  // Auto-play interval
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(500, 1600 / playbackSpeed);
      timerRef.current = setInterval(() => {
        onSelectTimeIndex((prev) => (prev + 1) % RADAR_TIMELINE_SEGMENTS.length);
      }, intervalMs);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, playbackSpeed, onSelectTimeIndex]);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto flex items-end">
      {/* Play Button & Time Badge Container at Bottom Left */}
      <div className="relative flex items-center pl-3 pb-2 z-40 gap-2 shrink-0">
        {/* Circular Frosted Play Button */}
        <button
          onClick={onTogglePlay}
          title={isPlaying ? "Pause Radar Animation" : "Play Radar Animation"}
          className="w-10 h-10 rounded-full windy-glass hover:bg-slate-700/90 text-white flex items-center justify-center shadow-2xl transition-transform active:scale-90 ring-1 ring-white/25"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-white" />
          ) : (
            <Play className="w-4 h-4 fill-white translate-x-0.5" />
          )}
        </button>

        {/* Active Time Badge (Golden-Orange Badge with Needle matching screenshot) */}
        <div className="relative flex flex-col items-center">
          <div className="px-3 py-1 rounded-md bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-extrabold text-xs font-mono shadow-lg leading-tight">
            {currentSlot.timeDisplay}
          </div>
          <div className="w-0.5 h-2 bg-amber-500" />
        </div>
      </div>

      {/* Full-Width Radar Timeline Scrubber matching screenshot */}
      <div className="flex-1 windy-glass rounded-t-xl border-t border-x border-white/15 px-3 py-1.5 shadow-[0_-10px_30px_rgba(0,0,0,0.6)] flex flex-col gap-1">
        <div className="flex items-center gap-1">
          {RADAR_TIMELINE_SEGMENTS.map((segment, index) => {
            const isCurrent = timeIndex === index;
            const isPassed = timeIndex >= index;

            return (
              <button
                key={segment.id}
                onClick={() => onSelectTimeIndex(index)}
                className={`flex-1 py-1 px-2 rounded flex flex-col items-center gap-1 transition-all ${
                  isCurrent
                    ? 'bg-slate-700/95 text-amber-300 font-bold ring-1 ring-amber-400/70 shadow-md'
                    : isPassed
                    ? 'hover:bg-slate-700/50 text-slate-200'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-300'
                }`}
              >
                {/* Segment Label */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                    {segment.label}
                  </span>
                  {segment.hasDot && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 opacity-90 shadow" />
                  )}
                </div>

                {/* Progress bar line (with Red bar for Next 1h forecast segment) */}
                <div className={`w-full h-1 rounded-full ${
                  segment.isForecast
                    ? 'bg-red-600'
                    : isCurrent
                    ? 'bg-amber-400'
                    : isPassed
                    ? 'bg-slate-400'
                    : 'bg-slate-600'
                }`} />
              </button>
            );
          })}
        </div>

        {/* More options link at bottom of scrubber */}
        <div className="flex justify-center -mt-0.5">
          <button
            onClick={() => onSelectTimeIndex((timeIndex + 1) % RADAR_TIMELINE_SEGMENTS.length)}
            className="flex items-center gap-0.5 text-[9px] text-slate-400 hover:text-slate-200 transition-colors font-sans"
          >
            <ChevronDown className="w-3 h-3" />
            <span>More options...</span>
          </button>
        </div>
      </div>
    </div>
  );
}
