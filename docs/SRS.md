Software Requirements Specification
for
Cloudburst Prediction System (BurstWatch)
Version 2.0 approved
Prepared by Cloudburst Prediction System Team (4 members)
Major Project
Group ID: G-12

Table of Contents
Table of Contents	ii
Revision History	ii
1.	Introduction	1
1.1	Purpose	1
1.2	Document Conventions	1
1.3	Intended Audience and Reading Suggestions	1
1.4	Product Scope	1
1.5	References	2
2.	Overall Description	2
2.1	Product Perspective	2
2.2	Product Functions	3
2.3	User Classes and Characteristics	3
2.4	Operating Environment	3
2.5	Design and Implementation Constraints	4
2.6	User Documentation	4
2.7	Assumptions and Dependencies	4
3.	External Interface Requirements	5
3.1	User Interfaces	5
3.2	Hardware Interfaces	5
3.3	Software Interfaces	6
3.4	Communications Interfaces	6
4.	System Features	6
4.1	System Access and Administrative Authorization	6
4.2	Environmental and Terrain Data Collection	7
4.3	Data Preprocessing and Feature Engineering	7
4.4	Dual-Engine Cloudburst Machine Learning Prediction	8
4.5	Risk Classification and Alert Management	8
4.6	Prediction History and Model Evaluation	9
4.7	Interactive GIS Dashboard	9
5.	Other Nonfunctional Requirements	10
5.1	Performance Requirements	10
5.2	Safety Requirements	10
5.3	Security Requirements	10
5.4	Software Quality Attributes	11
5.5	Business Rules	11
6.	Other Requirements	11
6.1	Database Requirements	11
6.2	Data Integrity and Caching Requirements	12
6.3	Future Extensibility	12
Appendix A: Glossary	12
Appendix B: Analysis Models	13
Appendix C: To Be Determined List	15

Revision History
| Name | Date | Reason For Changes | Version |
|---|---|---|---|
| Cloudburst Prediction System Team | 2026-10-15 | Initial baseline SRS draft with generic specifications. | 1.0 |
| Cloudburst Prediction System Team | 2026-11-22 | Comprehensive alignment with operational implementation: Physics-Informed Dual-Engine ML Ensemble (LightGBM + XGBoost), 30m DEM terrain integration, interactive MapLibre GIS dashboard, SQLite persistence schema, and API-key administrative controls. | 2.0 |

1. Introduction
1.1 Purpose
The purpose of this Software Requirements Specification (SRS) document is to describe the functional and non-functional requirements of the Cloudburst Prediction System (operational name: BurstWatch). The system is designed to ingest real-time and forecast atmospheric and terrain data, process complex convective meteorological variables, and provide high-accuracy early warning predictions regarding the probability and risk level of cloudburst events and extreme convective rainfall (>= 50 mm/day) across vulnerable regions, with primary operational calibration for Pan-India and Himalayan mountain sectors.

Cloudbursts are sudden, high-intensity convective rainfall events that trigger devastating flash floods, landslides, infrastructure damage, and loss of life. Mountainous topographies with steep elevation gradients are uniquely susceptible to rapid orographic convective uplift. The proposed system provides an automated, technology-driven early warning mechanism by synthesizing multi-layer atmospheric indicators (such as Convective Available Potential Energy - CAPE, Total Column Water Vapor, surface pressure drops, and wind shear) with 30-meter Digital Elevation Model (DEM) terrain parameters and applying a calibrated machine learning ensemble.

This document formally specifies the system's operational scope, users, user interfaces, system architecture, functional requirements, non-functional quality attributes, database structures, and design constraints.

1.2 Document Conventions
The following conventions and acronyms are used throughout this document:
CPS – Cloudburst Prediction System (BurstWatch).
CRI – Convective Risk Index (0 to 100 normalized risk score).
DEM – Digital Elevation Model (30m high-resolution topographical elevation data).
API – Application Programming Interface.
ML – Machine Learning.
UI – User Interface.
GIS – Geographic Information System.
DB – Database (SQLite WAL mode).
REQ-F – Functional Requirement.
REQ-NF – Non-Functional Requirement.
High Priority – Essential core operational capability.
Medium Priority – Supporting analysis, telemetry, or historical feature.
Low Priority – Optional or secondary visualization attribute.
Functional requirements are stated using standard declarative syntax beginning with "The system shall...".

1.3 Intended Audience and Reading Suggestions
This document is addressed to:
Developers: To understand component boundaries, feature engineering rules, ML ensemble specifications, REST API schemas, and GIS frontend requirements.
Project Evaluators / Reviewers: To assess functional completeness, technical rigor, and alignment between system design and practical implementation.
Project Managers: To track project scope, deployment dependencies, and verification criteria.
Emergency Planners and End Users: To understand the decision-support nature of the predictions, alert thresholds, and interactive map capabilities.

1.4 Product Scope
BurstWatch is an end-to-end, full-stack predictive weather surveillance application. The system operates both as an automated background inference pipeline and as a high-performance web-based visualization dashboard.

