// Meteorological Data for Early Warning & Convective Cloudburst Monitoring System
// Multi-station network covering Himalayas & Northern India sectors

export const BASEMAP_OPTIONS = [
  {
    id: 'liberty',
    name: 'OpenFreeMap Liberty',
    styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
    type: 'vector',
    attribution: '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    description: 'Clean natural vector topography & detailed road network'
  },
  {
    id: 'positron',
    name: 'OpenFreeMap Positron',
    styleUrl: 'https://tiles.openfreemap.org/styles/positron',
    type: 'vector',
    attribution: '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    description: 'Ultra-clean high-contrast basemap ideal for convective heatmaps'
  },
  {
    id: 'bright',
    name: 'OpenFreeMap Bright',
    styleUrl: 'https://tiles.openfreemap.org/styles/bright',
    type: 'vector',
    attribution: '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    description: 'Vibrant modern high-visibility cartography'
  },
  {
    id: 'satellite',
    name: 'Satellite View (High-Res Orbital Imagery)',
    type: 'raster',
    attribution: '&copy; Google / Esri Satellite Imagery',
    description: 'True-color high-definition earth observation photography'
  }
];

export const WEATHER_LAYERS = [
  { id: 'radar', name: 'Weather radar', icon: 'Zap', unit: 'dBZ', gradient: 'from-blue-700 via-cyan-400 via-green-500 via-yellow-400 via-orange-500 to-fuchsia-600', description: 'Live Doppler Reflectivity & Thunder' },
  { id: 'satellite', name: 'Satellite', icon: 'Eye', unit: '°C', gradient: 'from-fuchsia-600 via-red-500 via-amber-400 via-cyan-400 to-blue-900', description: 'High-Res True Color & Thermal IR Cloud Tops' },
  { id: 'wind', name: 'Wind', icon: 'Wind', unit: 'km/h', gradient: 'from-cyan-500 via-emerald-400 via-amber-400 to-rose-600', description: 'Surface Wind Streamlines & Speed' },
  { id: 'rain', name: 'Rain, thunder', icon: 'CloudRain', unit: 'mm/h', gradient: 'from-sky-700 via-cyan-400 via-yellow-400 to-red-600', description: 'Precipitation Intensity & Accumulation' },
  { id: 'temp', name: 'Temperature', icon: 'Thermometer', unit: '°C', gradient: 'from-indigo-600 via-cyan-400 via-emerald-400 via-amber-400 to-red-600', description: '2m Surface Thermal Map' },
  { id: 'extreme', name: 'Hurricane tracker', icon: 'Compass', unit: 'Cat', gradient: 'from-emerald-500 via-amber-500 via-orange-600 to-red-700', description: 'Severe Cyclone & Storm Track' },
  { id: 'clouds', name: 'Clouds', icon: 'Cloud', unit: '%', gradient: 'from-slate-700 via-slate-400 to-white', description: 'Infrared Cloud Top Density' },
  { id: 'waves', name: 'Waves', icon: 'Waves', unit: 'm', gradient: 'from-blue-600 via-teal-400 to-purple-600', description: 'Ocean Wave Height' },
  { id: 'rain_accum', name: 'Rain accumulation', icon: 'Gauge', unit: 'mm', gradient: 'from-emerald-500 via-yellow-400 via-red-500 to-purple-700', description: 'Total 24h Rainfall' },
  { id: 'thunderstorms', name: 'Thunderstorms', icon: 'Zap', unit: 'flashes', gradient: 'from-yellow-400 to-red-600', description: 'Lightning Flash Density' },
  { id: 'altitude', name: 'Altitude', icon: 'Plane', unit: 'FL', gradient: 'from-amber-400 to-orange-500', description: 'Flight Level Wind' },
];

export const FORECAST_MODELS = [
  { id: 'ecmwf', name: 'ECMWF 9km', res: '9 km', freq: '1 hr', tag: 'Global Gold Std' },
  { id: 'gfs', name: 'GFS 22km', res: '22 km', freq: '3 hr', tag: 'Synoptic Scale' },
  { id: 'icon', name: 'ICON 13km', res: '13 km', freq: '1 hr', tag: 'High Resolution' },
  { id: 'xgboost', name: 'XGBoost AI', res: '1 km', freq: '15 min', tag: 'High-Res Warning' },
];

// High-Resolution Satellite Infrared & Visible Cloud Complexes
export const SATELLITE_CLOUD_BANDS = [
  // 1. Deep Convective Overshooting Cloud Tops over Gangetic Front & Nepal Foothills (-75°C to -50°C)
  {
    id: 'sat-gangetic',
    name: 'Convective Cumulonimbus Anvils',
    outerCloud: [
      [28.8, 78.5], [29.2, 82.0], [28.5, 85.5], [26.8, 87.2],
      [24.8, 86.0], [24.5, 82.5], [25.8, 79.5]
    ],
    deepCore: [
      [28.2, 80.0], [28.6, 82.5], [27.8, 85.0], [26.0, 85.5],
      [25.4, 83.2], [26.5, 80.5]
    ],
    overshootingTop: [
      [27.8, 81.0], [28.1, 82.2], [27.4, 83.5], [26.6, 82.8]
    ]
  },
  // 2. Tropical Monsoon Cloud Cluster over Bay of Bengal & Bangladesh (-65°C)
  {
    id: 'sat-bengal',
    name: 'Bay of Bengal Deep Tropical Plume',
    outerCloud: [
      [26.5, 87.8], [26.0, 92.5], [23.5, 93.5], [20.5, 91.5],
      [19.0, 87.5], [21.5, 85.5], [24.5, 86.8]
    ],
    deepCore: [
      [25.5, 88.5], [25.0, 91.5], [22.8, 92.0], [20.5, 89.5],
      [22.0, 87.0], [24.0, 87.5]
    ],
    overshootingTop: [
      [24.8, 89.2], [24.5, 90.8], [23.2, 91.0], [22.8, 89.5]
    ]
  },
  // 3. Arabian Sea Convective Cloud Surge (-60°C)
  {
    id: 'sat-arabian',
    name: 'Arabian Sea Convective Surge',
    outerCloud: [
      [21.5, 68.0], [21.8, 73.8], [17.5, 74.5], [15.2, 71.5], [17.0, 67.5]
    ],
    deepCore: [
      [20.5, 69.2], [20.8, 73.2], [18.0, 73.5], [16.5, 71.0], [18.2, 68.8]
    ],
    overshootingTop: [
      [19.8, 71.0], [20.0, 72.8], [18.5, 72.8], [18.0, 71.2]
    ]
  },
  // 4. Himalayan Cloudburst Ridge Cloud Top (-78°C Overshooting Top)
  {
    id: 'sat-garhwal',
    name: 'Garhwal Cloudburst Anvil Top',
    outerCloud: [
      [31.4, 77.2], [31.8, 80.0], [30.2, 80.5], [29.6, 78.0]
    ],
    deepCore: [
      [31.0, 77.8], [31.3, 79.5], [30.4, 79.8], [30.0, 78.3]
    ],
    overshootingTop: [
      [30.8, 78.2], [31.0, 79.2], [30.4, 79.3], [30.2, 78.4]
    ]
  }
];

// Lightning Strikes dataset across India & Himalayas
export const LIGHTNING_STRIKES = [
  { id: 'lt-1', lat: 26.8467, lon: 80.9462, age: '1m ago' }, // Lucknow
  { id: 'lt-2', lat: 26.7606, lon: 83.3732, age: '2m ago' }, // Gorakhpur
  { id: 'lt-3', lat: 25.6154, lon: 85.1010, age: '1m ago' }, // Patna
  { id: 'lt-4', lat: 24.7955, lon: 84.9994, age: '3m ago' }, // Gaya
  { id: 'lt-5', lat: 23.7957, lon: 86.4304, age: '1m ago' }, // Dhanbad
  { id: 'lt-6', lat: 23.8103, lon: 90.4125, age: '2m ago' }, // Dhaka
  { id: 'lt-7', lat: 25.7439, lon: 89.2752, age: '1m ago' }, // Rangpur
  { id: 'lt-8', lat: 19.0760, lon: 72.8777, age: '4m ago' }, // Mumbai
  { id: 'lt-9', lat: 20.9980, lon: 75.5667, age: '2m ago' }, // Jalgaon
  { id: 'lt-10', lat: 21.1458, lon: 79.0882, age: '5m ago' }, // Nagpur
  { id: 'lt-11', lat: 21.2514, lon: 81.6296, age: '1m ago' }, // Raipur
  { id: 'lt-12', lat: 24.2000, lon: 82.6667, age: '3m ago' }, // Singrauli
  { id: 'lt-13', lat: 17.6868, lon: 83.2185, age: '2m ago' }, // Visakhapatnam
  { id: 'lt-14', lat: 19.8135, lon: 85.8312, age: '4m ago' }, // Puri
  { id: 'lt-15', lat: 30.3165, lon: 78.0322, age: '1m ago' }, // Dehradun Core
  { id: 'lt-16', lat: 30.7346, lon: 79.0669, age: '1m ago' }, // Kedarnath Ridge
];

