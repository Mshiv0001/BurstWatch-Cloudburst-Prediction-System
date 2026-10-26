import React from 'react';
import { 
  SlidersHorizontal, 
  RotateCcw, 
  Droplets, 
  Gauge, 
  Thermometer, 
  Wind,
  Orbit,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function WhatIfSimulator({
  humidity,
  setHumidity,
  pressureDrop,
  setPressureDrop,
  temperature,
  setTemperature,
  windSpeed,
  setWindSpeed,
  tcwv = 52,
  setTcwv,
  onResetDefaults,
  onApplyPreset
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="apple-liquid-glass rounded-3xl p-4 w-72 sm:w-80 select-none text-slate-100 flex flex-col gap-3.5 relative shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="apple-liquid-glass-pill p-2 rounded-2xl text-[#f05542] shadow-sm">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-100 tracking-tight flex items-center gap-1.5">
              What-If Simulator
              <span className="apple-liquid-glass-pill text-[9px] font-mono text-amber-300 px-2 py-0.2 rounded-full">
                &tau;=0.875
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">Logistic Model Feature Stress-Test</p>
          </div>
        </div>

        <button
          onClick={onResetDefaults}
          title="Reset to Baseline"
          className="apple-liquid-glass-pill p-1.5 rounded-full text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Model Targets Note */}
      <div className="apple-liquid-glass-well px-3 py-2 rounded-2xl flex items-center justify-between text-[10px]">
        <span className="text-slate-300">Target: Next-day rain &ge;50mm</span>
        <span className="text-emerald-400 font-mono font-medium">Dehradun Grid</span>
      </div>

      {/* Interactive Model Feature Controls */}
      <div className="flex flex-col gap-3">
        {/* 1. relative_humidity_2m_max (%) -> Air Moisture (Humidity) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-medium text-slate-200 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
              <span>Air Moisture (Humidity)</span>
            </label>
            <span className="apple-liquid-glass-pill px-2.5 py-0.5 rounded-full text-sky-300 font-mono tabular-nums text-xs font-semibold">
              {humidity}%
            </span>
          </div>
          <input 
            type="range"
            min={40}
            max={100}
            value={humidity}
            onChange={(e) => setHumidity(Number(e.target.value))}
            className="cloudburst-slider"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums px-0.5">
            <span>40%</span>
            <span className="text-slate-400 font-normal">Peak Humidity • relative_humidity_2m_max</span>
            <span>100%</span>
          </div>
        </div>

        {/* 2. surface_pressure_min drop -> Air Pressure Drop */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-medium text-slate-200 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              <span>Air Pressure Drop</span>
            </label>
            <span className="apple-liquid-glass-pill px-2.5 py-0.5 rounded-full text-amber-300 font-mono tabular-nums text-xs font-semibold">
              {pressureDrop} hPa
            </span>
          </div>
          <input 
            type="range"
            min={5}
            max={50}
            value={pressureDrop}
            onChange={(e) => setPressureDrop(Number(e.target.value))}
            className="cloudburst-slider"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums px-0.5">
            <span>5 hPa</span>
            <span className="text-slate-400 font-normal">Barometric Fall • surface_pressure_min</span>
            <span>50 hPa</span>
          </div>
        </div>

        {/* 3. total_column_water_vapour -> Atmospheric Moisture */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-medium text-slate-200 flex items-center gap-1.5">
              <Orbit className="w-3.5 h-3.5 text-cyan-400" />
              <span>Atmospheric Moisture</span>
            </label>
            <span className="apple-liquid-glass-pill px-2.5 py-0.5 rounded-full text-cyan-300 font-mono tabular-nums text-xs font-semibold">
              {tcwv} kg/m²
            </span>
          </div>
          <input 
            type="range"
            min={15}
            max={75}
            value={tcwv}
            onChange={(e) => setTcwv && setTcwv(Number(e.target.value))}
            className="cloudburst-slider"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums px-0.5">
            <span>15 kg/m²</span>
            <span className="text-slate-400 font-normal">Cloud Water Vapor • total_column_water_vapour</span>
            <span>75 kg/m²</span>
          </div>
        </div>

        {/* 4. wind_gusts_10m_max -> Peak Wind Gusts */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-medium text-slate-200 flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-teal-400" />
              <span>Peak Wind Gusts</span>
            </label>
            <span className="apple-liquid-glass-pill px-2.5 py-0.5 rounded-full text-teal-300 font-mono tabular-nums text-xs font-semibold">
              {windSpeed} km/h
            </span>
          </div>
          <input 
            type="range"
            min={10}
            max={120}
            value={windSpeed}
            onChange={(e) => setWindSpeed(Number(e.target.value))}
            className="cloudburst-slider"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums px-0.5">
            <span>10 km/h</span>
            <span className="text-slate-400 font-normal">Max Wind Speed • wind_gusts_10m_max</span>
            <span>120 km/h</span>
          </div>
        </div>

        {/* 5. temperature_2m_max -> Peak Surface Temperature */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-medium text-slate-200 flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              <span>Peak Surface Temperature</span>
            </label>
            <span className="apple-liquid-glass-pill px-2.5 py-0.5 rounded-full text-rose-300 font-mono tabular-nums text-xs font-semibold">
              {temperature}°C
            </span>
          </div>
          <input 
            type="range"
            min={4}
            max={40}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="cloudburst-slider"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums px-0.5">
            <span>4°C</span>
            <span className="text-slate-400 font-normal">Max Air Temp • temperature_2m_max</span>
            <span>40°C</span>
          </div>
        </div>
      </div>

      {/* Preset Calibration Buttons */}
      <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5">
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          Historical Calibration Presets
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onApplyPreset('kedarnath')}
            className="apple-liquid-glass-pill py-1.5 px-2 rounded-full text-[11px] font-semibold text-slate-200 hover:text-white transition-all text-center cursor-pointer"
          >
            Kedarnath '13
          </button>
          <button
            onClick={() => onApplyPreset('squall')}
            className="apple-liquid-glass-pill py-1.5 px-2 rounded-full text-[11px] font-semibold text-slate-200 hover:text-white transition-all text-center cursor-pointer"
          >
            Himachal '23
          </button>
          <button
            onClick={() => onApplyPreset('mumbai')}
            className="apple-liquid-glass-pill py-1.5 px-2 rounded-full text-[11px] font-semibold text-amber-300 hover:text-white transition-all text-center cursor-pointer border border-amber-400/30"
          >
            Mumbai '05
          </button>
          <button
            onClick={() => onApplyPreset('wayanad')}
            className="apple-liquid-glass-pill py-1.5 px-2 rounded-full text-[11px] font-semibold text-rose-300 hover:text-white transition-all text-center cursor-pointer border border-rose-400/30"
          >
            Wayanad '24
          </button>
          <button
            onClick={() => onApplyPreset('barmer')}
            className="apple-liquid-glass-pill py-1.5 px-2 rounded-full text-[11px] font-semibold text-orange-300 hover:text-white transition-all text-center cursor-pointer border border-orange-400/30"
          >
            Barmer '06
          </button>
          <button
            onClick={() => onApplyPreset('clear')}
            className="apple-liquid-glass-pill py-1.5 px-2 rounded-full text-[11px] font-semibold text-emerald-300 hover:text-white transition-all text-center cursor-pointer border border-emerald-400/30"
          >
            Stable Air
          </button>
        </div>
      </div>
    </motion.div>
  );
}
