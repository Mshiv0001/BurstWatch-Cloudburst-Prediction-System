# BurstWatch

BurstWatch is a React and Vite dashboard for cloudburst-risk monitoring and
weather visualization.

## Requirements

- Node.js
- npm
- A WeatherAPI.com API key for live weather observations

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

Without a configured key, the dashboard uses baseline weather data for this
feed.

## Other commands

- `npm run build` — build the production bundle
- `npm run preview` — preview the production bundle locally
- `npm run lint` — run ESLint
