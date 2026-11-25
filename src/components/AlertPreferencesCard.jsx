import { MapPin, CloudRain } from 'lucide-react';

const MONITORING_REGIONS = [
  { value: 'ALL', label: 'Pan-India Network', sub: 'All 419+ Stations' },
  { value: 'Himalayan Belt', label: 'Himalayan Belt', sub: 'Kedarnath & Garhwal' },
  { value: 'Western Ghats', label: 'Western Ghats', sub: 'Konkan & Sahyadri' },
  { value: 'Northeast Corridors', label: 'Northeast', sub: 'Meghalaya & Assam' },
  { value: 'Coastal Zones', label: 'Coastal Zones', sub: 'East & West Coasts' },
  { value: 'Central & Peninsular', label: 'Central & Deccan', sub: 'Storm Basins' },
];

function getThresholdTier(mm) {
  if (mm <= 35) return { badge: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30', tag: 'Moderate' };
  if (mm < 75) return { badge: 'text-cyan-300 bg-cyan-500/15 border-cyan-400/30', tag: 'Heavy' };
  if (mm < 120) return { badge: 'text-amber-300 bg-amber-500/15 border-amber-400/30', tag: 'Cloudburst' };
  return { badge: 'text-rose-300 bg-rose-500/15 border-rose-400/30', tag: 'Extreme' };
}

/**
 * Shared GlassAura™ Alert Preferences selector for Concerned Region + Rainfall Threshold (mm/day).
 * Used before Google/Email sign-in as well as when editing active subscriber preferences.
 */
export default function AlertPreferencesCard({
  region = 'ALL',
  onRegionChange,
  thresholdMm = 50,
  onThresholdChange,
  compact = false,
}) {
  const tier = getThresholdTier(thresholdMm);

  return (
    <div className={`rounded-2xl bg-white/[0.06] border border-white/15 backdrop-blur-xl flex flex-col ${compact ? 'p-3 gap-3' : 'p-4 gap-3.5'}`}>
      {/* Concerned Region */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          <span>Concerned Region</span>
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {MONITORING_REGIONS.map((opt) => {
            const active = region === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onRegionChange?.(opt.value)}
                className={`px-2.5 py-1.5 rounded-full text-center transition-all cursor-pointer border text-[11px] font-medium truncate ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.18)]'
                    : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
                title={`${opt.label} (${opt.sub})`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rainfall Alert Threshold (mm/day) */}
      <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
            <span>Rainfall Trigger</span>
          </label>
          <span className={`px-2 sm:px-2.5 py-0.5 rounded-full border text-[10px] sm:text-[11px] font-mono font-semibold tabular-nums whitespace-nowrap shrink-0 ${tier.badge}`}>
            &ge; {thresholdMm} mm/day {tier.tag}
          </span>
        </div>

        <input
          type="range"
          min="15"
          max="200"
          step="5"
          value={thresholdMm}
          onChange={(e) => onThresholdChange?.(Number(e.target.value))}
          aria-label="Minimum rainfall threshold in millimeters per day"
          className="w-full accent-cyan-400 cursor-pointer h-1.5"
        />
        <div className="flex justify-between text-[9px] font-mono tabular-nums text-slate-400">
          <span>15 mm</span>
          <span>50 mm</span>
          <span>100 mm</span>
          <span>200 mm</span>
        </div>
      </div>
    </div>
  );
}