// Doppler Radar Reflectivity Complexes (Multi-tier polygons & clusters)
export const RADAR_ECHO_CLUSTERS = [
  // 1. Gangetic Storm Belt (Lucknow -> Gorakhpur -> Patna -> Nepal Border)
  {
    id: 'gangetic-core',
    name: 'Gangetic Convective Front',
    outer: [
      [27.6, 79.8], [27.9, 81.5], [27.4, 83.8], [26.2, 85.5], 
      [25.3, 84.8], [25.4, 82.2], [26.3, 80.2]
    ],
    mid: [
      [27.4, 80.4], [27.6, 81.8], [27.1, 83.5], [26.0, 84.8],
      [25.6, 82.8], [26.5, 80.8]
    ],
    inner: [
      [27.2, 80.8], [27.4, 81.6], [26.9, 82.8], [26.2, 83.8],
      [25.9, 82.4], [26.6, 81.2]
    ],
    severe: [
      [27.0, 81.1], [27.2, 81.5], [26.7, 82.2], [26.5, 81.4]
    ]
  },
  // 2. Northeast Bengal / Bangladesh Squall Line (Rangpur -> Dhaka -> Kolkata)
  {
    id: 'bengal-squall',
    name: 'Bengal / Bangladesh Squall Line',
    outer: [
      [26.2, 88.5], [25.8, 90.5], [24.8, 91.2], [23.5, 90.8],
      [22.4, 89.2], [22.6, 87.8], [24.0, 88.2], [25.5, 88.0]
    ],
    mid: [
      [25.9, 88.9], [25.5, 90.2], [24.4, 90.8], [23.2, 90.2],
      [22.8, 88.4], [24.2, 88.6], [25.3, 88.4]
    ],
    inner: [
      [25.6, 89.2], [25.2, 89.8], [24.0, 90.2], [23.4, 89.5],
      [23.2, 88.8], [24.8, 88.8]
    ],
    severe: [
      [25.4, 89.4], [25.0, 89.7], [24.2, 89.9], [23.8, 89.2]
    ]
  },
  // 3. Mumbai & Coastal Konkan Cell
  {
    id: 'mumbai-cell',
    name: 'Mumbai Coastal Convective Band',
    outer: [
      [19.4, 72.4], [19.5, 73.4], [18.7, 73.5], [18.6, 72.5]
    ],
    mid: [
      [19.3, 72.6], [19.3, 73.2], [18.8, 73.3], [18.8, 72.7]
    ],
    inner: [
      [19.2, 72.8], [19.1, 73.1], [18.9, 73.1], [18.9, 72.8]
    ],
    severe: [
      [19.1, 72.85], [19.05, 73.0], [18.95, 72.95]
    ]
  },
  // 4. Central India Scattered Clusters (Nagpur, Raipur, Bilaspur)
  {
    id: 'central-cells',
    name: 'Central Ridge Convection',
    outer: [
      [22.2, 80.5], [22.4, 82.5], [21.5, 83.2], [20.8, 81.8], [21.0, 80.2]
    ],
    mid: [
      [22.0, 81.0], [22.1, 82.2], [21.3, 82.8], [21.0, 81.5]
    ],
    inner: [
      [21.8, 81.4], [21.9, 82.0], [21.4, 82.2], [21.2, 81.6]
    ]
  },
  // 5. Himalayan Garhwal Cloudburst Core (Dehradun, Kedarnath)
  {
    id: 'garhwal-core',
    name: 'Garhwal Cloudburst Core',
    outer: [
      [30.9, 77.8], [31.1, 79.3], [30.4, 79.5], [30.0, 78.2]
    ],
    mid: [
      [30.7, 78.0], [30.9, 79.1], [30.3, 79.2], [30.1, 78.3]
    ],
    inner: [
      [30.5, 78.1], [30.7, 78.9], [30.3, 78.9], [30.2, 78.3]
    ],
    severe: [
      [30.4, 78.2], [30.5, 78.6], [30.3, 78.6], [30.25, 78.3]
    ]
  }
];

