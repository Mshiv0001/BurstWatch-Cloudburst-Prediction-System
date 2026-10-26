# Cloudburst Map — Master Execution Checklist

> **AI Workflow Rule**: Update this file by marking checkboxes `[x]` as tasks are completed. If paused, inspect this file and resume from the first unchecked item. Do not use browser testing or image tools; focus purely on code correctness, run `npm run build` to verify, and prompt the user after each step to confirm proceeding.

---

## Phase 1: Weather & Cloudburst Layers

- [x] **1. Rain Radar (`precip`) Layer**
  - Strictly 100% live Doppler radar raster tiles (`api.rainviewer.com` / `tilecache.rainviewer.com`) over clean OpenFreeMap Positron basemap.
  - Automatic 10-minute background polling cycle fetching real-time ground station radar frames.
  - Ventusky rain radar precipitation rate color stops in **`mm/h`** (`0` to `100+ mm/h`) with vertical `Lightning (Blitzortung)` title.
  - Real-time cursor probe and floating indicator calibrated to `mm/h`, dynamic observation time pill, and hardware overzooming (`maxzoom: 7`).


- [x] **2. Convective Cloudburst Risk & Event Monitoring Layer**
  - Mission Control Cloudburst Event HUD Card (`CloudburstEventCard.jsx`) with Level-4 Critical Alert telemetry.
  - Meteorological definition thresholding ($>100\text{ mm/h}$ rain rate, lead time window, CAPE instability, pressure drop, ML ensemble confidence).
  - High-impact animated epicenter shockwave beacon marker with targeting reticle on map.
  - Interactive 14–18 km evacuation hazard radius GeoJSON boundary polygon with crimson fill and glowing dashed perimeter.
  - Scenario switcher (Kedarnath Basin vs Dharamshala Gorge) and clean contract/interface for the backend and ML model engineer in `cloudburstEventModel.js`.

- [ ] **3. Live Satellite Cloud Cover (`clouds`) Layer**
  - Add free global satellite cloud raster tile source (`/clouds/tiles/...`).
  - Configure hardware blending (`opacity: 0.70`) under place labels with toggle support.

- [ ] **4. Temperature (`tmp2m`) Layer & Color Bar**
  - Verified and calibrated with authentic meteorological palette (`-40°C` to `50°C`).
  - Keep synchronized with live telemetry cursor probe.

- [ ] **5. Wind Streamline Particles**
  - Verified 120 FPS fluid engine with 5-mode dropdown (`Off`, `Normal`, `Strong`, `Dark`, `Fast-motion`).
  - Instant cleanup and canvas clear when toggled off.

- [ ] **6. Live Lightning Strikes Layer**
  - Add real-time electrical thunderstorm discharge flashes / convective cores.
  - Render flashing markers / pulse circles on active storm cells.

- [ ] **7. Precipitable Water (TPW / Atmospheric Moisture) Layer**
  - Integrate total precipitable water column data overlay indicating flood potential before downpours.

- [ ] **8. 3D Mountain Elevation / Slope Contours**
  - Enable MapLibre native 3D terrain elevation using Terrain-RGB DEM tiles (`map.setTerrain`).
  - Extrude Himalayan ridges and valleys in true 3D space with custom exaggeration.

- [ ] **9. Air Quality Index (AQI) Layer**
  - Add live particulate matter / AQI raster tile or station overlay (PM2.5 / PM10 / US-AQI scale).

---

## Phase 2: UI Consolidation & Layout Geometry

- [ ] **10. Remove Duplicate & Unnecessary Buttons**
  - Audit all header, NavRail, bottom floating bars, and map controls.
  - Remove redundant duplicate toggle buttons across conflicting bars.

- [ ] **11. Layer Selector & Menu UI Redesign**
  - Streamline weather layer switching into a clean, unified floating dock/pill.
  - Ensure clean active states and single source of truth.

- [ ] **12. Zero-Collision Layout Architecture (No Overlapping Tabs/Cards)**
  - Implement dynamic anchor geometry so drawer panels, bottom floating bars, particle dropdowns, and the legend bar never collide or overlap at any viewport width.

- [ ] **13. Preserve Intro Animation Integrity**
  - Guarantee that intro splash animations and initial transitions remain completely intact and smooth.
