# Project To-Do List

## 1. Live Global Wind Vector Grid (Ventusky-Style Engine)
- [ ] **Data Pipeline Setup**:
  - Connect to free public NOAA GFS / Open-Meteo global hourly forecast endpoint.
  - Fetch single compressed $(u, v)$ velocity tensor grid (~120 KB) on load and refresh hourly.
  - Zero API cost ($0.00) and zero key/credit card requirements.
- [ ] **In-Memory Tensor Cache**:
  - Decode and cache grid points in a typed `Float32Array` in client memory for 0ms lookup latency.
- [ ] **Bilinear Vector Sampling**:
  - Update particle advection loop in `CloudburstMap.jsx` to sample real $(u, v)$ vectors at particle `(lon, lat)` coordinates.
  - Maintain fluid 120 FPS performance with zero network calls per frame.
- [ ] **Dynamic Storm / Cyclone Rendering**:
  - Automatically display live tropical cyclones, jet streams, and atmospheric depressions anywhere on Earth at their exact real-world positions.
- [ ] **Fail-Safe Mathematical Fallback**:
  - Keep the existing mathematical hydrodynamic model as an instant fallback if network connectivity drops.

---

## 2. Continuous Gradient Temperature Bar
- [ ] **Smooth Isotherm Gradient**:
  - Transition the vertical legend from stepped rectangular blocks to a continuous `linear-gradient` bar mirroring map isotherms 1:1.
- [ ] **Opacity Calibration**:
  - Fine-tune stop colors against the 0.68 raster map layer opacity and base map background blending.
- [ ] **Milestone Markers & Ticks**:
  - Add sleek numerical milestone tick labels alongside the gradient bar for effortless value reading.

---

## 3. Real-Time Hover Cursor Marker on Legend
- [ ] **Interactive Legend Indicator**:
  - Add a small dynamic indicator pin on the color bar that moves up and down in real time to show where the hovered cursor temperature falls on the scale.
