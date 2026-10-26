import { useState } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Area,
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine
} from 'recharts';
import { 
  ChevronUp, 
  ChevronDown, 
  TrendingDown, 
  Activity
} from 'lucide-react';

export default function TrendDrawer({
  station,
  liveData,
  isOpen,
  onToggleOpen
}) {
  const [activeMetrics, setActiveMetrics] = useState({
    pressure: true,
    rainRate: true,
    cape: true,
    temp: false,
    humidity: false
  });

  const toggleMetric = (key) => {
    setActiveMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const chartData = (liveData?.hourlySeries && liveData.hourlySeries.length > 0)
    ? liveData.hourlySeries
    : (station?.timeSeries || []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 pointer-events-auto ${
        isOpen ? 'h-80 sm:h-96' : 'h-10'
      } apple-liquid-glass rounded-t-3xl border-t border-white/25 shadow-[0_-25px_60px_rgba(0,0,0,0.85)] flex flex-col`}
    >
      {/* Drawer Top Pull Handle */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-28 h-3.5 rounded-t-xl apple-liquid-glass-pill flex items-center justify-center border-t border-x border-white/25 cursor-pointer pointer-events-auto" onClick={onToggleOpen}>
        <div className="w-10 h-1 rounded-full bg-slate-200/90" />
      </div>

      {/* Drawer Header matching screenshot */}
      <div 
        onClick={onToggleOpen}
        className="w-full h-10 px-4 sm:px-6 flex items-center justify-between border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors select-none"
      >
        <div className="flex items-center gap-2.5 text-left flex-1">
          <Activity className="w-4 h-4 text-cyan-400" />
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wide font-mono">
            <span className="text-white">SYNOPTIC METEOGRAM</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300 font-sans font-medium">{liveData?.stationName || station?.name || station?.stationName || "Himalayan Sector"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Chart View */}
      {isOpen && (
        <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden">
          {/* Metric Toggle Chips */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => toggleMetric('pressure')}
                className={`px-3.5 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
                  activeMetrics.pressure
                    ? 'apple-liquid-glass-crimson text-rose-200'
                    : 'apple-liquid-glass-pill text-slate-400 hover:text-white'
                }`}
              >
                Atm Pressure (hPa)
              </button>

              <button
                onClick={() => toggleMetric('rainRate')}
                className={`px-3.5 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
                  activeMetrics.rainRate
                    ? 'apple-liquid-glass-cyan text-cyan-200'
                    : 'apple-liquid-glass-pill text-slate-400 hover:text-white'
                }`}
              >
                Rain Rate (mm/h)
              </button>

              <button
                onClick={() => toggleMetric('cape')}
                className={`px-3.5 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
                  activeMetrics.cape
                    ? 'apple-liquid-glass-amber text-amber-200'
                    : 'apple-liquid-glass-pill text-slate-400 hover:text-white'
                }`}
              >
                CAPE Instability (J/kg)
              </button>

              <button
                onClick={() => toggleMetric('temp')}
                className={`px-3.5 py-1 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
                  activeMetrics.temp
                    ? 'apple-liquid-glass-emerald text-emerald-200'
                    : 'apple-liquid-glass-pill text-slate-400 hover:text-white'
                }`}
              >
                Temperature (°C)
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              <span>Severe Barometric Crash Signature Detected</span>
            </div>
          </div>

          {/* Recharts Multi-Axis Visualization */}
          <div className="flex-1 w-full min-h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                
                {activeMetrics.pressure && (
                  <YAxis
                    yAxisId="pressure"
                    orientation="left"
                    domain={['auto', 'auto']}
                    stroke="#f43f5e"
                    tick={{ fontSize: 10, fill: '#fda4af' }}
                  />
                )}

                {activeMetrics.rainRate && (
                  <YAxis
                    yAxisId="rain"
                    orientation="right"
                    domain={[0, 120]}
                    stroke="#06b6d4"
                    tick={{ fontSize: 10, fill: '#67e8f9' }}
                  />
                )}

                {activeMetrics.cape && (
                  <YAxis
                    yAxisId="cape"
                    orientation="right"
                    domain={[0, 3500]}
                    stroke="#f59e0b"
                    hide={true}
                  />
                )}

                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                  }}
                  itemStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }}
                />

                <ReferenceLine
                  x="16:00"
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: 'Critical Trigger', fill: '#ef4444', fontSize: 10 }}
                />

                {activeMetrics.rainRate && (
                  <Area
                    yAxisId="rain"
                    type="monotone"
                    dataKey="rainRate"
                    fill="#06b6d4"
                    stroke="#0891b2"
                    fillOpacity={0.25}
                    name="Rain Rate (mm/h)"
                  />
                )}

                {activeMetrics.pressure && (
                  <Line
                    yAxisId="pressure"
                    type="monotone"
                    dataKey="pressure"
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#f43f5e' }}
                    name="Pressure (hPa)"
                  />
                )}

                {activeMetrics.cape && (
                  <Line
                    yAxisId="cape"
                    type="monotone"
                    dataKey="cape"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="CAPE (J/kg)"
                  />
                )}

                {activeMetrics.temp && (
                  <Line
                    yAxisId="pressure"
                    type="monotone"
                    dataKey="temp"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="Temp (°C)"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}