The system performs the following primary tasks:
1. Ingests hourly atmospheric and forecast data from external meteorological APIs (Open-Meteo, WeatherAPI).
2. Extracts high-resolution 30-meter DEM terrain parameters (elevation, slope gradient, aspect angle) with disk-backed caching.
3. Preprocesses raw time-series data into 36 engineered daily meteorological and calendar features.
4. Executes a Physics-Informed Dual-Engine Machine Learning Ensemble combining LightGBM and XGBoost classifiers with Platt probability calibration.
5. Computes calibrated probability scores, Convective Risk Index (CRI), alert classifications, and feature factor attributions (top risk-elevating factors).
6. Persists prediction runs, alerts, and evaluation outcomes in an ACID-compliant SQLite database.
7. Dispatches multi-channel alerts (in-browser HTML5 push notifications, audio warning signals, and outgoing webhooks to Slack/Discord).
8. Renders an interactive 2D/3D MapLibre WebGL GIS dashboard featuring real-time coordinate hover probing, 40+ Pan-India monitoring stations, thermodynamic temperature fields, speed-coded wind streamlines, Doppler radar reflectivity, and active global cyclone tracking.

Decision-Support Disclaimer: The system serves as an early-awareness decision-support system and does not replace official statutory warnings issued by government meteorological departments or national disaster management authorities.

1.5 References
1. Project source code and documentation repository for Cloudburst Prediction System (BurstWatch).
2. Open-Meteo Weather Forecast and Historical Archive API Documentation.
3. Open-Meteo Elevation / 30m Digital Elevation Model (DEM) Specification.
4. RainViewer Doppler Radar API Documentation.
5. Global Disaster Alert and Coordination System (GDACS / NOAA) RSS Feed.
6. Python 3.11, FastAPI, and Uvicorn Documentation.
7. Scikit-learn (v1.4.2), LightGBM, and XGBoost Technical References.
8. MapLibre GL JS Documentation (WebGL Mapping Engine).
9. React 19, Vite, and Tailwind CSS Documentation.

2. Overall Description
2.1 Product Perspective
The Cloudburst Prediction System is a modular, client-server web architecture engineered for real-time responsiveness and zero-latency visualization. The backend orchestrates data collection, physics-informed feature computation, machine learning inference, and persistence. The frontend provides a client-side geospatial dashboard capable of inspecting telemetry at any geographical coordinate.

System Flow:
External Meteorological APIs (Open-Meteo / WeatherAPI) + 30m DEM Elevation Cache
                              ↓
              Data Collection & Validation Engine
                              ↓
      Feature Engineering (36 Convective Features + Terrain Slope/Aspect)
                              ↓
     Dual-Engine Machine Learning Ensemble (LightGBM + XGBoost)
                              ↓
             Platt Calibration & Convective Risk Scoring (CRI)
                              ↓
       ┌──────────────────────┴──────────────────────┐
       ↓                                             ↓
SQLite Persistence Store                   FastAPI REST API Service
(Predictions, Outcomes, Alerts, Runs)     (/predict, /predict/location, etc.)
                                                     ↓
                                       React + MapLibre GL GIS Interface
                                       (Hover Probe, Live Panels, Alerts)
                                                     ↓
                                                 End User

Major System Components:
1. Geospatial User Interface (React, Vite, MapLibre GL, Tailwind CSS, Lucide Icons).
2. API Service Layer (FastAPI, Pydantic, CORS Middleware, API-Key Authorization).
3. Automated Inference Scheduler (APScheduler running background cron cycles).
4. Data Ingestion & Terrain Cache (Open-Meteo client, 30m DEM slope/aspect engine).
5. Feature Extraction Pipeline (36 atmospheric, thermodynamic, and temporal features).
6. Dual-Engine ML Prediction Service (LightGBM + XGBoost artifact, Platt calibrator).
7. Persistence and Evaluation Store (SQLite3 in WAL mode).
8. Multi-Channel Alert Manager (HTML5 Web Notifications, Web Audio Synthesizer, Webhooks).

2.2 Product Functions
1. Real-Time Meteorological Ingestion: Retrieves hourly atmospheric columns (CAPE, pressure, humidity, dew point, temperature, wind gusts, precipitation).
2. Topographical Terrain Profiling: Automatically samples surrounding 30m DEM elevations to calculate slope steepness and compass aspect for orographic lift modeling.
3. Feature Engineering: Generates aggregated daily statistics, threshold exceedance hours, and cyclical calendar representations.
4. Dual-Engine Ensemble Scoring: Executes weighted LightGBM + XGBoost prediction models with empirical probability calibration.
5. Convective Risk Classification: Classifies threat into standardized tiers (Green Normal, Amber Watch >= 25%, Red Warning >= 50%).
6. Real-Time Geospatial Coordinate Probe: Allows users to hover anywhere on the map to receive instantaneous temperature, wind speed, precipitation, pressure, and cloudburst risk values.
7. Station Network Monitoring: Tracks a preconfigured Pan-India network of 40+ high-vulnerability Himalayan and peninsular monitoring stations.
8. Live Hazard & Radar Overlays: Visualizes continuous thermodynamic temperature fields, particle streamlines, RainViewer Doppler radar (dBZ), and live UN GDACS cyclone tracking.
9. Multi-Channel Alert Dispatch: Triggers browser popups, audible hazard sirens, and outgoing webhook payloads upon threshold breach.
10. Ground-Truth Tracking & Live Evaluation: Records verified rainfall outcomes to dynamically compute precision, recall, and F1 metrics.

