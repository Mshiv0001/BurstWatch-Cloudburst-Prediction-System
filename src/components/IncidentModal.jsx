import React, { useState } from 'react';
import { 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  Radio, 
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function IncidentModal({
  isOpen,
  onClose,
  riskPercent = 92,
  severity = "SEVERE THREAT",
  onPlaySiren
}) {
  const [isDispatched, setIsDispatched] = useState(false);
  const [isBroadcasted, setIsBroadcasted] = useState(false);

  if (!isOpen) return null;

  const handleDispatch = () => {
    setIsDispatched(true);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#f43f5e', '#fbbf24', '#38bdf8']
    });
    if (onPlaySiren) onPlaySiren();
  };

  const handleBroadcast = () => {
    setIsBroadcasted(true);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl select-none">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="apple-liquid-glass-crimson w-full max-w-lg rounded-3xl p-6 relative flex flex-col gap-4 text-white overflow-hidden shadow-2xl"
        >
          {/* Modal Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="apple-liquid-glass-pill p-2.5 rounded-2xl text-rose-300">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-rose-300">
                  National Disaster Management Protocol
                </span>
                <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                  Emergency Evacuation Dispatch
                </h2>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="apple-liquid-glass-pill p-1.5 rounded-full text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Incident Telemetry Summary */}
          <div className="grid grid-cols-3 gap-2 py-1 text-center font-sans">
            <div className="apple-liquid-glass-well p-3 rounded-2xl">
              <span className="text-[10px] text-slate-300 uppercase tracking-wide">Threat Score</span>
              <div className="text-rose-300 font-bold text-lg font-mono tabular-nums">{riskPercent}%</div>
            </div>
            <div className="apple-liquid-glass-well p-3 rounded-2xl">
              <span className="text-[10px] text-slate-300 uppercase tracking-wide">Lead Window</span>
              <div className="text-amber-300 font-bold text-lg font-mono tabular-nums">28 Mins</div>
            </div>
            <div className="apple-liquid-glass-well p-3 rounded-2xl">
              <span className="text-[10px] text-slate-300 uppercase tracking-wide">Catchment Pop.</span>
              <div className="text-cyan-300 font-bold text-lg font-mono tabular-nums">12,400</div>
            </div>
          </div>

          {/* Action List */}
          <div className="flex flex-col gap-2.5">
            {/* Step 1: Dispatch NDRF */}
            <div className="apple-liquid-glass-well flex items-center justify-between p-3.5 rounded-2xl transition-all">
              <div className="flex items-center gap-3">
                <div className={`apple-liquid-glass-pill p-2 rounded-xl ${isDispatched ? 'text-emerald-300' : 'text-[#f05542]'}`}>
                  <CheckCircle2 className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">NDRF 8th Battalion (Uttarakhand)</h4>
                  <p className="text-[11px] text-slate-400">Deploy 4 high-altitude rapid response teams</p>
                </div>
              </div>

              <button
                onClick={handleDispatch}
                disabled={isDispatched}
                className={`apple-liquid-glass-pill px-4 py-1.5 rounded-full text-xs font-medium tracking-normal transition-all cursor-pointer ${
                  isDispatched 
                    ? 'apple-liquid-glass-emerald text-emerald-200' 
                    : 'apple-liquid-glass-crimson text-white shadow-lg'
                }`}
              >
                {isDispatched ? 'Dispatched' : 'Dispatch Platoon'}
              </button>
            </div>

            {/* Step 2: Wireless CAP Emergency Geofence */}
            <div className="apple-liquid-glass-well flex items-center justify-between p-3.5 rounded-2xl transition-all">
              <div className="flex items-center gap-3">
                <div className={`apple-liquid-glass-pill p-2 rounded-xl ${isBroadcasted ? 'text-emerald-300' : 'text-amber-300'}`}>
                  <Radio className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">CAP Geofence Wireless Alert</h4>
                  <p className="text-[11px] text-slate-400">Broadcast sirens and SMS to 12,400 active SIMs</p>
                </div>
              </div>

              <button
                onClick={handleBroadcast}
                disabled={isBroadcasted}
                className={`apple-liquid-glass-pill px-4 py-1.5 rounded-full text-xs font-medium tracking-normal transition-all cursor-pointer ${
                  isBroadcasted 
                    ? 'apple-liquid-glass-emerald text-emerald-200' 
                    : 'apple-liquid-glass-amber text-amber-200 shadow-lg'
                }`}
              >
                {isBroadcasted ? 'Broadcasted' : 'Transmit Alert'}
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-slate-400">
            <span className="text-[11px] text-slate-400">
              Protocol Reference: NDMA-SOP-74-B
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
