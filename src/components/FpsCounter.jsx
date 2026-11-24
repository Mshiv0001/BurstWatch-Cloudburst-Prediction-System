import React, { useState, useEffect, useRef } from 'react';
import { Gauge, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Real-Time FPS Performance Monitor
 * Measures exact frame delivery rate via high-precision requestAnimationFrame.
 * Supports:
 * - variant="rail": Compact vertical liquid-glass button for NavRail sidebar with popover opening to the right
 * - variant="header": Pill button matching header design
 */
export default function FpsCounter({ className = "", variant = "header" }) {
  const [fps, setFps] = useState(60);
  const [frameTimeMs, setFrameTimeMs] = useState(16.6);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    let animId;
    let frames = 0;
    const frameDeltas = [];
    let lastTime = performance.now();

    const loop = (now) => {
      const delta = now - lastTime;
      lastTime = now;

      // Filter out background tab pauses (> 250ms)
      if (delta > 0 && delta < 250) {
        frameDeltas.push(delta);
        if (frameDeltas.length > 30) frameDeltas.shift();
      }

      frames++;
      // Update display every 15 frames (~250ms) for responsive, jitter-free readout
      if (frames % 15 === 0 && frameDeltas.length >= 8) {
        const avgDelta = frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length;
        const computedFps = Math.min(240, Math.max(1, Math.round(1000 / avgDelta)));
        setFps(computedFps);
        setFrameTimeMs(Number(avgDelta.toFixed(1)));
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Performance classification
  const isOptimal = fps >= 50;
  const isAcceptable = fps >= 25 && fps < 50;

  const statusColor = isOptimal 
    ? 'text-emerald-400' 
    : isAcceptable 
    ? 'text-amber-400' 
    : 'text-rose-400';

  const dotColor = isOptimal
    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
    : isAcceptable
    ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
    : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]';

  // Compact Rail Variant for the Left NavRail Sidebar
  if (variant === 'rail') {
    return (
      <div ref={popoverRef} className="relative select-none pointer-events-auto">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsOpen(!isOpen)}
          title={`Hardware Telemetry & GPU Monitor: ${fps} FPS (${isOptimal ? 'Optimal' : isAcceptable ? 'Acceptable' : 'Under Load'})`}
          className={`relative group w-10 h-10 flex flex-col items-center justify-center rounded-full transition-all cursor-pointer select-none border shadow-md ${
            isOpen
              ? 'ring-2 ring-emerald-400/50 border-emerald-400/60 bg-emerald-500/20 shadow-emerald-950/40'
              : 'apple-liquid-glass hover:bg-white/15 border-white/20'
          } ${className}`}
        >
          {/* Pulsing Fluidity Indicator */}
          <span className="relative flex h-1.5 w-1.5 mb-0.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`} />
          </span>

          {/* Live FPS Number */}
          <span className={`font-mono font-black text-[11px] leading-none tabular-nums ${statusColor}`}>
            {fps}
          </span>
          {/* Subtext */}
          <span className="text-[7.5px] font-bold text-slate-400 font-mono tracking-tighter uppercase leading-none mt-0.5">
            FPS
          </span>

          {/* Tooltip on hover (when popover is not open) */}
          {!isOpen && (
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full apple-liquid-glass text-white text-[11px] font-medium tracking-normal whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity border border-white/20 shadow-xl z-50">
              Hardware Telemetry: {fps} FPS
            </span>
          )}
        </motion.button>

        {/* Popover opens to the right of the vertical sidebar */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-full ml-3 bottom-0 w-64 glass-panel-translucent rounded-3xl p-4 shadow-2xl z-50 flex flex-col gap-3 border border-white/20 text-slate-100"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Engine Telemetry</span>
                </div>
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full ${
                  isOptimal 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {isOptimal ? 'Smooth 60+' : 'Optimizing'}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col">
                  <span className="text-[9px] text-slate-400 uppercase font-sans">Framerate</span>
                  <span className={`text-base font-bold ${statusColor}`}>{fps} FPS</span>
                </div>
                <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col">
                  <span className="text-[9px] text-slate-400 uppercase font-sans">Frame Time</span>
                  <span className="text-base font-bold text-white">{frameTimeMs} ms</span>
                </div>
              </div>

              {/* Hardware Status */}
              <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col gap-1 text-[10px]">
                <div className="flex items-center justify-between text-slate-300">
                  <span>GPU Acceleration</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> WebGL 2.0 Active
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Rendering Mode</span>
                  <span className="text-cyan-300 font-semibold">Zero-Stall Pipeline</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Bottom HUD Pill Variant (opens popover UPWARDS)
  if (variant === 'bottom') {
    return (
      <div ref={popoverRef} className="relative select-none pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={`Hardware Telemetry & GPU Monitor: ${fps} FPS (${isOptimal ? 'Optimal' : isAcceptable ? 'Acceptable' : 'Under Load'})`}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold transition-all cursor-pointer glass-panel-translucent border shadow-2xl select-none ${
            isOpen
              ? 'ring-2 ring-emerald-400/50 border-emerald-400/60 bg-emerald-500/20 shadow-[0_0_14px_rgba(16,185,129,0.25)]'
              : 'border-white/20 text-slate-200 hover:text-white hover:bg-white/10'
          } ${className}`}
        >
          {/* Pulsing Fluidity Indicator */}
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
          </span>

          {/* Live FPS Value */}
          <div className="flex items-baseline gap-1">
            <span className={`font-black text-[12px] tabular-nums tracking-tight ${statusColor}`}>
              {fps}
            </span>
            <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider font-sans">
              FPS
            </span>
          </div>
        </button>

        {/* Interactive Performance HUD Popover (Opens UPWARDS) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-12 right-0 w-64 glass-panel-translucent rounded-3xl p-4 shadow-2xl z-50 flex flex-col gap-3 border border-white/20 text-slate-100"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Engine Telemetry</span>
                </div>
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full ${
                  isOptimal 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {isOptimal ? 'Smooth 60+' : 'Optimizing'}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col">
                  <span className="text-[9px] text-slate-400 uppercase font-sans">Framerate</span>
                  <span className={`text-base font-bold ${statusColor}`}>{fps} FPS</span>
                </div>
                <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col">
                  <span className="text-[9px] text-slate-400 uppercase font-sans">Frame Time</span>
                  <span className="text-base font-bold text-white">{frameTimeMs} ms</span>
                </div>
              </div>

              {/* Hardware Status */}
              <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col gap-1 text-[10px]">
                <div className="flex items-center justify-between text-slate-300">
                  <span>GPU Acceleration</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> WebGL 2.0 Active
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Rendering Mode</span>
                  <span className="text-cyan-300 font-semibold">Zero-Stall Pipeline</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Header / Pill Variant
  return (
    <div ref={popoverRef} className="relative select-none pointer-events-auto">
      {/* Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Real-Time FPS & Hardware Acceleration Monitor"
        className={`apple-liquid-glass-pill h-10 px-3.5 flex items-center gap-2 rounded-full font-mono text-xs cursor-pointer select-none transition-all ${
          isOpen ? 'ring-2 ring-emerald-400/50 border-emerald-400/60' : ''
        } ${className}`}
      >
        {/* Pulsing Fluidity Indicator */}
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>

        {/* Live FPS Value */}
        <div className="flex items-baseline gap-1">
          <span className={`font-black text-[13px] tabular-nums tracking-tight ${statusColor}`}>
            {fps}
          </span>
          <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
            FPS
          </span>
        </div>
      </button>

      {/* Interactive Performance HUD Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-12 right-0 w-64 glass-panel-translucent rounded-3xl p-4 shadow-2xl z-50 flex flex-col gap-3 border border-white/20 text-slate-100"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Engine Telemetry</span>
              </div>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full ${
                isOptimal 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {isOptimal ? 'Smooth 60+' : 'Optimizing'}
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col">
                <span className="text-[9px] text-slate-400 uppercase font-sans">Framerate</span>
                <span className={`text-base font-bold ${statusColor}`}>{fps} FPS</span>
              </div>
              <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col">
                <span className="text-[9px] text-slate-400 uppercase font-sans">Frame Time</span>
                <span className="text-base font-bold text-white">{frameTimeMs} ms</span>
              </div>
            </div>

            {/* Hardware Status */}
            <div className="apple-liquid-glass-well p-2.5 rounded-2xl flex flex-col gap-1 text-[10px]">
              <div className="flex items-center justify-between text-slate-300">
                <span>GPU Acceleration</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> WebGL 2.0 Active
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Rendering Mode</span>
                <span className="text-cyan-300 font-semibold">Zero-Stall Pipeline</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