2.3 User Classes and Characteristics
1. General User / Public Observer
Primary audience accessing the public early warning dashboard.
Characteristics: General public, local residents, emergency responders, or travelers. No technical ML knowledge required.
Capabilities:
- Access the web dashboard freely without mandatory authentication.
- Explore the interactive 2D/3D map and pan/zoom smoothly across regions.
- Hover over any geographic coordinate to view live probe metrics.
- Select monitoring stations to view localized threat analytics, risk curves, and telemetry.
- Toggle between weather layers (Convective Plume, Temperature, Wind Speed, Doppler Rain Radar).
- Receive real-time browser notifications and acoustic alerts for active cloudburst hazards.

2. System Administrator / Operator
Technical personnel managing backend health, scheduled pipelines, and ground-truth validation.
Characteristics: Familiar with REST APIs, machine learning operations, and system configuration.
Capabilities:
- Authenticate via secure `X-API-Key` HTTP header.
- Trigger on-demand pipeline execution for arbitrary dates (`POST /predictions/run`).
- Inspect engineered feature sets prior to model consumption (`GET /features/preview`).
- Record observed rainfall data (`PUT /outcomes/{target_date}`) to validate forecast accuracy.
- Query live model evaluation metrics (`GET /metrics/live`).
- Monitor background scheduler health, task logs, and SQLite database integrity (`GET /health`).

3. Automated ML Scheduler
Internal daemon running inside the FastAPI application. Executes periodic data ingestion, inference, and alert checks every few hours without human intervention.

2.4 Operating Environment
Hardware:
- Server: Minimum 2 vCPU, 2 GB RAM, 10 GB SSD storage.
- Client: Modern desktop, laptop, or tablet with WebGL-capable GPU hardware acceleration.
- Network: Broadband internet connectivity for external API ingestion and slippy map tile rendering.

Software:
- Server OS: Linux (Ubuntu 22.04+), Windows 10/11, or containerized Docker (Debian slim).
- Backend Runtime: Python 3.11 or 3.12.
- Core Python Libraries: FastAPI, Uvicorn, Scikit-learn (pinned 1.4.2), LightGBM, XGBoost, Joblib, Pandas, NumPy, Requests, APScheduler.
- Database: SQLite 3.35+ with Write-Ahead Logging (WAL) enabled.
- Frontend Runtime: Node.js 18+ (development), modern browser with ES6+ and WebGL support (Chrome, Firefox, Edge, Safari).
- Frontend Frameworks: React 19, Vite, MapLibre GL JS, Tailwind CSS, Lucide React, Framer Motion.

2.5 Design and Implementation Constraints
1. Pinned Scikit-Learn Compatibility: The serialized ensemble artifact requires scikit-learn 1.4.2; newer versions cause deserialization inconsistencies.
2. In-Memory Scheduling Constraint: The scheduler runs as an in-process thread; FastAPI must be deployed using a single master process or dedicated worker to prevent duplicate cron runs.
3. External API Rate Limits: Open-Meteo and WeatherAPI request rates are constrained; terrain parameters and inference calls utilize disk and client-side memory caching to minimize repeated external requests.
4. Geostatistical Screening Nature: The model is trained as an extreme-rainfall screening filter (>= 50 mm/day). The UI and alert text must clearly denote that predictions represent probabilistic risk indicators rather than guaranteed catastrophic events.
5. WebGL Map Requirements: The browser interface depends on hardware-accelerated WebGL for 60 FPS rendering of dynamic heatmaps, thermodynamic rasters, and wind streamlines.

2.6 User Documentation
1. BurstWatch Quickstart & Setup Guide (root `README.md`): Covers repository initialization, environment variable setup, frontend dev server execution, and production build commands.
2. Backend API Architecture Documentation (`backend/README.md`): Detailed technical specifications for all REST endpoints, feature definitions, scikit-learn pin verification, and Docker deployment.
3. Interactive UI Controls: Built-in context tooltips, unit toggles (Metric / Imperial), and meteorological legend references directly embedded in the dashboard.

2.7 Assumptions and Dependencies
Assumptions:
- Users have an internet connection capable of streaming vector map tiles and weather telemetry.
- Open-Meteo and WeatherAPI services maintain high operational availability.
- The 30m DEM elevation grid provides sufficient vertical resolution for calculating macro-scale mountain slope and aspect.

Dependencies:
- External weather providers: Open-Meteo API, WeatherAPI.com, RainViewer API.
- Live disaster feed: GDACS (UN / European Commission) RSS stream.
- Map tile infrastructure: OpenFreeMap Positron / Liberty vector tile servers.

3. External Interface Requirements
3.1 User Interfaces
The system provides a responsive, single-page application (SPA) visual interface organized into a map-first layout:

1. Interactive Geospatial Map (Primary Canvas):
- Full-screen WebGL map canvas rendered via MapLibre GL JS.
- Smooth 2D/3D tilt and compass bearing controls.
- Dynamic thermodynamic color fields with continuous Windy-style color transitions.
- Animated vector streamline particles with configurable velocity modes (normal, strong, fast, soft).
- Doppler radar reflectivity overlay (dBZ) powered by RainViewer tile layers.
- Real-Time Hover Coordinate Probe: Floating glass pill displaying instantaneous latitude, longitude, sector name, temperature, wind speed, precipitation, pressure, and cloudburst threat percentage.

2. Left Navigation Rail (NavRail):
- Minimalist glass sidebar with high-contrast icon buttons.
- Quick navigation toggles: Overview (Home), Convective Grid (Dashboard), Risk Rankings (High to Low), Threat Analytics, and Station Telemetry.
- Immediate layer switches for Temperature Overlay, Wind Streamlines, and Satellite Imagery.
- Interactive temperature unit switcher (°C / °F).

3. Top Status and Search Header:
- Brand identity with live system status badge (ML Live / Online, Operational FPS counter).
- Quick Search Bar: Autocomplete search filter navigating directly to any Indian city, district, or monitoring station.
- Focus Shortcut: Instant fly-to button centering on Pan-India and Himalayan cloudburst hotspots.

4. Threat Analytics Drawer:
- Circular Convective Risk Index (CRI) gauge with dynamic color states.
- Localized rainfall intensity curve comparing actual precipitation against model forecast curves.
- Top Contributing Meteorological Factors breakdown (highlighting variables elevating risk).
- Geographical context: elevation, coordinates, and monitoring station metadata.

5. Area Risk Rankings Drawer:
- Sorted card list of all monitored stations ranked dynamically from highest to lowest convective threat.
- One-click map fly-to and camera zoom targeting the selected station.

6. Incident & Alert Modal:
- High-visibility modal triggered when convective risk breaches operational thresholds (>= 25%).
- Audio warning chime synthesized via Web Audio API.
- Emergency safety checklist and immediate precautionary instructions.

3.2 Hardware Interfaces
The application operates on standard computing hardware without requiring proprietary sensors.
Client: Standard PC, laptop, or mobile workstation equipped with an integrated or dedicated GPU capable of running WebGL.
Server: Standard x86-64 or ARM64 cloud virtual machine or Docker host.

3.3 Software Interfaces
1. Open-Meteo Forecast & Archive APIs: Supplies hourly multi-level atmospheric variables via REST/JSON.
2. Open-Meteo Elevation API: Queries 30-meter Digital Elevation Model (DEM) data points to compute terrain slope and aspect.
3. RainViewer API: Ingests timestamped Doppler radar raster tiles for precipitation tracking.
4. WeatherAPI.com: Supplies live ground observations and secondary meteorological verification.
5. GDACS RSS Feed: XML/RSS endpoint parsed in real time to extract global active tropical cyclones (coordinates, category, wind speed, pressure).
6. SQLite Database Engine: Interfaced via Python's standard `sqlite3` module with Write-Ahead Logging (`PRAGMA journal_mode=WAL`).

3.4 Communications Interfaces
1. HTTP / HTTPS: Used for all frontend-to-backend REST API requests and external tile fetching.
2. CORS (Cross-Origin Resource Sharing): Configured in FastAPI to allow secure client connections across development and production domains.
3. Outgoing Webhooks: Standard HTTPS POST payloads transmitting JSON alert records to user-specified endpoints (e.g., Slack or Discord).
4. Error Handling: Built-in retries, network timeout protection (10-18s), and graceful fallbacks to cached baseline estimates upon external API degradation.

4. System Features
4.1 System Access and Administrative Authorization
4.1.1 Description and Priority
Provides unrestricted public access to real-time risk intelligence while strictly guarding administrative model execution and ground-truth evaluation endpoints via API-key authentication.
Priority: High

4.1.2 Functional Requirements
REQ-F-01: The system shall provide unrestricted public read access to the interactive GIS dashboard, station telemetry, and live prediction endpoints.
REQ-F-02: The system shall enforce API-key authentication (`X-API-Key` header) for all administrative and modification endpoints (`/predictions/run`, `/features/preview`, `/outcomes/{target_date}`).
REQ-F-03: The system shall reject unauthorized administrative requests with an HTTP 401 (Invalid/Missing Key) or HTTP 403 (Admin Disabled) response.
REQ-F-04: The system shall maintain an automated background scheduler that triggers regular inference runs according to configured cron intervals.
REQ-F-05: The system shall log every scheduled and manual pipeline run in the database, including execution timestamps, trigger type, and success status.

4.2 Environmental and Terrain Data Collection
4.2.1 Description and Priority
Retrieves, verifies, and caches multi-source environmental and high-resolution terrain elevation data.
Priority: High