export const STATIONS_DATA = {
  dehradun: {
    key: "dehradun",
    stationId: "UK-DDN-01",
    stationName: "Dehradun / Garhwal Sector",
    region: "Uttarakhand, Garhwal Himalaya",
    coordinates: [30.3165, 78.0322],
    elevation: 1850,
    riskLevel: "HIGH",
    riskProbability: 89,
    forecastWindow: "Next 1–2 Hours",
    alertType: "Severe Convective Cloudburst Alert",
    modelEngine: "XGBoost + LSTM Ensemble",
    condition: "Violent Thunderstorm & Torrential Downpour",
    icon: "CloudLightning",

    primaryMetrics: {
      temperature: { value: 21.4, unit: "°C", feelsLike: 23.1 },
      rainfallRate: { value: 94.5, unit: "mm/h", status: "Critical Spurt" },
      atmosphericPressure: { value: 991.2, unit: "hPa", status: "Falling Fast" },
      pressureTendency: { value: -6.4, unit: "hPa/3h", status: "Severe Barometric Crash" },
      relativeHumidity: { value: 97, unit: "%", status: "Near Saturation" },
      dewPoint: { value: 20.8, unit: "°C" },
      windSpeed: { value: 48, unit: "km/h", gust: 74 },
      windDirection: { value: "NE (45°)", deg: 45 },
      cloudCover: { value: 98, unit: "%" },
      aqi: { value: 38, label: "Good", pm25: 9.4 },
      visibility: { value: 1.2, unit: "km" }
    },

    advancedMetrics: {
      radarReflectivity: { value: 58.4, unit: "dBZ", status: "Extreme Convection" },
      echoTopHeight: { value: 15.6, unit: "km" },
      cloudTopTemp: { value: -72.0, unit: "°C", status: "Overshooting Cumulonimbus Top" },
      cape: { value: 2850, unit: "J/kg", status: "Extremely Unstable Air Mass" },
      cin: { value: 8, unit: "J/kg", status: "Cap Destroyed" },
      historicalAnomaly: { value: "+380%", baseline: "Monsoon August Avg" },
      verticallyIntegratedLiquid: { value: 68, unit: "kg/m²" },
      liftedIndex: { value: -7.8, unit: "°C", status: "Violently Unstable" }
    },

    timeSeries: [
      { time: "12:00", label: "12:00", pressure: 1010.2, humidity: 71, rainRate: 2.1, temp: 28.5, windSpeed: 16, windDeg: 60, cape: 1400, radarDbz: 22, cloudCover: 65, aqi: 48 },
      { time: "13:00", label: "13:00", pressure: 1008.0, humidity: 75, rainRate: 6.4, temp: 27.2, windSpeed: 22, windDeg: 55, cape: 1850, radarDbz: 34, cloudCover: 80, aqi: 46 },
      { time: "14:00", label: "14:00", pressure: 1003.5, humidity: 84, rainRate: 24.8, temp: 25.1, windSpeed: 34, windDeg: 50, cape: 2300, radarDbz: 46, cloudCover: 92, aqi: 44 },
      { time: "15:00", label: "15:00", pressure: 996.1, humidity: 93, rainRate: 62.0, temp: 22.8, windSpeed: 42, windDeg: 45, cape: 2650, radarDbz: 54, cloudCover: 96, aqi: 41 },
      { time: "16:00", label: "16:00", pressure: 991.2, humidity: 97, rainRate: 94.5, temp: 21.4, windSpeed: 48, windDeg: 45, cape: 2850, radarDbz: 58.4, cloudCover: 98, aqi: 38 },
      { time: "17:00", label: "17:00", pressure: 994.0, humidity: 96, rainRate: 78.0, temp: 21.0, windSpeed: 44, windDeg: 40, cape: 2400, radarDbz: 52, cloudCover: 98, aqi: 36 },
      { time: "18:00", label: "18:00", pressure: 998.4, humidity: 94, rainRate: 41.5, temp: 20.8, windSpeed: 32, windDeg: 35, cape: 1900, radarDbz: 42, cloudCover: 94, aqi: 35 },
      { time: "21:00", label: "21:00", pressure: 1004.1, humidity: 89, rainRate: 14.0, temp: 19.5, windSpeed: 18, windDeg: 30, cape: 1100, radarDbz: 28, cloudCover: 85, aqi: 34 },
      { time: "00:00", label: "00:00", pressure: 1007.2, humidity: 85, rainRate: 5.2, temp: 18.9, windSpeed: 12, windDeg: 25, cape: 650, radarDbz: 18, cloudCover: 70, aqi: 33 },
      { time: "06:00", label: "06:00", pressure: 1009.5, humidity: 80, rainRate: 1.0, temp: 18.2, windSpeed: 10, windDeg: 20, cape: 400, radarDbz: 12, cloudCover: 55, aqi: 32 },
      { time: "12:00+1", label: "12:00", pressure: 1011.0, humidity: 68, rainRate: 0.0, temp: 27.0, windSpeed: 14, windDeg: 70, cape: 800, radarDbz: 8, cloudCover: 40, aqi: 40 },
      { time: "18:00+1", label: "18:00", pressure: 1008.5, humidity: 72, rainRate: 3.5, temp: 24.2, windSpeed: 16, windDeg: 65, cape: 1100, radarDbz: 20, cloudCover: 60, aqi: 42 },
      { time: "12:00+2", label: "Wed", pressure: 1012.0, humidity: 62, rainRate: 0.0, temp: 28.1, windSpeed: 12, windDeg: 80, cape: 600, radarDbz: 5, cloudCover: 30, aqi: 45 },
      { time: "12:00+3", label: "Thu", pressure: 1013.4, humidity: 58, rainRate: 0.0, temp: 29.0, windSpeed: 11, windDeg: 90, cape: 450, radarDbz: 0, cloudCover: 25, aqi: 48 },
    ],

    hourlyForecast: [
      { time: "15:00", temp: 22.8, pop: 95, rain: 62.0, wind: 42, icon: "CloudLightning", cloud: 96 },
      { time: "16:00", temp: 21.4, pop: 100, rain: 94.5, wind: 48, icon: "CloudLightning", cloud: 98 },
      { time: "17:00", temp: 21.0, pop: 95, rain: 78.0, wind: 44, icon: "CloudRain", cloud: 98 },
      { time: "18:00", temp: 20.8, pop: 85, rain: 41.5, wind: 32, icon: "CloudRain", cloud: 94 },
      { time: "19:00", temp: 20.2, pop: 70, rain: 26.0, wind: 24, icon: "CloudDrizzle", cloud: 90 },
      { time: "20:00", temp: 19.8, pop: 60, rain: 18.0, wind: 20, icon: "CloudDrizzle", cloud: 88 },
      { time: "21:00", temp: 19.5, pop: 45, rain: 14.0, wind: 18, icon: "Cloud", cloud: 85 },
      { time: "22:00", temp: 19.2, pop: 30, rain: 8.0, wind: 15, icon: "Cloud", cloud: 78 },
    ]
  },

  kedarnath: {
    key: "kedarnath",
    stationId: "UK-KED-07",
    stationName: "Kedarnath Valley Shrine",
    region: "Rudraprayag, High Himalayas",
    coordinates: [30.7346, 79.0669],
    elevation: 3583,
    riskLevel: "HIGH",
    riskProbability: 84,
    forecastWindow: "Next 1–3 Hours",
    alertType: "Glacial Valley Torrent & Debris Flow Risk",
    modelEngine: "XGBoost Convective Ridge AI",
    condition: "High Altitude Hailstorm & Torrential Spurt",
    icon: "CloudHail",

    primaryMetrics: {
      temperature: { value: 8.6, unit: "°C", feelsLike: 4.2 },
      rainfallRate: { value: 68.0, unit: "mm/h", status: "Violent Spurt" },
      atmosphericPressure: { value: 668.5, unit: "hPa", status: "Critical Alpine Drop" },
      pressureTendency: { value: -5.1, unit: "hPa/3h", status: "Severe Drop" },
      relativeHumidity: { value: 99, unit: "%", status: "Supersaturated" },
      dewPoint: { value: 8.4, unit: "°C" },
      windSpeed: { value: 56, unit: "km/h", gust: 88 },
      windDirection: { value: "NNE (25°)", deg: 25 },
      cloudCover: { value: 100, unit: "%" },
      aqi: { value: 14, label: "Pristine", pm25: 3.2 },
      visibility: { value: 0.4, unit: "km" }
    },

    advancedMetrics: {
      radarReflectivity: { value: 52.8, unit: "dBZ", status: "Intense Orographic Cell" },
      echoTopHeight: { value: 16.2, unit: "km" },
      cloudTopTemp: { value: -78.4, unit: "°C", status: "Deep Penetrating Anvil" },
      cape: { value: 2100, unit: "J/kg", status: "Severe Orographic Lift" },
      cin: { value: 4, unit: "J/kg", status: "Zero Cap" },
      historicalAnomaly: { value: "+295%", baseline: "August Alpine Mean" },
      verticallyIntegratedLiquid: { value: 72, unit: "kg/m²" },
      liftedIndex: { value: -6.4, unit: "°C", status: "High Instability" }
    },

    timeSeries: [
      { time: "12:00", label: "12:00", pressure: 676.0, humidity: 82, rainRate: 4.0, temp: 13.0, windSpeed: 20, windDeg: 40, cape: 900, radarDbz: 18, cloudCover: 75, aqi: 15 },
      { time: "13:00", label: "13:00", pressure: 673.8, humidity: 88, rainRate: 14.5, temp: 11.8, windSpeed: 28, windDeg: 35, cape: 1350, radarDbz: 29, cloudCover: 88, aqi: 15 },
      { time: "14:00", label: "14:00", pressure: 671.2, humidity: 95, rainRate: 36.0, temp: 10.2, windSpeed: 42, windDeg: 30, cape: 1800, radarDbz: 44, cloudCover: 98, aqi: 14 },
      { time: "15:00", label: "15:00", pressure: 669.8, humidity: 98, rainRate: 54.0, temp: 9.1, windSpeed: 50, windDeg: 28, cape: 2050, radarDbz: 49, cloudCover: 100, aqi: 14 },
      { time: "16:00", label: "16:00", pressure: 668.5, humidity: 99, rainRate: 68.0, temp: 8.6, windSpeed: 56, windDeg: 25, cape: 2100, radarDbz: 52.8, cloudCover: 100, aqi: 14 },
      { time: "17:00", label: "17:00", pressure: 670.0, humidity: 98, rainRate: 52.0, temp: 8.2, windSpeed: 48, windDeg: 25, cape: 1750, radarDbz: 46, cloudCover: 100, aqi: 14 },
      { time: "18:00", label: "18:00", pressure: 672.4, humidity: 95, rainRate: 28.0, temp: 7.8, windSpeed: 36, windDeg: 20, cape: 1300, radarDbz: 35, cloudCover: 95, aqi: 14 },
      { time: "21:00", label: "21:00", pressure: 674.8, humidity: 90, rainRate: 8.4, temp: 6.5, windSpeed: 22, windDeg: 15, cape: 700, radarDbz: 22, cloudCover: 80, aqi: 14 },
      { time: "00:00", label: "00:00", pressure: 676.2, humidity: 86, rainRate: 2.0, temp: 5.2, windSpeed: 16, windDeg: 10, cape: 350, radarDbz: 14, cloudCover: 65, aqi: 14 },
      { time: "06:00", label: "06:00", pressure: 677.0, humidity: 80, rainRate: 0.0, temp: 4.8, windSpeed: 12, windDeg: 5, cape: 200, radarDbz: 8, cloudCover: 45, aqi: 14 },
      { time: "12:00+1", label: "12:00", pressure: 678.0, humidity: 70, rainRate: 0.0, temp: 12.5, windSpeed: 14, windDeg: 40, cape: 500, radarDbz: 5, cloudCover: 35, aqi: 15 },
      { time: "18:00+1", label: "18:00", pressure: 675.2, humidity: 76, rainRate: 5.0, temp: 10.0, windSpeed: 20, windDeg: 35, cape: 850, radarDbz: 20, cloudCover: 60, aqi: 15 },
      { time: "12:00+2", label: "Wed", pressure: 679.0, humidity: 60, rainRate: 0.0, temp: 13.8, windSpeed: 12, windDeg: 50, cape: 400, radarDbz: 0, cloudCover: 20, aqi: 15 },
      { time: "12:00+3", label: "Thu", pressure: 680.0, humidity: 55, rainRate: 0.0, temp: 14.2, windSpeed: 10, windDeg: 60, cape: 300, radarDbz: 0, cloudCover: 15, aqi: 16 },
    ],

    hourlyForecast: [
      { time: "15:00", temp: 9.1, pop: 90, rain: 54.0, wind: 50, icon: "CloudHail", cloud: 100 },
      { time: "16:00", temp: 8.6, pop: 98, rain: 68.0, wind: 56, icon: "CloudHail", cloud: 100 },
      { time: "17:00", temp: 8.2, pop: 92, rain: 52.0, wind: 48, icon: "CloudRain", cloud: 100 },
      { time: "18:00", temp: 7.8, pop: 80, rain: 28.0, wind: 36, icon: "CloudRain", cloud: 95 },
      { time: "19:00", temp: 7.2, pop: 65, rain: 16.0, wind: 28, icon: "CloudDrizzle", cloud: 90 },
      { time: "20:00", temp: 6.8, pop: 50, rain: 11.0, wind: 24, icon: "Cloud", cloud: 85 },
      { time: "21:00", temp: 6.5, pop: 35, rain: 8.4, wind: 22, icon: "Cloud", cloud: 80 },
      { time: "22:00", temp: 6.0, pop: 20, rain: 4.0, wind: 18, icon: "CloudSun", cloud: 70 },
    ]
  },

  shimla: {
    key: "shimla",
    stationId: "HP-SML-02",
    stationName: "Shimla Central Ridge",
    region: "Himachal Pradesh, Middle Himalaya",
    coordinates: [31.1048, 77.1734],
    elevation: 2205,
    riskLevel: "MODERATE",
    riskProbability: 58,
    forecastWindow: "Next 3–4 Hours",
    alertType: "Moderate Thunderstorm & Flash Slope Alert",
    modelEngine: "Random Forest + Ensemble",
    condition: "Scattered Convective Rain & Fog",
    icon: "CloudRain",

    primaryMetrics: {
      temperature: { value: 18.5, unit: "°C", feelsLike: 18.8 },
      rainfallRate: { value: 38.0, unit: "mm/h", status: "Moderate Rain" },
      atmosphericPressure: { value: 1002.5, unit: "hPa", status: "Slowly Falling" },
      pressureTendency: { value: -2.1, unit: "hPa/3h", status: "Moderate Drop" },
      relativeHumidity: { value: 84, unit: "%", status: "Elevated" },
      dewPoint: { value: 15.6, unit: "°C" },
      windSpeed: { value: 26, unit: "km/h", gust: 42 },
      windDirection: { value: "NW (315°)", deg: 315 },
      cloudCover: { value: 78, unit: "%" },
      aqi: { value: 35, label: "Good", pm25: 8.5 },
      visibility: { value: 3.5, unit: "km" }
    },

    advancedMetrics: {
      radarReflectivity: { value: 38.0, unit: "dBZ", status: "Moderate Convection" },
      echoTopHeight: { value: 9.2, unit: "km" },
      cloudTopTemp: { value: -42.0, unit: "°C", status: "Developing Cumulus" },
      cape: { value: 1200, unit: "J/kg", status: "Moderately Unstable" },
      cin: { value: 45, unit: "J/kg", status: "Moderate Cap" },
      historicalAnomaly: { value: "+75%", baseline: "Monsoon August Avg" },
      verticallyIntegratedLiquid: { value: 32, unit: "kg/m²" },
      liftedIndex: { value: -3.2, unit: "°C", status: "Moderate Instability" }
    },

    timeSeries: [
      { time: "12:00", label: "12:00", pressure: 1007.5, humidity: 72, rainRate: 2.0, temp: 21.0, windSpeed: 14, windDeg: 300, cape: 750, radarDbz: 15, cloudCover: 55, aqi: 38 },
      { time: "13:00", label: "13:00", pressure: 1006.0, humidity: 76, rainRate: 8.0, temp: 20.0, windSpeed: 18, windDeg: 305, cape: 920, radarDbz: 22, cloudCover: 65, aqi: 36 },
      { time: "14:00", label: "14:00", pressure: 1004.2, humidity: 80, rainRate: 22.0, temp: 19.2, windSpeed: 22, windDeg: 310, cape: 1100, radarDbz: 32, cloudCover: 72, aqi: 35 },
      { time: "15:00", label: "15:00", pressure: 1003.0, humidity: 83, rainRate: 31.0, temp: 18.8, windSpeed: 25, windDeg: 315, cape: 1180, radarDbz: 36, cloudCover: 76, aqi: 35 },
      { time: "16:00", label: "16:00", pressure: 1002.5, humidity: 84, rainRate: 38.0, temp: 18.5, windSpeed: 26, windDeg: 315, cape: 1200, radarDbz: 38.0, cloudCover: 78, aqi: 35 },
      { time: "17:00", label: "17:00", pressure: 1003.2, humidity: 83, rainRate: 28.0, temp: 18.0, windSpeed: 24, windDeg: 310, cape: 1050, radarDbz: 34, cloudCover: 75, aqi: 35 },
      { time: "18:00", label: "18:00", pressure: 1004.5, humidity: 81, rainRate: 16.0, temp: 17.5, windSpeed: 20, windDeg: 300, cape: 880, radarDbz: 28, cloudCover: 70, aqi: 34 },
      { time: "21:00", label: "21:00", pressure: 1006.8, humidity: 77, rainRate: 6.0, temp: 16.2, windSpeed: 15, windDeg: 290, cape: 550, radarDbz: 18, cloudCover: 60, aqi: 34 },
      { time: "00:00", label: "00:00", pressure: 1008.2, humidity: 74, rainRate: 1.5, temp: 15.4, windSpeed: 12, windDeg: 280, cape: 300, radarDbz: 10, cloudCover: 50, aqi: 33 },
      { time: "06:00", label: "06:00", pressure: 1009.6, humidity: 70, rainRate: 0.0, temp: 14.8, windSpeed: 10, windDeg: 270, cape: 180, radarDbz: 5, cloudCover: 35, aqi: 33 },
      { time: "12:00+1", label: "12:00", pressure: 1010.5, humidity: 62, rainRate: 0.0, temp: 22.0, windSpeed: 12, windDeg: 300, cape: 450, radarDbz: 4, cloudCover: 30, aqi: 36 },
      { time: "18:00+1", label: "18:00", pressure: 1008.8, humidity: 68, rainRate: 4.0, temp: 19.5, windSpeed: 16, windDeg: 310, cape: 700, radarDbz: 18, cloudCover: 50, aqi: 38 },
      { time: "12:00+2", label: "Wed", pressure: 1011.5, humidity: 55, rainRate: 0.0, temp: 23.2, windSpeed: 10, windDeg: 320, cape: 350, radarDbz: 0, cloudCover: 20, aqi: 40 },
      { time: "12:00+3", label: "Thu", pressure: 1012.8, humidity: 52, rainRate: 0.0, temp: 24.0, windSpeed: 9, windDeg: 330, cape: 280, radarDbz: 0, cloudCover: 15, aqi: 42 },
    ],

    hourlyForecast: [
      { time: "15:00", temp: 18.8, pop: 70, rain: 31.0, wind: 25, icon: "CloudRain", cloud: 76 },
      { time: "16:00", temp: 18.5, pop: 80, rain: 38.0, wind: 26, icon: "CloudRain", cloud: 78 },
      { time: "17:00", temp: 18.0, pop: 75, rain: 28.0, wind: 24, icon: "CloudRain", cloud: 75 },
      { time: "18:00", temp: 17.5, pop: 60, rain: 16.0, wind: 20, icon: "CloudDrizzle", cloud: 70 },
      { time: "19:00", temp: 17.0, pop: 45, rain: 10.0, wind: 17, icon: "CloudDrizzle", cloud: 65 },
      { time: "20:00", temp: 16.6, pop: 35, rain: 7.5, wind: 15, icon: "Cloud", cloud: 62 },
      { time: "21:00", temp: 16.2, pop: 25, rain: 6.0, wind: 15, icon: "Cloud", cloud: 60 },
      { time: "22:00", temp: 15.8, pop: 15, rain: 3.0, wind: 13, icon: "CloudSun", cloud: 52 },
    ]
  },

  dharamshala: {
    key: "dharamshala",
    stationId: "HP-DHA-05",
    stationName: "Dharamshala / Kangra Basin",
    region: "Himachal Pradesh, Dhauladhar Range",
    coordinates: [32.2190, 76.3234],
    elevation: 1457,
    riskLevel: "MODERATE",
    riskProbability: 64,
    forecastWindow: "Next 2–3 Hours",
    alertType: "Orographic Convective Precipitation Surge",
    modelEngine: "XGBoost Dhauladhar Model",
    condition: "Heavy Showers with Gusty Mountain Wind",
    icon: "CloudRain",

    primaryMetrics: {
      temperature: { value: 22.8, unit: "°C", feelsLike: 24.0 },
      rainfallRate: { value: 44.5, unit: "mm/h", status: "Heavy Rain" },
      atmosphericPressure: { value: 998.0, unit: "hPa", status: "Falling" },
      pressureTendency: { value: -3.4, unit: "hPa/3h", status: "Notable Drop" },
      relativeHumidity: { value: 91, unit: "%", status: "High" },
      dewPoint: { value: 21.2, unit: "°C" },
      windSpeed: { value: 34, unit: "km/h", gust: 55 },
      windDirection: { value: "SW (225°)", deg: 225 },
      cloudCover: { value: 88, unit: "%" },
      aqi: { value: 28, label: "Good", pm25: 6.8 },
      visibility: { value: 2.8, unit: "km" }
    },

    advancedMetrics: {
      radarReflectivity: { value: 44.2, unit: "dBZ", status: "Intense Orographic Uplift" },
      echoTopHeight: { value: 11.5, unit: "km" },
      cloudTopTemp: { value: -54.0, unit: "°C", status: "Towering Cumulus" },
      cape: { value: 1650, unit: "J/kg", status: "Unstable Air Mass" },
      cin: { value: 20, unit: "J/kg", status: "Weak Cap" },
      historicalAnomaly: { value: "+115%", baseline: "Monsoon August Avg" },
      verticallyIntegratedLiquid: { value: 44, unit: "kg/m²" },
      liftedIndex: { value: -4.5, unit: "°C", status: "Unstable" }
    },

    timeSeries: [
      { time: "12:00", label: "12:00", pressure: 1004.0, humidity: 78, rainRate: 6.0, temp: 26.0, windSpeed: 18, windDeg: 210, cape: 1050, radarDbz: 20, cloudCover: 68, aqi: 30 },
      { time: "13:00", label: "13:00", pressure: 1002.1, humidity: 82, rainRate: 15.0, temp: 24.8, windSpeed: 24, windDeg: 215, cape: 1250, radarDbz: 28, cloudCover: 76, aqi: 29 },
      { time: "14:00", label: "14:00", pressure: 1000.0, humidity: 86, rainRate: 28.0, temp: 23.9, windSpeed: 28, windDeg: 220, cape: 1450, radarDbz: 36, cloudCover: 82, aqi: 28 },
      { time: "15:00", label: "15:00", pressure: 998.8, humidity: 89, rainRate: 38.0, temp: 23.2, windSpeed: 32, windDeg: 225, cape: 1580, radarDbz: 41, cloudCover: 86, aqi: 28 },
      { time: "16:00", label: "16:00", pressure: 998.0, humidity: 91, rainRate: 44.5, temp: 22.8, windSpeed: 34, windDeg: 225, cape: 1650, radarDbz: 44.2, cloudCover: 88, aqi: 28 },
      { time: "17:00", label: "17:00", pressure: 999.2, humidity: 90, rainRate: 36.0, temp: 22.4, windSpeed: 30, windDeg: 220, cape: 1480, radarDbz: 38, cloudCover: 85, aqi: 28 },
      { time: "18:00", label: "18:00", pressure: 1001.0, humidity: 87, rainRate: 22.0, temp: 21.8, windSpeed: 24, windDeg: 215, cape: 1200, radarDbz: 30, cloudCover: 80, aqi: 28 },
      { time: "21:00", label: "21:00", pressure: 1003.5, humidity: 82, rainRate: 8.0, temp: 20.5, windSpeed: 18, windDeg: 200, cape: 780, radarDbz: 20, cloudCover: 70, aqi: 27 },
      { time: "00:00", label: "00:00", pressure: 1005.0, humidity: 78, rainRate: 2.0, temp: 19.8, windSpeed: 14, windDeg: 190, cape: 420, radarDbz: 12, cloudCover: 58, aqi: 27 },
      { time: "06:00", label: "06:00", pressure: 1006.5, humidity: 72, rainRate: 0.0, temp: 19.0, windSpeed: 12, windDeg: 180, cape: 260, radarDbz: 6, cloudCover: 40, aqi: 28 },
      { time: "12:00+1", label: "12:00", pressure: 1007.8, humidity: 65, rainRate: 0.0, temp: 27.2, windSpeed: 15, windDeg: 210, cape: 600, radarDbz: 4, cloudCover: 35, aqi: 32 },
      { time: "18:00+1", label: "18:00", pressure: 1005.5, humidity: 71, rainRate: 6.0, temp: 24.0, windSpeed: 18, windDeg: 220, cape: 880, radarDbz: 22, cloudCover: 55, aqi: 34 },
      { time: "12:00+2", label: "Wed", pressure: 1009.0, humidity: 58, rainRate: 0.0, temp: 28.5, windSpeed: 12, windDeg: 230, cape: 450, radarDbz: 0, cloudCover: 25, aqi: 36 },
      { time: "12:00+3", label: "Thu", pressure: 1010.2, humidity: 54, rainRate: 0.0, temp: 29.2, windSpeed: 11, windDeg: 240, cape: 350, radarDbz: 0, cloudCover: 20, aqi: 38 },
    ],

    hourlyForecast: [
      { time: "15:00", temp: 23.2, pop: 85, rain: 38.0, wind: 32, icon: "CloudRain", cloud: 86 },
      { time: "16:00", temp: 22.8, pop: 90, rain: 44.5, wind: 34, icon: "CloudRain", cloud: 88 },
      { time: "17:00", temp: 22.4, pop: 85, rain: 36.0, wind: 30, icon: "CloudRain", cloud: 85 },
      { time: "18:00", temp: 21.8, pop: 70, rain: 22.0, wind: 24, icon: "CloudRain", cloud: 80 },
      { time: "19:00", temp: 21.2, pop: 55, rain: 14.0, wind: 20, icon: "CloudDrizzle", cloud: 75 },
      { time: "20:00", temp: 20.8, pop: 45, rain: 10.0, wind: 19, icon: "CloudDrizzle", cloud: 72 },
      { time: "21:00", temp: 20.5, pop: 30, rain: 8.0, wind: 18, icon: "Cloud", cloud: 70 },
      { time: "22:00", temp: 20.1, pop: 20, rain: 4.0, wind: 15, icon: "CloudSun", cloud: 60 },
    ]
  },

  nainital: {
    key: "nainital",
    stationId: "UK-NTL-04",
    stationName: "Nainital Lake Basin",
    region: "Uttarakhand, Kumaon Himalaya",
    coordinates: [29.3919, 79.4542],
    elevation: 2084,
    riskLevel: "MODERATE",
    riskProbability: 52,
    forecastWindow: "Next 3–5 Hours",
    alertType: "Catchment Saturation & Slope Runoff Watch",
    modelEngine: "Kumaon Convective AI",
    condition: "Intermittent Heavy Rain & Dense Mist",
    icon: "CloudRain",

    primaryMetrics: {
      temperature: { value: 19.2, unit: "°C", feelsLike: 19.5 },
      rainfallRate: { value: 32.4, unit: "mm/h", status: "Moderate Rain" },
      atmosphericPressure: { value: 1004.2, unit: "hPa", status: "Steady Decrease" },
      pressureTendency: { value: -1.8, unit: "hPa/3h", status: "Slow Drop" },
      relativeHumidity: { value: 89, unit: "%", status: "Elevated" },
      dewPoint: { value: 17.3, unit: "°C" },
      windSpeed: { value: 22, unit: "km/h", gust: 36 },
      windDirection: { value: "ESE (110°)", deg: 110 },
      cloudCover: { value: 82, unit: "%" },
      aqi: { value: 24, label: "Good", pm25: 5.6 },
      visibility: { value: 2.0, unit: "km" }
    },

    advancedMetrics: {
      radarReflectivity: { value: 35.8, unit: "dBZ", status: "Moderate Convective Bands" },
      echoTopHeight: { value: 8.8, unit: "km" },
      cloudTopTemp: { value: -38.5, unit: "°C", status: "Cumulonimbus Calvus" },
      cape: { value: 1050, unit: "J/kg", status: "Moderately Unstable" },
      cin: { value: 35, unit: "J/kg", status: "Moderate Cap" },
      historicalAnomaly: { value: "+45%", baseline: "Monsoon August Avg" },
      verticallyIntegratedLiquid: { value: 28, unit: "kg/m²" },
      liftedIndex: { value: -2.8, unit: "°C", status: "Moderate" }
    },

    timeSeries: [
      { time: "12:00", label: "12:00", pressure: 1008.0, humidity: 76, rainRate: 3.0, temp: 22.5, windSpeed: 12, windDeg: 100, cape: 650, radarDbz: 14, cloudCover: 60, aqi: 26 },
      { time: "13:00", label: "13:00", pressure: 1007.0, humidity: 80, rainRate: 8.5, temp: 21.2, windSpeed: 16, windDeg: 105, cape: 800, radarDbz: 20, cloudCover: 70, aqi: 25 },
      { time: "14:00", label: "14:00", pressure: 1005.5, humidity: 85, rainRate: 18.0, temp: 20.1, windSpeed: 19, windDeg: 110, cape: 950, radarDbz: 28, cloudCover: 78, aqi: 25 },
      { time: "15:00", label: "15:00", pressure: 1004.8, humidity: 88, rainRate: 26.0, temp: 19.6, windSpeed: 21, windDeg: 110, cape: 1020, radarDbz: 32, cloudCover: 80, aqi: 24 },
      { time: "16:00", label: "16:00", pressure: 1004.2, humidity: 89, rainRate: 32.4, temp: 19.2, windSpeed: 22, windDeg: 110, cape: 1050, radarDbz: 35.8, cloudCover: 82, aqi: 24 },
      { time: "17:00", label: "17:00", pressure: 1004.9, humidity: 88, rainRate: 24.0, temp: 18.9, windSpeed: 20, windDeg: 105, cape: 920, radarDbz: 30, cloudCover: 80, aqi: 24 },
      { time: "18:00", label: "18:00", pressure: 1006.0, humidity: 86, rainRate: 14.0, temp: 18.4, windSpeed: 17, windDeg: 100, cape: 750, radarDbz: 24, cloudCover: 75, aqi: 24 },
      { time: "21:00", label: "21:00", pressure: 1008.0, humidity: 81, rainRate: 5.0, temp: 17.2, windSpeed: 13, windDeg: 90, cape: 480, radarDbz: 16, cloudCover: 65, aqi: 24 },
      { time: "00:00", label: "00:00", pressure: 1009.2, humidity: 78, rainRate: 1.0, temp: 16.5, windSpeed: 10, windDeg: 80, cape: 280, radarDbz: 8, cloudCover: 55, aqi: 24 },
      { time: "06:00", label: "06:00", pressure: 1010.5, humidity: 72, rainRate: 0.0, temp: 15.8, windSpeed: 9, windDeg: 70, cape: 150, radarDbz: 4, cloudCover: 40, aqi: 24 },
      { time: "12:00+1", label: "12:00", pressure: 1011.8, humidity: 64, rainRate: 0.0, temp: 23.5, windSpeed: 12, windDeg: 100, cape: 400, radarDbz: 2, cloudCover: 30, aqi: 28 },
      { time: "18:00+1", label: "18:00", pressure: 1009.5, humidity: 70, rainRate: 3.5, temp: 20.8, windSpeed: 15, windDeg: 110, cape: 650, radarDbz: 16, cloudCover: 50, aqi: 30 },
      { time: "12:00+2", label: "Wed", pressure: 1013.0, humidity: 55, rainRate: 0.0, temp: 24.6, windSpeed: 10, windDeg: 120, cape: 300, radarDbz: 0, cloudCover: 20, aqi: 32 },
      { time: "12:00+3", label: "Thu", pressure: 1014.2, humidity: 50, rainRate: 0.0, temp: 25.4, windSpeed: 9, windDeg: 130, cape: 220, radarDbz: 0, cloudCover: 15, aqi: 34 },
    ],

    hourlyForecast: [
      { time: "15:00", temp: 19.6, pop: 65, rain: 26.0, wind: 21, icon: "CloudRain", cloud: 80 },
      { time: "16:00", temp: 19.2, pop: 75, rain: 32.4, wind: 22, icon: "CloudRain", cloud: 82 },
      { time: "17:00", temp: 18.9, pop: 70, rain: 24.0, wind: 20, icon: "CloudRain", cloud: 80 },
      { time: "18:00", temp: 18.4, pop: 55, rain: 14.0, wind: 17, icon: "CloudDrizzle", cloud: 75 },
      { time: "19:00", temp: 17.9, pop: 40, rain: 9.0, wind: 15, icon: "CloudDrizzle", cloud: 70 },
      { time: "20:00", temp: 17.5, pop: 30, rain: 6.5, wind: 14, icon: "Cloud", cloud: 68 },
      { time: "21:00", temp: 17.2, pop: 20, rain: 5.0, wind: 13, icon: "Cloud", cloud: 65 },
      { time: "22:00", temp: 16.8, pop: 10, rain: 2.0, wind: 11, icon: "CloudSun", cloud: 55 },
    ]
  },

  rishikesh: {
    key: "rishikesh",
    stationId: "UK-RSK-03",
    stationName: "Rishikesh Ganga Foothills",
    region: "Uttarakhand, Shivalik Foothills",
    coordinates: [30.0869, 78.2676],
    elevation: 372,
    riskLevel: "MODERATE",
    riskProbability: 46,
    forecastWindow: "Next 4–6 Hours",
    alertType: "Riverbank Spurt & Upstream Surge Advisory",
    modelEngine: "Hydrological Runoff AI",
    condition: "Passing Rain Showers & Humid Breeze",
    icon: "CloudRain",

    primaryMetrics: {
      temperature: { value: 27.5, unit: "°C", feelsLike: 30.2 },
      rainfallRate: { value: 22.0, unit: "mm/h", status: "Passing Showers" },
      atmosphericPressure: { value: 1006.8, unit: "hPa", status: "Slowly Dipping" },
      pressureTendency: { value: -1.4, unit: "hPa/3h", status: "Mild Drop" },
      relativeHumidity: { value: 85, unit: "%", status: "High" },
      dewPoint: { value: 24.8, unit: "°C" },
      windSpeed: { value: 20, unit: "km/h", gust: 32 },
      windDirection: { value: "ENE (65°)", deg: 65 },
      cloudCover: { value: 74, unit: "%" },
      aqi: { value: 48, label: "Good", pm25: 12.0 },
      visibility: { value: 5.0, unit: "km" }
    },

    advancedMetrics: {
      radarReflectivity: { value: 31.5, unit: "dBZ", status: "Developing Upstream Plume" },
      echoTopHeight: { value: 7.6, unit: "km" },
      cloudTopTemp: { value: -32.0, unit: "°C", status: "Cumulus Congestus" },
      cape: { value: 1150, unit: "J/kg", status: "Moderately Unstable" },
      cin: { value: 55, unit: "J/kg", status: "Moderate Cap" },
      historicalAnomaly: { value: "+28%", baseline: "Monsoon August Avg" },
      verticallyIntegratedLiquid: { value: 24, unit: "kg/m²" },
      liftedIndex: { value: -2.4, unit: "°C", status: "Slight Instability" }
    },

    timeSeries: [
      { time: "12:00", label: "12:00", pressure: 1010.0, humidity: 74, rainRate: 1.0, temp: 31.0, windSpeed: 12, windDeg: 60, cape: 700, radarDbz: 10, cloudCover: 50, aqi: 52 },
      { time: "13:00", label: "13:00", pressure: 1009.0, humidity: 78, rainRate: 4.5, temp: 29.8, windSpeed: 15, windDeg: 65, cape: 880, radarDbz: 18, cloudCover: 60, aqi: 50 },
      { time: "14:00", label: "14:00", pressure: 1007.8, humidity: 82, rainRate: 12.0, temp: 28.6, windSpeed: 18, windDeg: 65, cape: 1020, radarDbz: 25, cloudCover: 68, aqi: 49 },
      { time: "15:00", label: "15:00", pressure: 1007.1, humidity: 84, rainRate: 18.0, temp: 27.9, windSpeed: 19, windDeg: 65, cape: 1100, radarDbz: 29, cloudCover: 72, aqi: 48 },
      { time: "16:00", label: "16:00", pressure: 1006.8, humidity: 85, rainRate: 22.0, temp: 27.5, windSpeed: 20, windDeg: 65, cape: 1150, radarDbz: 31.5, cloudCover: 74, aqi: 48 },
      { time: "17:00", label: "17:00", pressure: 1007.5, humidity: 84, rainRate: 16.0, temp: 27.0, windSpeed: 18, windDeg: 60, cape: 1000, radarDbz: 26, cloudCover: 70, aqi: 48 },
      { time: "18:00", label: "18:00", pressure: 1008.5, humidity: 82, rainRate: 8.0, temp: 26.5, windSpeed: 15, windDeg: 55, cape: 820, radarDbz: 20, cloudCover: 65, aqi: 47 },
      { time: "21:00", label: "21:00", pressure: 1010.2, humidity: 79, rainRate: 2.0, temp: 25.2, windSpeed: 12, windDeg: 50, cape: 520, radarDbz: 12, cloudCover: 55, aqi: 47 },
      { time: "00:00", label: "00:00", pressure: 1011.5, humidity: 75, rainRate: 0.0, temp: 24.5, windSpeed: 10, windDeg: 45, cape: 300, radarDbz: 6, cloudCover: 45, aqi: 46 },
      { time: "06:00", label: "06:00", pressure: 1012.8, humidity: 70, rainRate: 0.0, temp: 23.8, windSpeed: 9, windDeg: 40, cape: 180, radarDbz: 2, cloudCover: 35, aqi: 46 },
      { time: "12:00+1", label: "12:00", pressure: 1013.5, humidity: 62, rainRate: 0.0, temp: 32.0, windSpeed: 12, windDeg: 60, cape: 500, radarDbz: 0, cloudCover: 25, aqi: 50 },
      { time: "18:00+1", label: "18:00", pressure: 1011.2, humidity: 68, rainRate: 2.5, temp: 29.0, windSpeed: 14, windDeg: 65, cape: 720, radarDbz: 14, cloudCover: 45, aqi: 52 },
      { time: "12:00+2", label: "Wed", pressure: 1014.2, humidity: 55, rainRate: 0.0, temp: 33.5, windSpeed: 11, windDeg: 70, cape: 400, radarDbz: 0, cloudCover: 20, aqi: 54 },
      { time: "12:00+3", label: "Thu", pressure: 1015.0, humidity: 50, rainRate: 0.0, temp: 34.2, windSpeed: 10, windDeg: 75, cape: 300, radarDbz: 0, cloudCover: 15, aqi: 56 },
    ],

    hourlyForecast: [
      { time: "15:00", temp: 27.9, pop: 55, rain: 18.0, wind: 19, icon: "CloudRain", cloud: 72 },
      { time: "16:00", temp: 27.5, pop: 65, rain: 22.0, wind: 20, icon: "CloudRain", cloud: 74 },
      { time: "17:00", temp: 27.0, pop: 60, rain: 16.0, wind: 18, icon: "CloudRain", cloud: 70 },
      { time: "18:00", temp: 26.5, pop: 45, rain: 8.0, wind: 15, icon: "CloudDrizzle", cloud: 65 },
      { time: "19:00", temp: 26.0, pop: 35, rain: 4.5, wind: 13, icon: "CloudDrizzle", cloud: 60 },
      { time: "20:00", temp: 25.6, pop: 25, rain: 2.8, wind: 12, icon: "Cloud", cloud: 58 },
      { time: "21:00", temp: 25.2, pop: 15, rain: 2.0, wind: 12, icon: "Cloud", cloud: 55 },
      { time: "22:00", temp: 24.8, pop: 10, rain: 0.5, wind: 11, icon: "CloudSun", cloud: 48 },
    ]
  },

  delhi: {
    key: "delhi",
    stationId: "DL-NCR-06",
    stationName: "NCR Regional Observatory",
    region: "Delhi / Northern Plains",
    coordinates: [28.6139, 77.2090],
    elevation: 216,
    riskLevel: "LOW",
    riskProbability: 12,
    forecastWindow: "Clear / Stable",
    alertType: "No Active Weather Alerts",
    modelEngine: "Synoptic Baseline Model",
    condition: "Hazy Sun with Warm Breeze",
    icon: "Sun",

    primaryMetrics: {
      temperature: { value: 33.2, unit: "°C", feelsLike: 38.6 },
      rainfallRate: { value: 0.0, unit: "mm/h", status: "Clear" },
      atmosphericPressure: { value: 1012.8, unit: "hPa", status: "Stable High" },
      pressureTendency: { value: +0.4, unit: "hPa/3h", status: "Steady" },
      relativeHumidity: { value: 55, unit: "%", status: "Normal" },
      dewPoint: { value: 21.0, unit: "°C" },
      windSpeed: { value: 14, unit: "km/h", gust: 22 },
      windDirection: { value: "SE (135°)", deg: 135 },
      cloudCover: { value: 25, unit: "%" },
      aqi: { value: 168, label: "Unhealthy", pm25: 88.0 },
      visibility: { value: 4.2, unit: "km" }
    },

    advancedMetrics: {
      radarReflectivity: { value: 12.0, unit: "dBZ", status: "No Significant Echoes" },
      echoTopHeight: { value: 3.5, unit: "km" },
      cloudTopTemp: { value: -12.0, unit: "°C", status: "Stratiform Layer" },
      cape: { value: 450, unit: "J/kg", status: "Stable Air Mass" },
      cin: { value: 160, unit: "J/kg", status: "Strong Inversion Cap" },
      historicalAnomaly: { value: "-15%", baseline: "Monsoon August Avg" },
      verticallyIntegratedLiquid: { value: 4, unit: "kg/m²" },
      liftedIndex: { value: +2.1, unit: "°C", status: "Stable" }
    },

    timeSeries: [
      { time: "12:00", label: "12:00", pressure: 1012.0, humidity: 52, rainRate: 0.0, temp: 34.0, windSpeed: 12, windDeg: 130, cape: 400, radarDbz: 8, cloudCover: 20, aqi: 172 },
      { time: "13:00", label: "13:00", pressure: 1012.2, humidity: 53, rainRate: 0.0, temp: 34.0, windSpeed: 13, windDeg: 135, cape: 420, radarDbz: 10, cloudCover: 22, aqi: 170 },
      { time: "14:00", label: "14:00", pressure: 1012.5, humidity: 54, rainRate: 0.0, temp: 33.5, windSpeed: 14, windDeg: 135, cape: 440, radarDbz: 11, cloudCover: 24, aqi: 169 },
      { time: "15:00", label: "15:00", pressure: 1012.6, humidity: 55, rainRate: 0.0, temp: 33.3, windSpeed: 14, windDeg: 135, cape: 450, radarDbz: 12, cloudCover: 25, aqi: 168 },
      { time: "16:00", label: "16:00", pressure: 1012.8, humidity: 55, rainRate: 0.0, temp: 33.2, windSpeed: 14, windDeg: 135, cape: 450, radarDbz: 12.0, cloudCover: 25, aqi: 168 },
      { time: "17:00", label: "17:00", pressure: 1012.9, humidity: 56, rainRate: 0.0, temp: 32.8, windSpeed: 13, windDeg: 140, cape: 420, radarDbz: 10, cloudCover: 24, aqi: 170 },
      { time: "18:00", label: "18:00", pressure: 1013.2, humidity: 58, rainRate: 0.0, temp: 31.9, windSpeed: 12, windDeg: 140, cape: 380, radarDbz: 8, cloudCover: 22, aqi: 174 },
      { time: "21:00", label: "21:00", pressure: 1014.5, humidity: 62, rainRate: 0.0, temp: 29.5, windSpeed: 10, windDeg: 145, cape: 250, radarDbz: 4, cloudCover: 18, aqi: 182 },
      { time: "00:00", label: "00:00", pressure: 1015.0, humidity: 66, rainRate: 0.0, temp: 28.0, windSpeed: 8, windDeg: 150, cape: 150, radarDbz: 0, cloudCover: 15, aqi: 190 },
      { time: "06:00", label: "06:00", pressure: 1015.8, humidity: 70, rainRate: 0.0, temp: 26.5, windSpeed: 7, windDeg: 150, cape: 100, radarDbz: 0, cloudCover: 10, aqi: 195 },
      { time: "12:00+1", label: "12:00", pressure: 1014.2, humidity: 48, rainRate: 0.0, temp: 35.2, windSpeed: 14, windDeg: 135, cape: 350, radarDbz: 0, cloudCover: 15, aqi: 165 },
      { time: "18:00+1", label: "18:00", pressure: 1013.0, humidity: 52, rainRate: 0.0, temp: 32.8, windSpeed: 12, windDeg: 140, cape: 300, radarDbz: 0, cloudCover: 20, aqi: 172 },
      { time: "12:00+2", label: "Wed", pressure: 1015.5, humidity: 45, rainRate: 0.0, temp: 36.0, windSpeed: 15, windDeg: 140, cape: 280, radarDbz: 0, cloudCover: 10, aqi: 160 },
      { time: "12:00+3", label: "Thu", pressure: 1016.0, humidity: 42, rainRate: 0.0, temp: 36.5, windSpeed: 13, windDeg: 145, cape: 220, radarDbz: 0, cloudCover: 5, aqi: 155 },
    ],

    hourlyForecast: [
      { time: "15:00", temp: 33.3, pop: 5, rain: 0.0, wind: 14, icon: "Sun", cloud: 25 },
      { time: "16:00", temp: 33.2, pop: 5, rain: 0.0, wind: 14, icon: "Sun", cloud: 25 },
      { time: "17:00", temp: 32.8, pop: 5, rain: 0.0, wind: 13, icon: "Sun", cloud: 24 },
      { time: "18:00", temp: 31.9, pop: 5, rain: 0.0, wind: 12, icon: "Sun", cloud: 22 },
      { time: "19:00", temp: 30.8, pop: 5, rain: 0.0, wind: 11, icon: "Moon", cloud: 20 },
      { time: "20:00", temp: 30.1, pop: 5, rain: 0.0, wind: 10, icon: "Moon", cloud: 18 },
      { time: "21:00", temp: 29.5, pop: 0, rain: 0.0, wind: 10, icon: "Moon", cloud: 18 },
      { time: "22:00", temp: 29.0, pop: 0, rain: 0.0, wind: 9, icon: "Moon", cloud: 16 },
    ]
  },

  leh: {
    key: "leh",
    stationId: "UT-LEH-08",
    stationName: "Leh Ladakh Observatory",
    region: "Ladakh, Trans-Himalayan Plateau",
    coordinates: [34.1526, 77.5771],
    elevation: 3524,
    riskLevel: "LOW",
    riskProbability: 8,
    forecastWindow: "Clear / High Alpine Cold",
    alertType: "No Severe Weather Alerts",
    modelEngine: "High-Altitude Synoptic Model",
    condition: "Crisp Sun & High Mountain Wind",
    icon: "Sun",

    primaryMetrics: {
      temperature: { value: 14.5, unit: "°C", feelsLike: 12.0 },
      rainfallRate: { value: 0.0, unit: "mm/h", status: "Clear" },
      atmosphericPressure: { value: 672.4, unit: "hPa", status: "High Altitude Normal" },
      pressureTendency: { value: +0.2, unit: "hPa/3h", status: "Stable" },
      relativeHumidity: { value: 24, unit: "%", status: "Arid Alpine" },
      dewPoint: { value: -5.4, unit: "°C" },
      windSpeed: { value: 32, unit: "km/h", gust: 48 },
      windDirection: { value: "W (270°)", deg: 270 },
      cloudCover: { value: 12, unit: "%" },
      aqi: { value: 18, label: "Pristine", pm25: 4.1 },
      visibility: { value: 25.0, unit: "km" }
    },

    advancedMetrics: {
      radarReflectivity: { value: 5.0, unit: "dBZ", status: "No Cloud Cells" },
      echoTopHeight: { value: 2.1, unit: "km" },
      cloudTopTemp: { value: -8.0, unit: "°C", status: "Cirrus Streaks" },
      cape: { value: 120, unit: "J/kg", status: "Very Stable Plateau" },
      cin: { value: 210, unit: "J/kg", status: "Complete Inversion" },
      historicalAnomaly: { value: "-5%", baseline: "August Ladakh Avg" },
      verticallyIntegratedLiquid: { value: 1, unit: "kg/m²" },
      liftedIndex: { value: +4.2, unit: "°C", status: "Extremely Stable" }
    },

    timeSeries: [
      { time: "12:00", label: "12:00", pressure: 672.0, humidity: 22, rainRate: 0.0, temp: 15.2, windSpeed: 28, windDeg: 265, cape: 100, radarDbz: 2, cloudCover: 10, aqi: 18 },
      { time: "13:00", label: "13:00", pressure: 672.1, humidity: 23, rainRate: 0.0, temp: 15.0, windSpeed: 30, windDeg: 270, cape: 110, radarDbz: 4, cloudCover: 10, aqi: 18 },
      { time: "14:00", label: "14:00", pressure: 672.3, humidity: 24, rainRate: 0.0, temp: 14.8, windSpeed: 31, windDeg: 270, cape: 120, radarDbz: 5, cloudCover: 12, aqi: 18 },
      { time: "15:00", label: "15:00", pressure: 672.4, humidity: 24, rainRate: 0.0, temp: 14.6, windSpeed: 32, windDeg: 270, cape: 120, radarDbz: 5, cloudCover: 12, aqi: 18 },
      { time: "16:00", label: "16:00", pressure: 672.4, humidity: 24, rainRate: 0.0, temp: 14.5, windSpeed: 32, windDeg: 270, cape: 120, radarDbz: 5.0, cloudCover: 12, aqi: 18 },
      { time: "17:00", label: "17:00", pressure: 672.5, humidity: 26, rainRate: 0.0, temp: 13.8, windSpeed: 28, windDeg: 275, cape: 100, radarDbz: 4, cloudCover: 14, aqi: 18 },
      { time: "18:00", label: "18:00", pressure: 672.8, humidity: 28, rainRate: 0.0, temp: 12.5, windSpeed: 24, windDeg: 280, cape: 80, radarDbz: 3, cloudCover: 15, aqi: 18 },
      { time: "21:00", label: "21:00", pressure: 673.4, humidity: 32, rainRate: 0.0, temp: 9.0, windSpeed: 18, windDeg: 285, cape: 40, radarDbz: 0, cloudCover: 10, aqi: 18 },
      { time: "00:00", label: "00:00", pressure: 673.8, humidity: 36, rainRate: 0.0, temp: 6.2, windSpeed: 14, windDeg: 290, cape: 20, radarDbz: 0, cloudCover: 8, aqi: 18 },
      { time: "06:00", label: "06:00", pressure: 674.2, humidity: 40, rainRate: 0.0, temp: 4.5, windSpeed: 10, windDeg: 290, cape: 10, radarDbz: 0, cloudCover: 5, aqi: 18 },
      { time: "12:00+1", label: "12:00", pressure: 673.0, humidity: 20, rainRate: 0.0, temp: 16.0, windSpeed: 26, windDeg: 270, cape: 90, radarDbz: 0, cloudCover: 10, aqi: 19 },
      { time: "18:00+1", label: "18:00", pressure: 672.8, humidity: 25, rainRate: 0.0, temp: 13.2, windSpeed: 22, windDeg: 275, cape: 70, radarDbz: 0, cloudCover: 12, aqi: 19 },
      { time: "12:00+2", label: "Wed", pressure: 673.5, humidity: 18, rainRate: 0.0, temp: 16.8, windSpeed: 24, windDeg: 270, cape: 80, radarDbz: 0, cloudCover: 5, aqi: 20 },
      { time: "12:00+3", label: "Thu", pressure: 674.0, humidity: 16, rainRate: 0.0, temp: 17.2, windSpeed: 22, windDeg: 270, cape: 60, radarDbz: 0, cloudCover: 5, aqi: 20 },
    ],

    hourlyForecast: [
      { time: "15:00", temp: 14.6, pop: 0, rain: 0.0, wind: 32, icon: "Sun", cloud: 12 },
      { time: "16:00", temp: 14.5, pop: 0, rain: 0.0, wind: 32, icon: "Sun", cloud: 12 },
      { time: "17:00", temp: 13.8, pop: 0, rain: 0.0, wind: 28, icon: "Sun", cloud: 14 },
      { time: "18:00", temp: 12.5, pop: 0, rain: 0.0, wind: 24, icon: "Sun", cloud: 15 },
      { time: "19:00", temp: 11.2, pop: 0, rain: 0.0, wind: 21, icon: "Moon", cloud: 12 },
      { time: "20:00", temp: 10.0, pop: 0, rain: 0.0, wind: 19, icon: "Moon", cloud: 10 },
      { time: "21:00", temp: 9.0, pop: 0, rain: 0.0, wind: 18, icon: "Moon", cloud: 10 },
      { time: "22:00", temp: 8.2, pop: 0, rain: 0.0, wind: 16, icon: "Moon", cloud: 8 },
    ]
  }
};

