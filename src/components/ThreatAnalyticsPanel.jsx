import React, { useState } from 'react';
import { 
  MoreHorizontal, 
  Zap,
  Info,
  X,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { RAINFALL_CURVE_DATA, MODEL_METADATA } from '../data/cloudburstData';
import { isIndiaSector } from '../utils/geoUtils';

export default function ThreatAnalyticsPanel({
  riskPercent = 92,
  severity = "SEVERE THREAT",
  features = [],
  currentTimeStr = "14:00",
  station = null,
  onSelectIndiaHotspot,
  onOpenIncidentModal,
  onClose
}) {
  const isIndia = station ? isIndiaSector(station.lon ?? station.lng, station.lat) : true;
  // SVG Gauge calculations (radius = 52)
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (arcLength * Math.min(100, isIndia ? riskPercent : 28)) / 100;

  // SVG Chart Dimensions for Rainfall
  const svgWidth = 270;
  const svgHeight = 85;
  const paddingX = 12;
  const paddingY = 10;
  const innerWidth = svgWidth - paddingX * 2;
  const innerHeight = svgHeight - paddingY * 2;

  // Build points for Actual and Predicted rainfall lines
  const maxRain = 110;
  const pointsActual = RAINFALL_CURVE_DATA.map((d, i) => {
    const x = paddingX + (i / (RAINFALL_CURVE_DATA.length - 1)) * innerWidth;
    const y = svgHeight - paddingY - (d.actual / maxRain) * innerHeight;
    return `${x},${y}`;
  }).join(' ');

  const pointsPredicted = RAINFALL_CURVE_DATA.map((d, i) => {
    const x = paddingX + (i / (RAINFALL_CURVE_DATA.length - 1)) * innerWidth;
    const y = svgHeight - paddingY - (d.predicted / maxRain) * innerHeight;
    return `${x},${y}`;
  }).join(' ');

  const areaPredicted = `${paddingX},${svgHeight - paddingY} ` + pointsPredicted + ` ${svgWidth - paddingX},${svgHeight - paddingY}`;

  const activePointIndex = RAINFALL_CURVE_DATA.findIndex(d => d.time === currentTimeStr);
  const activeX = activePointIndex !== -1 
    ? paddingX + (activePointIndex / (RAINFALL_CURVE_DATA.length - 1)) * innerWidth 
    : paddingX + (6 / (RAINFALL_CURVE_DATA.length - 1)) * innerWidth;

  const isPositiveClassification = isIndia && (riskPercent / 100) >= MODEL_METADATA.threshold;

  return (
    <motion.aside 
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-72 sm:w-80 flex flex-col gap-2.5 select-none z-20 text-slate-100"
    >


      {/* ===================================================================
          CARD 1: RISK PROBABILITY & MODEL THRESHOLD GAUGE
          =================================================================== */}
      <div className="apple-liquid-glass-crimson rounded-3xl p-4 relative overflow-hidden flex flex-col items-center shadow-2xl">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="text-xs font-semibold text-rose-200 tracking-tight flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f05542] animate-pulse shadow-[0_0_8px_#f05542]" />
            {isIndia ? 'Logistic Model Probability' : 'Global Convective Monitor'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="apple-liquid-glass-pill text-[9px] font-mono text-amber-300 px-2 py-0.5 rounded-full">
              {isIndia ? `\u03C4 = ${MODEL_METADATA.threshold}` : 'Global Scope'}
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="apple-liquid-glass-pill text-slate-300 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
                title="Hide Panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Circular Gauge */}
        <div className="relative w-36 h-28 flex items-center justify-center my-1">
          <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#ea580c" />
                <stop offset="100%" stopColor="#f05542" />
              </linearGradient>
            </defs>

            {/* Background Track */}
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="8"
              strokeDasharray={arcLength}
              strokeLinecap="round"
              className="rotate-[135deg] origin-center"
            />

            {/* Animated Gauge Progress Arc */}
            <motion.circle
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke="url(#gaugeGradient)"
              strokeWidth="9"
              strokeDasharray={arcLength}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="rotate-[135deg] origin-center"
              initial={{ strokeDashoffset: arcLength }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </svg>

          {/* Centered Percentage Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tighter text-white font-mono tabular-nums">
              {riskPercent}%
            </span>
            <span className="text-[9px] uppercase tracking-wider text-slate-300 font-semibold -mt-0.5">
              {(riskPercent / 100).toFixed(3)} P(Y=1)
            </span>
          </div>
        </div>

        {/* Binary Model Classification Badge */}
        <div className="w-full flex items-center justify-between pt-1.5 border-t border-white/10 text-[10px]">
          <span className="text-slate-300 font-medium">Model Output:</span>
          {isPositiveClassification ? (
            <span className="apple-liquid-glass-pill px-2.5 py-0.5 rounded-full text-rose-200 font-semibold flex items-center gap-1 border-rose-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
              Positive (&ge;50mm/day)
            </span>
          ) : (
            <span className="apple-liquid-glass-pill px-2.5 py-0.5 rounded-full text-emerald-300 font-semibold border-emerald-500/30">
              Below Threshold
            </span>
          )}
        </div>
      </div>

      {/* ===================================================================
          CARD 2: RAINFALL CURVE
          =================================================================== */}
      <div className="apple-liquid-glass rounded-3xl p-4 relative overflow-hidden flex flex-col gap-2 shadow-2xl">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="text-xs font-semibold text-slate-200 tracking-tight">
            Rainfall Intensity (mm/h)
          </span>
          <div className="flex items-center gap-2 text-[9px]">
            <span className="flex items-center gap-1 text-amber-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Actual
            </span>
            <span className="flex items-center gap-1 text-[#f05542] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f05542]" /> Predicted
            </span>
          </div>
        </div>

        <div className="apple-liquid-glass-well relative w-full h-[88px] rounded-2xl overflow-hidden">
          <svg className="w-full h-full" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
            <polygon points={areaPredicted} fill="rgba(240, 85, 66, 0.22)" />
            <polyline fill="none" stroke="#f59e0b" strokeWidth="1.8" points={pointsActual} />
            <polyline fill="none" stroke="#f05542" strokeWidth="2.2" points={pointsPredicted} />
            <line
              x1={activeX}
              y1={paddingY}
              x2={activeX}
              y2={svgHeight - paddingY}
              stroke="#f05542"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            <circle
              cx={activeX}
              cy={svgHeight - paddingY - (98 / maxRain) * innerHeight}
              r="3.5"
              fill="#f05542"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </svg>

          <div className="absolute top-1 left-2 text-[9px] font-mono tabular-nums text-slate-200 apple-liquid-glass-pill px-1.5 py-0.2 rounded-full">
            Peak: <span className="text-[#f05542] font-semibold">102 mm/h</span>
          </div>

          <div className="absolute bottom-0.5 inset-x-2 flex justify-between text-[8px] font-mono tabular-nums text-slate-400">
            <span>09:00</span>
            <span className="text-amber-300 font-medium">14:00 Surge</span>
            <span>21:00</span>
            <span>11:00</span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          CARD 3: AVAILABLE MODEL FEATURE ATTRIBUTION
          =================================================================== */}
      <div className="apple-liquid-glass rounded-3xl p-4 relative overflow-hidden flex flex-col gap-2 shadow-2xl">
        <div className="flex items-center justify-between pb-1 border-b border-white/10">
          <span className="text-xs font-semibold text-slate-200 tracking-tight">
            Feature Attribution (Model Features)
          </span>
          <span className="text-[9px] font-mono text-slate-400">
            Shapley Impact
          </span>
        </div>

        {/* Feature Bars using ONLY model features */}
        <div className="apple-liquid-glass-well p-3 rounded-2xl flex flex-col gap-2">
          {features.map((feat, idx) => (
            <div key={idx} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-200 font-medium truncate max-w-[170px]" title={feat.label}>
                  {feat.friendlyName || feat.name}
                </span>
                <span className="text-slate-100 font-mono tabular-nums font-semibold">{feat.value}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-900/90 border border-white/10 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${feat.value}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className={`h-full rounded-full bg-gradient-to-r ${feat.color}`}
                />
              </div>
            </div>
          ))}

          {/* X-Axis Percentage Ticks */}
          <div className="flex justify-between text-[8px] font-mono tabular-nums text-slate-400 pt-1 border-t border-white/10 px-0.5">
            <span>0%</span>
            <span>20%</span>
            <span>40%</span>
            <span>60%</span>
          </div>
        </div>
      </div>


    </motion.aside>
  );
}