4.2.2 Functional Requirements
REQ-F-06: The system shall query external weather APIs for hourly atmospheric time-series (including temperature, relative humidity, dew point, surface pressure, wind speed, wind gusts, precipitation, cloud cover, and CAPE).
REQ-F-07: The system shall compute topographical terrain parameters (elevation in meters, slope steepness in degrees, and compass aspect) using 30-meter DEM elevation samples.
REQ-F-08: The system shall maintain a persistent disk-backed cache (`terrain_cache.json`) for calculated DEM terrain coordinates to minimize redundant external elevation calls.
REQ-F-09: The system shall validate all incoming numerical values and substitute safe meteorological defaults or raise descriptive errors when values are corrupted.
REQ-F-10: The system shall parse live cyclone data from international disaster alert feeds (GDACS) and map active systems with coordinates, wind speeds, and pressure metrics.

4.3 Data Preprocessing and Feature Engineering
4.3.1 Description and Priority
Transforms raw hourly time-series and terrain parameters into a structured 36-feature vector matching the trained machine learning pipeline.
Priority: High

4.3.2 Functional Requirements
REQ-F-11: The system shall aggregate hourly meteorological observations into daily statistical metrics (mean, minimum, maximum, and cumulative sum).
REQ-F-12: The system shall compute precipitation duration indices, specifically counting hours where precipitation exceeds 5 mm (`hours_ge_5mm`) and 10 mm (`hours_ge_10mm`).
REQ-F-13: The system shall encode calendar variables, including day of year and cyclical representations, to reflect seasonal monsoon cycles.
REQ-F-14: The system shall integrate terrain elevation, slope, and aspect into the model input vector.
REQ-F-15: The system shall enforce a maximum permissible missing-feature threshold (default: 25%); if missing features exceed this fraction, the system shall reject inference with an `InsufficientDataError`.

4.4 Dual-Engine Cloudburst Machine Learning Prediction
4.4.1 Description and Priority
Executes the Physics-Informed Dual-Engine Ensemble to generate calibrated probabilistic cloudburst risk scores.
Priority: High

4.4.2 Functional Requirements
REQ-F-16: The system shall load and execute a serialized ensemble artifact combining trained LightGBM and XGBoost gradient-boosted decision tree models.
REQ-F-17: The system shall apply Platt probability calibration to convert raw ensemble outputs into calibrated risk probabilities.
REQ-F-18: The system shall calculate the Convective Risk Index (CRI) normalized on a 0 to 100 continuous percentage scale.
REQ-F-19: The system shall compute individual feature importance attributions (`top_factors`), identifying specific environmental drivers raising the risk score.
REQ-F-20: The system shall support coordinate-based inference (`POST /predict/location`), allowing client applications to request predictions for any arbitrary latitude and longitude.

4.5 Risk Classification and Alert Management
4.5.1 Description and Priority
Evaluates model outputs against operational thresholds, categorizes hazard levels, and dispatches multi-channel alerts.
Priority: High

4.5.2 Functional Requirements
REQ-F-21: The system shall classify prediction probabilities into distinct operational tiers:
- Normal / Low Risk (CRI < 25%)
- Elevated Convective Watch (CRI >= 25%)
- Severe Cloudburst Warning (CRI >= 50%)
REQ-F-22: The system shall trigger an alert state whenever predicted probability meets or exceeds the operational watch threshold (0.25).
REQ-F-23: The system shall deliver in-browser push notifications via the HTML5 Notification API when browser permissions are granted.
REQ-F-24: The system shall synthesize an acoustic warning signal via the Web Audio API upon active warning detection unless muted by the user.
REQ-F-25: The system shall deliver outbound alert JSON payloads to configured third-party webhooks (Slack/Discord) and prevent duplicate alerts for the same target date.

4.6 Prediction History and Model Evaluation
4.6.1 Description and Priority
Maintains persistent records of predictions and allows recording ground-truth observations to evaluate model reliability.
Priority: Medium

4.6.2 Functional Requirements
REQ-F-26: The system shall store all generated pipeline predictions in the SQLite `predictions` table with timestamps, location, risk label, and serialized feature snapshots.
REQ-F-27: The system shall expose a historical prediction query endpoint (`GET /predictions`) supporting pagination and date-range filtering.
REQ-F-28: The system shall allow authorized operators to submit observed 24-hour rainfall totals via `PUT /outcomes/{target_date}`.
REQ-F-29: The system shall calculate live confusion matrix metrics (True Positives, False Positives, True Negatives, False Negatives, Precision, Recall, F1-Score) via `GET /metrics/live` comparing stored predictions against verified outcomes.

4.7 Interactive GIS Dashboard
4.7.1 Description and Priority
Renders real-time meteorological visualizations, station rankings, and geospatial analysis tools.
Priority: High

4.7.2 Functional Requirements
REQ-F-30: The system shall render an interactive 2D/3D map displaying the Pan-India region with progressive Level of Detail (LoD) city and station labels.
REQ-F-31: The system shall render a real-time coordinate hover probe displaying instantaneous temperature, wind velocity, precipitation, pressure, and cloudburst threat.
REQ-F-32: The system shall display a ranked list of 40+ Pan-India monitoring stations sorted by convective risk with instant fly-to camera navigation.
REQ-F-33: The system shall provide visual layer toggles for Thermodynamic Temperature (Windy palette), Speed-Coded Wind Streamlines, Doppler Rain Radar, and Satellite imagery.
REQ-F-34: The system shall adjust the minimum zoom out limit dynamically based on viewport dimensions to ensure the map seamlessly spans the entire screen width.

