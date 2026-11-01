# BurstWatch

BurstWatch is a React and Vite dashboard for cloudburst-risk monitoring and
weather visualization.

## Requirements

- Node.js
- npm
- A WeatherAPI.com API key for live weather observations (optional; without it,
  the dashboard displays clearly labeled baseline estimates)

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a `.env` file in the project root and add your WeatherAPI.com key:

   ```env
   VITE_WEATHERAPI_KEY=your_weatherapi_key
   ```

   Vite exposes `VITE_` variables in browser code. Use a key intended for
   client-side use and restrict it with your provider where possible. Do not
   commit `.env` or other secrets.

3. Start the development server:

   ```sh
   npm run dev
   ```

Without a configured key, the dashboard uses geographic baseline estimates
instead of live observations. These estimates and the illustrative cloudburst
risk overlay are not current measurements, official forecasts, or warnings.

## Data notes

- Weather observations require a configured WeatherAPI.com key. Without one,
  the dashboard clearly labels its geographic baseline estimates.
- Wind streamlines are a separate illustrative visualization. They are not a
  live wind observation layer.
- Rain radar frames use RainViewer reflectivity values (dBZ) and its Universal
  Blue palette. Lightning markers and the
  cloudburst-risk heatmap are illustrative model data, not live detections or
  official alerts.

## Other commands

- `npm run build` — build the production bundle
- `npm run preview` — preview the production bundle locally
- `npm run lint` — run ESLint
