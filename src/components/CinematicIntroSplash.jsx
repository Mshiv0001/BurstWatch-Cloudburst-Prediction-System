import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Zap, ShieldAlert, Crosshair } from 'lucide-react';

/**
 * CinematicLaunchSplash
 * 120 FPS GPU-accelerated launch animation:
 * 1. "BURSTWATCH" in signature Orbitron font glows in the center.
 * 2. "BURST" glides smoothly to the left, "WATCH" glides smoothly to the right.
 * 3. Reveals the 3D Vector Earth Globe spinning eastward towards the Indian subcontinent.
 * 4. Zooms smoothly into India / Himalayas with a futuristic convective lock reticle.
 * 5. Dissolves cleanly to reveal the active live dashboard.
 */
export default function CinematicIntroSplash({ onComplete }) {
  // Animation stages: 'intro' -> 'splitting' -> 'spinning' -> 'locked' -> 'fading' -> 'done'
  const [stage, setStage] = useState('intro');
  const [hudInfo, setHudInfo] = useState({
    status: 'INITIALIZING SATELLITE TELEMETRY...',
    sector: 'GLOBAL VECTOR GRID',
    coords: '0.00° N, 0.00° E'
  });
  const hasTriggeredMapFlight = useRef(false);

  useEffect(() => {
    // Set initial Atlantic vantage point as soon as map is ready in 2D Flat Mode
    const setupInitialView = (map) => {
      if (!map) return;
      try {
        window.__burstwatch_apply3D?.(false, false);
        map.jumpTo({
          center: [10, 20],
          zoom: 1.85,
          pitch: 0,
          bearing: 0
        });
      } catch (e) {}
    };

    if (window.map) {
      setupInitialView(window.map);
    } else {
      const initCheck = setInterval(() => {
        if (window.map) {
          clearInterval(initCheck);
          setupInitialView(window.map);
        }
      }, 50);
      setTimeout(() => clearInterval(initCheck), 3000);
    }

    // Stage 1: Text Pulse -> Start Split at 750ms
    const tSplit = setTimeout(() => {
      setStage('splitting');
      setHudInfo({
        status: 'ATMOSPHERIC VORTEX ACQUIRED',
        sector: 'GLOBAL CONVECTIVE BELT',
        coords: '15.00° N, 45.00° E'
      });
    }, 750);

    // Stage 2: Camera FlyTo spin towards India starting at 950ms
    const tSpin = setTimeout(() => {
      setStage('spinning');

      const performFlight = () => {
        if (hasTriggeredMapFlight.current || !window.map) return;
        hasTriggeredMapFlight.current = true;
        try {
          window.__burstwatch_apply3D?.(false, false);
          window.map.easeTo({
            center: [78.96, 23.50],
            zoom: 4.85,
            pitch: 0,
            bearing: 0,
            duration: 2600,
            easing: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
            essential: true
          });
        } catch (e) {
          console.warn("Map camera flight error:", e);
        }
      };

      if (window.map) {
        performFlight();
      } else {
        const flightInterval = setInterval(() => {
          if (window.map) {
            clearInterval(flightInterval);
            performFlight();
          }
        }, 80);
        setTimeout(() => clearInterval(flightInterval), 3000);
      }

      setHudInfo({
        status: 'ORBITAL LOCK: SOUTH ASIAN MONSOON BASIN',
        sector: 'INDIAN SUBCONTINENT / HIMALAYAN ARC',
        coords: '23.50° N, 78.96° E'
      });
    }, 950);

    // Stage 3: Lock on India at 3100ms
    const tLock = setTimeout(() => {
      setStage('locked');
      setHudInfo({
        status: 'CONVECTIVE SURGE MONITORING ACTIVE',
        sector: 'UTTARAKHAND & HIMACHAL RADAR MESH',
        coords: '30.31° N, 78.03° E'
      });
    }, 3100);

    // Stage 4: Fade out intro overlay at 3700ms
    const tFade = setTimeout(() => {
      setStage('fading');
    }, 3700);

    // Stage 5: Finish & Hand-off at 4100ms
    const tDone = setTimeout(() => {
      setStage('done');
      if (window.map) {
        try {
          window.__burstwatch_apply3D?.(false, false);
          window.map.easeTo({
            center: [78.96, 23.50],
            zoom: 4.85,
            pitch: 0,
            bearing: 0,
            duration: 400
          });
        } catch (e) {}
      }
      if (onComplete) onComplete();
    }, 4100);

    return () => {
      clearTimeout(tSplit);
      clearTimeout(tSpin);
      clearTimeout(tLock);
      clearTimeout(tFade);
      clearTimeout(tDone);
    };
  }, [onComplete]);

  // Handle immediate Skip button click
  const handleSkip = () => {
    if (window.map) {
      try {
        window.__burstwatch_apply3D?.(false, false);
        window.map.easeTo({
          center: [78.96, 23.50],
          zoom: 4.85,
          pitch: 0,
          bearing: 0,
          duration: 600
        });
      } catch (e) {}
    }
    setStage('done');
    if (onComplete) onComplete();
  };

  if (stage === 'done') return null;

  const isSplittingOrLater = stage !== 'intro';
  const isSpinningOrLater = stage === 'spinning' || stage === 'locked' || stage === 'fading';
  const isLocked = stage === 'locked';

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden pointer-events-auto select-none transition-opacity duration-500 ease-out"
      style={{
        opacity: stage === 'fading' ? 0 : 1,
        background: isSpinningOrLater 
          ? 'radial-gradient(circle at center, transparent 38%, rgba(4, 7, 20, 0.70) 80%, #030611 100%)' 
          : '#040714'
      }}
    >
      {/* 1. Deep Space Cosmic Ambient Glow (Zero CPU/GPU filter overhead) */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{ 
          opacity: isSpinningOrLater ? 0.25 : 0.85,
          background: 'radial-gradient(circle at 25% 30%, rgba(6, 182, 212, 0.12) 0%, transparent 55%), radial-gradient(circle at 75% 70%, rgba(240, 85, 66, 0.12) 0%, transparent 55%)'
        }} 
      />

      {/* 2. Top-Right Skip Button */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={handleSkip}
          className="apple-liquid-glass px-4 py-2 rounded-full text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 border border-white/20 shadow-2xl active:scale-95"
        >
          <span>Skip Intro</span>
          <span className="text-cyan-400 font-bold">&rarr;</span>
        </button>
      </div>

      {/* 3. 120 FPS Hardware-Accelerated Typography Split */}
      <div className="relative z-30 flex items-center justify-center w-full max-w-5xl px-4 pointer-events-none">
        {/* Left Side: "BURST" */}
        <div
          style={{
            transform: isSplittingOrLater ? 'translate3d(-100vw, 0, 0) scale(0.90)' : 'translate3d(0, 0, 0) scale(1)',
            opacity: isSplittingOrLater ? 0 : 1,
            transition: 'transform 1.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.85s cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transformStyle: 'preserve-3d'
          }}
          className="burstwatch-logo-orbitron text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-right pr-2 text-transparent bg-clip-text bg-gradient-to-r from-[#ff4730] via-[#f05542] to-[#ff7b69] select-none"
        >
          BURST
        </div>

        {/* Center Flash Beam */}
        {stage === 'splitting' && (
          <div className="absolute w-[2px] h-40 bg-gradient-to-b from-transparent via-white to-transparent shadow-[0_0_15px_#fff] animate-pulse" />
        )}

        {/* Right Side: "WATCH" */}
        <div
          style={{
            transform: isSplittingOrLater ? 'translate3d(100vw, 0, 0) scale(0.90)' : 'translate3d(0, 0, 0) scale(1)',
            opacity: isSplittingOrLater ? 0 : 1,
            transition: 'transform 1.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.85s cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transformStyle: 'preserve-3d'
          }}
          className="burstwatch-logo-orbitron text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-left pl-2 text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-300 to-cyan-400 select-none"
        >
          WATCH
        </div>
      </div>

      {/* 4. Subtitle: Extinguished on split */}
      <div
        style={{
          opacity: isSplittingOrLater ? 0 : 0.85,
          transform: isSplittingOrLater ? 'translate3d(0, 15px, 0)' : 'translate3d(0, 0, 0)',
          transition: 'all 0.4s ease-out'
        }}
        className="mt-6 flex items-center gap-3 text-xs md:text-sm font-mono tracking-[0.25em] text-slate-300 uppercase pointer-events-none"
      >
        <span className="w-8 h-[1px] bg-gradient-to-r from-transparent to-red-400" />
        <span>Convective Hazard & Extreme Weather System</span>
        <span className="w-8 h-[1px] bg-gradient-to-l from-transparent to-cyan-400" />
      </div>

      {/* 5. Center Holographic India Target Reticle (Appears when camera locks to India) */}
      <AnimatePresence>
        {isSpinningOrLater && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ 
              opacity: stage === 'fading' ? 0 : 1, 
              scale: isLocked ? 1 : 1.15
            }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="absolute z-40 flex flex-col items-center justify-center pointer-events-none"
          >
            {/* Pulsing Convective Target Rings */}
            <div className="relative flex items-center justify-center w-52 h-52 md:w-64 md:h-64">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border border-cyan-400/30 border-dashed"
              />
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                className="absolute inset-4 rounded-full border border-white/20"
              />
              <motion.div 
                animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-8 rounded-full border-2 border-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,0.4)]"
              />

              {/* Center Crosshairs */}
              <div className="w-4 h-4 rounded-full bg-cyan-400/90 shadow-[0_0_15px_#22d3ee] flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
            </div>

            {/* Futuristic Telemetry Status Banner */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 apple-liquid-glass px-5 py-2 rounded-2xl flex flex-col items-center gap-1 border border-cyan-400/40 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                </span>
                <span className="text-[11px] font-mono font-bold tracking-wider text-cyan-300">
                  {hudInfo.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-300 pt-0.5 border-t border-white/10">
                <span className="text-white font-semibold">{hudInfo.sector}</span>
                <span className="text-cyan-400">{hudInfo.coords}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. Bottom Ambient Grid Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 text-[10px] font-mono text-slate-400 select-none pointer-events-none">
        <span className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-cyan-400" />
          <span>120 FPS FLUIDITY ENGINE</span>
        </span>
        <span className="w-1 h-1 rounded-full bg-slate-600" />
        <span>3D CONVECTIVE MESH</span>
        <span className="w-1 h-1 rounded-full bg-slate-600" />
      </div>
    </div>
  );
}