5. Other Nonfunctional Requirements
5.1 Performance Requirements
1. The backend API shall process single-coordinate prediction requests (`/predict/location`) in under 2.5 seconds under standard network conditions.
2. The web frontend shall maintain a fluid rendering frame rate of >= 55 FPS during map panning, zooming, and wind particle animation.
3. Terrain DEM disk cache hits shall resolve in < 1 millisecond.
4. Procedural thermodynamic raster tiles shall render in < 5 milliseconds per tile via bilinear interpolation.
5. SQLite database queries for the latest prediction or historical lists shall complete in < 15 milliseconds.

5.2 Safety Requirements
1. All predictions, risk percentages, and alerts shall be explicitly labeled as "Probabilistic Estimates / Advisory Indicators" and shall never be presented as guaranteed events.
2. The UI and alert dialogs shall prominently advise users to follow instructions from official disaster management authorities (NDRF, IMD, SDMA).
3. In the event of API data loss or severe data corruption, the system shall display a visible "Degraded Telemetry" notice rather than silently outputting misleading zero-risk values.

5.3 Security Requirements
1. Administrative endpoints shall be secured via constant-time string comparison (`hmac.compare_digest`) against the configured `ADMIN_API_KEY`.
2. All client-server communications shall operate over secure HTTPS/TLS in production deployments.
3. The backend shall reject oversized payloads and sanitize string inputs to protect against injection attacks.
4. No secret keys or administrative tokens shall be exposed in client-side bundles or public API responses.

5.4 Software Quality Attributes
1. Reliability: Background scheduler failures or individual weather API timeouts shall be caught gracefully without crashing the server process.
2. Maintainability: The codebase shall maintain clear separation between feature extraction (`features.py`), model inference (`model_service.py`), storage (`storage.py`), and API routing (`main.py`).
3. Usability: The interface shall use self-explanatory visual cues (color-coded risk badges, intuitive icons, interactive hover tooltips) accessible to non-technical users.
4. Portability: The backend shall run consistently across Windows, Linux, and Docker environments. The frontend shall run in any standards-compliant browser supporting WebGL.

5.5 Business Rules
1. Public Access Rule: Core disaster risk intelligence and map visualizations shall remain freely accessible to the public without paywalls or mandatory account creation.
2. Admin Guard Rule: Only requests presenting a valid `X-API-Key` matching `ADMIN_API_KEY` may initiate on-demand training runs, feature previews, or outcome recording.
3. Alert Suppress Rule: The system shall not send more than one automated alert per target date to external webhook channels unless explicitly triggered manually.
4. Data Freshness Rule: Stored predictions older than 24 hours shall be flagged as `stale: true` in the API response.

6. Other Requirements
6.1 Database Requirements
The system shall utilize an ACID-compliant SQLite database (`predictions.db`) configured with Write-Ahead Logging (`PRAGMA journal_mode=WAL`).

Table Schemas:
1. `predictions` Table:
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `created_at` TEXT NOT NULL (ISO 8601 UTC timestamp)
- `location` TEXT NOT NULL
- `feature_date` TEXT NOT NULL (YYYY-MM-DD input date)
- `target_date` TEXT NOT NULL (YYYY-MM-DD forecast date)
- `probability` REAL NOT NULL (Calibrated probability 0.0 - 1.0)
- `threshold` REAL NOT NULL (Operational decision threshold)
- `prediction` INTEGER NOT NULL (0 = Normal, 1 = Elevated Risk)
- `risk_label` TEXT NOT NULL
- `data_source` TEXT (forecast / archive)
- `trigger` TEXT (scheduled / manual)
- `missing_features` TEXT (JSON list of missing features)
- `top_factors` TEXT (JSON list of feature contributions)
- `warnings` TEXT (JSON list of model warnings)
- `features` TEXT (JSON dictionary of 36 raw computed features)

2. `outcomes` Table:
- `target_date` TEXT PRIMARY KEY (YYYY-MM-DD)
- `observed_max_rainfall_mm` REAL NOT NULL
- `extreme` INTEGER NOT NULL (1 if >= 50 mm/day threshold, else 0)
- `source` TEXT (manual / sensor / imd)
- `recorded_at` TEXT NOT NULL (ISO 8601 UTC timestamp)

3. `alerts` Table:
- `target_date` TEXT PRIMARY KEY (YYYY-MM-DD)
- `sent_at` TEXT NOT NULL (ISO 8601 UTC timestamp)
- `probability` REAL NOT NULL
- `detail` TEXT (Alert summary message)

4. `runs` Table:
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `started_at` TEXT NOT NULL
- `finished_at` TEXT
- `ok` INTEGER (1 = Success, 0 = Failed)
- `trigger` TEXT (scheduled / manual)
- `feature_date` TEXT
- `error` TEXT