// Spatial spot calculation helper when clicking anywhere on the map
export function computeSpotWeather(lat, lon, timeIndex = 4) {
  const stations = Object.values(STATIONS_DATA);
  let totalWeight = 0;
  let weightedTemp = 0;
  let weightedRain = 0;
  let weightedWind = 0;
  let weightedPressure = 0;
  let weightedHumidity = 0;
  let weightedCape = 0;
  let weightedDbz = 0;
  let weightedCloud = 0;

  // Inverse distance weighted interpolation
  stations.forEach(stn => {
    const dLat = lat - stn.coordinates[0];
    const dLon = lon - stn.coordinates[1];
    const dist = Math.max(0.15, Math.sqrt(dLat * dLat + dLon * dLon));
    const weight = 1 / Math.pow(dist, 2);
    totalWeight += weight;

    const tData = stn.timeSeries[timeIndex] || stn.timeSeries[4];
    weightedTemp += tData.temp * weight;
    weightedRain += tData.rainRate * weight;
    weightedWind += tData.windSpeed * weight;
    weightedPressure += tData.pressure * weight;
    weightedHumidity += tData.humidity * weight;
    weightedCape += tData.cape * weight;
    weightedDbz += tData.radarDbz * weight;
    weightedCloud += tData.cloudCover * weight;
  });

  const temp = Math.round((weightedTemp / totalWeight) * 10) / 10;
  const rain = Math.round((weightedRain / totalWeight) * 10) / 10;
  const wind = Math.round((weightedWind / totalWeight) * 10) / 10;
  const pressure = Math.round((weightedPressure / totalWeight) * 10) / 10;
  const humidity = Math.round(weightedHumidity / totalWeight);
  const cape = Math.round(weightedCape / totalWeight);
  const dbz = Math.round((weightedDbz / totalWeight) * 10) / 10;
  const cloud = Math.round(weightedCloud / totalWeight);

  // Approximate altitude from rough Himalayan topography gradient
  const latFactor = Math.max(0, (lat - 28.0) * 800);
  const lonFactor = Math.max(0, (lon - 77.0) * 300);
  const approxElev = Math.max(210, Math.round(latFactor + lonFactor + (rain > 30 ? 1200 : 0)));

  // Determine wind direction based on synoptic mountain flow
  const windDeg = Math.round((45 + (lat - 30) * 30 + (lon - 78) * 40 + 360) % 360);

  return {
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
    elevation: approxElev,
    temp,
    rainRate: rain,
    windSpeed: wind,
    windDeg,
    pressure,
    humidity,
    cape,
    radarDbz: dbz,
    cloudCover: cloud,
    risk: rain > 50 || cape > 2200 ? "HIGH" : rain > 20 || cape > 1000 ? "MODERATE" : "LOW"
  };
}