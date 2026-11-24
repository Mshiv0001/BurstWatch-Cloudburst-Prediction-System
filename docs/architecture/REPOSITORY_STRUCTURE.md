# Repository Architecture & File System Guide

> **BurstWatch Meteorological Intelligence Platform**  
> Comprehensive repository structure, workspace delineation, and domain engine map.

---

## 1. Top-Level Directory Layout

```text
major project/
├── backend/                  # FastAPI Python microservice & scheduler
├── ml_models/                # Machine learning models, pipelines, and notebooks (space-free)
├── deployment/               # Centralized deployment manifests (Docker, Render, Vercel, Netlify)
├── src/                      # React 19 + Vite frontend application
│   ├── engines/              # Cross-cutting visual, computational, and design engines
│   │   └── liquid-glass/     # GlassAura™ translucent UI engine (tokens, panels, pills, modals)
│   ├── layers/               # Meteorological spatial layers
│   │   ├── wind/             # AeroSilk™ wind simulation, vector grids & particle styles
│   │   ├── radar/            # PluviaVivid™ Doppler rain radar tiles & synthetic reflectivity
│   │   ├── aqi/              # AetherAura™ planetary AQI protocol, dispersion mesh & stations
│   │   ├── temperature/      # Thermodynamic temperature isotherms & color ramp
│   │   └── convective/       # Convective cloudburst risk modeling & station telemetry
│   ├── cache/                # Multi-tier sliding window caching engine (memory + localStorage)
│   ├── components/           # Core UI shell, navigation dock, and situational panels
│   ├── services/             # API client services & backward-compatibility shims
│   ├── data/                 # Common geo-catalogs & thermal grid seeds
│   ├── utils/                # Geometry, notifications & utility shims
│   ├── App.jsx               # Root application view
│   ├── main.jsx              # Application bootstrap
│   └── index.css             # Tailwind v4 theme & global typography
├── docs/                     # Technical specifications & architecture manuals
├── scripts/                  # Development & verification automation scripts
├── package.json              # Monorepo orchestration scripts
├── vite.config.js            # Vite configuration with domain path aliases
├── render.yaml               # Root entry point for Render cloud builds
├── vercel.json               # Root entry point for Vercel deployment
└── netlify.toml              # Root entry point for Netlify deployment
```

---

## 2. Domain Engines & Spatial Layers

### A. Liquid Glass Engine (`@glass` / `src/engines/liquid-glass/`)
- **`tokens.js`**: Standardizes optical fill (58%–64%), live backdrop blur (`blur(28px)`), specular rim highlight, and the 4-tier semantic color palette (Electric Cyan, Emerald Jade, Solar Amber, Crimson Rose).
- **`GlassPanel.jsx`**: Universal glass card with built-in rim highlight and live blur.
- **`GlassModal.jsx`**: Accessible modal container with backdrop veil.
- **`GlassPill.jsx`**: Pill-shaped button, search input, chip, and toggle switch wrapper.
- **`glassAura.css`**: GPU-accelerated specular gradients and reflection utilities.

### B. AeroSilk™ Wind Layer (`@wind` / `src/layers/wind/`)
- **`aeroSilkService.js`**: Ingests real-time atmospheric wind vector fields across pressure levels (`surface`, `850hpa`, `250hpa`).
- **`windParticleStyles.js`**: 4 curated meteorological presets:
  - `silk`: Ventusky Pure Silk (default synoptic flow)
  - `thermal`: Thermal Advection (temperature-graded air masses)
  - `grand`: Vivid Ribbons (storm vorticity & jetstreams)
  - `off`: Off (zero GPU load)
- **`WindParticleDropdown.jsx`**: Compact liquid glass pill dropdown for instantaneous style switching.
- **`isotachGeoJson.js`**: Marching Squares contouring generating vector isotach horizons.

### C. Doppler Rain Radar Layer (`@radar` / `src/layers/radar/`)
- **`weatherTiles.js`**: Dynamic RainViewer timestamp fetcher and GPU tile renderer with fine-art palettes.
- **`radarEchoesData.js`**: Marshall-Palmer synthetic reflectivity echo field, 450 km DWR range rings, and IMD station coordinates.

### D. AetherAura™ Air Quality Layer (`@aqi` / `src/layers/aqi/`)
- **`aqiTiles.js`**: Custom `thermo-aqi://` MapLibre protocol with GPU bilinear upscaling (48x48 to 256x256).
- **`aqiMeshGeoJson.js`**: Continuous Oklab atmospheric dispersion grid.
- **`globalAqiCities.js`**: 623 planetary meteorological monitoring stations across 7 continents.
- **`AqiLegendBar.jsx`**: Horizontal gradient legend bar with CPCB/EPA category thresholds.

### E. Thermodynamic Temperature Layer (`@temperature` / `src/layers/temperature/`)
- **`temperatureUtils.js`**: Isotherm GeoJSON generator & perceptual Oklab thermal gradient.
- **`TemperatureLegendBar.jsx`**: Centered gradient legend bar with unit conversions (°C / °F).

### F. Convective Cloudburst Risk Layer (`@convective` / `src/layers/convective/`)
- **`cloudburstEventModel.js`**: Convective risk assessment and atmospheric simulation pipeline.
- **`cloudburstData.js`**: Pan-India station network (419 locations) and threat calculation algorithms.

---

## 3. Path Aliases Reference

Configured in `vite.config.js`:

```javascript
import { GlassPanel, GlassPill } from '@glass';
import { WindParticleDropdown, getWindParticleStyle } from '@wind';
import { RADAR_ART_PALETTES } from '@radar';
import { AqiLegendBar, getCachedAQI } from '@aqi';
import { TemperatureLegendBar } from '@temperature';
import { calculateCloudburstThreat } from '@convective';
import { cacheManager } from '@cache';
```

---

## 4. Developer & Orchestration Commands

Run from repository root:
- `npm run dev`: Launch Vite frontend dev server (port 5173).
- `npm run build`: Production bundle compilation.
- `npm run preview`: Preview production build locally.
- `npm run dev:backend`: Launch FastAPI backend with uvicorn auto-reload (port 8001).
- `npm run test:backend`: Run pytest suite for backend microservice.
- `npm run test:ml`: Run pytest audit suite for machine learning pipeline.
- `npm run deploy:check`: Verify deployment manifest integrity across platforms.