6.2 Data Integrity and Caching Requirements
1. Disk Cache: Topographical elevation and slope data shall be persisted in `backend/data/cache/terrain_cache.json` to prevent duplicate API queries.
2. Memory Cache: Real-time client-side coordinate predictions shall be cached in browser memory for 15 minutes (`CACHE_TTL_MS`).
3. Transactional Safety: All database writes shall use contextual transactions (`with self._conn()`) with automatic rollback on error.

6.3 Future Extensibility
1. Integration with automated ground IoT weather stations and tipping-bucket rain gauges.
2. Incorporation of high-resolution radar Nowcasting models (Optical Flow / ConvLSTM).
3. Native mobile application wrapper (Capacitor / React Native) with background push notifications.
4. Direct integration with state emergency operation center (SEOC) alert broadcasting protocols.

Appendix A: Glossary
| Term | Definition |
|---|---|
| CAPE | Convective Available Potential Energy; atmospheric buoyancy metric indicating instability. |
| Cloudburst | An extreme convective precipitation event delivering >= 100 mm/h of localized rainfall. |
| CPS | Cloudburst Prediction System (BurstWatch). |
| CRI | Convective Risk Index (composite normalized threat percentage). |
| DEM | Digital Elevation Model; 30m vertical elevation topography dataset. |
| Dual Ensemble | Machine learning model combining LightGBM and XGBoost gradient-boosted trees. |
| GDACS | Global Disaster Alert and Coordination System (UN / European Commission disaster monitor). |
| LoD | Level of Detail; hierarchical filtering of map labels based on camera zoom. |
| Orographic Lift | Upward movement of air masses forced over rising mountain terrain, triggering condensation. |
| Platt Calibration | Logistic regression transformation mapping raw model margins to true posterior probabilities. |
| TCWV | Total Column Water Vapor; total precipitable moisture contained within the vertical air column. |
| WAL | Write-Ahead Logging; SQLite concurrency mode allowing concurrent reads and writes. |

Appendix B: Analysis Models
B.1 Use Case Model
Primary Actors:
1. General User / Public
2. System Administrator / Operator
3. Automated ML Scheduler

Use Cases:
- General User:
  - Explore Geospatial Map Canvas
  - Hover Coordinate Probe (Inspect Instantaneous Telemetry)
  - Select Monitoring Station (Fly-to Hotspot)
  - Inspect Threat Analytics and Convective Risk Curves
  - View Area Risk Rankings (High to Low)
  - Toggle Visual Weather Overlays (Thermodynamic Temp, Wind Streamlines, Doppler Radar)
  - Receive Audible & Browser Push Alerts
- Administrator:
  - Trigger Manual Pipeline Run (`POST /predictions/run`)
  - Preview Engineered Daily Features (`GET /features/preview`)
  - Record Verified Rainfall Outcomes (`PUT /outcomes/{target_date}`)
  - Query Live Model Precision/Recall Metrics (`GET /metrics/live`)
  - Monitor Service and Database Health (`GET /health`)
- Automated ML Scheduler:
  - Ingest Scheduled Hourly Weather Data
  - Compute 36 Features & Query DEM Terrain Cache
  - Run Dual Ensemble Scoring & Record Prediction
  - Dispatch Webhook Alerts on High Risk Breach

B.2 Class Structure Model
Key Backend Classes:
- `ForecastService`: Orchestrates pipeline execution, data fetching, prediction, and notifications.
- `OpenMeteoClient`: Handles weather queries, units, retries, and DEM slope/aspect sampling.
- `ModelService`: Loads serialized LightGBM + XGBoost models, checks missingness, and scores CRI.
- `Store`: Manages SQLite database connection pool, WAL mode, queries, and transactions.
- `Notifier`: Formats alert text and delivers JSON payloads to outgoing webhook endpoints.

Key Frontend Modules:
- `App.jsx`: State coordinator (manages active station, active layers, threat calculations, drawer states).
- `CloudburstMap.jsx`: MapLibre GL engine managing 2D/3D projections, raster layers, and particles.
- `ThreatAnalyticsPanel.jsx`: Analytics drawer with CRI gauge, rainfall curve, and top contributing factors.
- `AreaRiskRankingsPanel.jsx`: Ranked station cards with direct camera navigation.
- `mlPredictionService.js`: Client-side caching and API bridge for coordinate prediction.

B.3 Package Architecture
- `backend/app/`: Core FastAPI server, ML service, feature extraction, storage, and scheduler.
- `backend/model/`: Serialized model artifacts (`stage1_risk_scorer.pkl`, `model_metadata.json`).
- `backend/data/`: SQLite database (`predictions.db`) and disk cache (`terrain_cache.json`).
- `src/components/`: Modular React UI components (Map, Header, NavRail, Analytics, Rankings, Legend).
- `src/services/`: Client-side service layer (ML prediction bridge, weather API client, cyclone tracker).
- `src/data/`: Static station network metadata, Natural Earth boundaries, and hierarchical places.
- `src/utils/`: Canvas math, weather tile protocols, notification wrappers, and color maps.

B.4 Sequence Model (Live Coordinate Risk Inspection)
User Moves Cursor over Map
   ↓
MapLibre fires `mousemove` event with screen coordinates [x, y]
   ↓
Map unprojects point to geographic coordinates [lat, lon]
   ↓
Frontend checks client memory cache (`predictionCache`)
   ↓ (If cache miss)
Frontend calls `POST /predict/location` with coordinates
   ↓
Backend queries Open-Meteo & computes 30m DEM terrain slope/aspect
   ↓
Backend extracts 36 features & scores via Dual-Engine Ensemble
   ↓
Backend returns JSON: `{ predicted_probability, cri, risk_label, top_factors }`
   ↓
Frontend updates Floating Probe & Convective Risk Gauge in real time

B.5 Activity Model (Scheduled Model Execution)
[Start Scheduler Trigger]
        ↓
[Query Open-Meteo for Hourly Weather]
        ↓
[Fetch / Check 30m DEM Terrain Elevation Cache]
        ↓
[Aggregate & Engineer 36 Convective Features]
        ↓
<Missing Features > 25%?>
  ├── Yes → [Log Data Error & Terminate Run]
  └── No  → [Execute LightGBM + XGBoost Dual Ensemble]
                  ↓
            [Apply Platt Probability Calibration]
                  ↓
            [Save Prediction Record to SQLite Database]
                  ↓
            <Predicted Probability >= 0.25 (Watch Threshold)?>
              ├── Yes → [Dispatch Webhook Alert & Record in alerts Table]
              └── No  → [Log Normal Risk Baseline]
                  ↓
                [End Run]

B.6 Data Flow Model (Level 1 DFD)
1. Ingestion: Open-Meteo / WeatherAPI -> (Process 1.0: Ingest & Validate) -> Raw Weather Data
2. Topography: DEM Elevation Service -> (Process 2.0: Terrain Profiling) -> Terrain Cache
3. Preprocessing: Raw Data + Terrain Cache -> (Process 3.0: Feature Extraction) -> 36 Features
4. Inference: 36 Features -> (Process 4.0: Dual Ensemble Scoring) -> Calibrated CRI & Predictions
5. Storage: Predictions -> (Process 5.0: Record Storage) -> `predictions.db` (SQLite)
6. Presentation: `predictions.db` + Live APIs -> (Process 6.0: GIS Dashboard) -> End User Screen
7. Feedback: Operator Outcomes -> (Process 7.0: Metrics Evaluation) -> Precision/Recall Report

B.7 Entity-Relationship (ER) Model
Entities:
- `PREDICTIONS` (id PK, created_at, location, feature_date, target_date, probability, threshold, prediction, risk_label, data_source, trigger, missing_features, top_factors, warnings, features)
- `OUTCOMES` (target_date PK, observed_max_rainfall_mm, extreme, source, recorded_at)
  * Relationship: Logical 1-to-1 matching `PREDICTIONS.target_date = OUTCOMES.target_date` for accuracy scoring.
- `ALERTS` (target_date PK, sent_at, probability, detail)
  * Relationship: Logical 1-to-1 matching `PREDICTIONS.target_date = ALERTS.target_date` for alert deduplication.
- `RUNS` (id PK, started_at, finished_at, ok, trigger, feature_date, error)
  * Audit entity recording pipeline execution history.

B.8 System Architecture Overview
[Client Browser]
  ├── React 19 UI Components (Dashboard, Drawers, Header, NavRail)
  ├── MapLibre GL WebGL Engine (Heatmaps, Thermodynamic Rasters, Particles)
  └── Client Prediction Service & Memory Cache
         ↑ HTTPS / JSON
[FastAPI Server]
  ├── REST Endpoints (/predict, /predict/location, /predictions, /health, /cyclones)
  ├── Admin Auth Guard (X-API-Key Verification)
  ├── Feature Extraction Engine (36 Convective Variables)
  ├── Dual-Engine Ensemble Service (LightGBM + XGBoost + Platt Calibrator)
  ├── Background APScheduler Daemon
  └── SQLite Persistence Store (WAL Mode)
         ↑ HTTPS Ingestion
[External Services]
  ├── Open-Meteo (Weather & 30m DEM Elevation APIs)
  ├── WeatherAPI.com (Telemetry & Station Observations)
  ├── RainViewer (Doppler Radar Slippy Tiles)
  └── GDACS / NOAA (Global Active Tropical Cyclone RSS Feed)

Appendix C: To Be Determined List
| TBD ID | Item | Reason | Status |
|---|---|---|---|
| TBD-01 | High-Resolution Localized Radar Integration | Integration with IMD Doppler Radar Network (DWR) data feeds pending public API accessibility. | Open |
| TBD-02 | SMS / WhatsApp Emergency Gateway | Implementation of direct cellular SMS alerts for citizens in remote mountain valleys lacking broadband access. | Open |
| TBD-03 | Mobile Native Application Wrapper | Packaging client interface into native Android / iOS application with geofenced background alerts. | Open |
| TBD-04 | Long-Term PostgreSQL Migration | Migration from SQLite to distributed PostgreSQL if multi-tenant concurrent user accounts are introduced. | Closed (SQLite WAL mode verified sufficient for current architecture) |
| TBD-05 | Model Retraining Schedule | Periodic automated retraining of the Dual-Engine Ensemble incorporating annual monsoon post-season ground truth. | Open |

