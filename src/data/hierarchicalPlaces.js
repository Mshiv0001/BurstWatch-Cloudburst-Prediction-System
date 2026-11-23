/**
 * Hierarchical Multi-Tier Vector Places GeoJSON
 * Provides progressive Level-of-Detail (LoD) map labels:
 * - Tier 1: Mega-Metros & National Capitals (Zoom >= 4.2)
 * - Tier 2: State Names (Zoom 4.6 - 7.5)
 * - Tier 3: Regional Cities & Meteorological Centers (Zoom >= 6.2)
 * - Tier 4: Mountain Valleys, Towns & Local Stations (Zoom >= 8.2)
 */

export const HIERARCHICAL_PLACES = {
  type: 'FeatureCollection',
  features: [
    // ==========================================
    // TIER 1: MEGA-METROS & CAPITALS (Zoom >= 4.2)
    // ==========================================
    { type: 'Feature', properties: { name: 'New Delhi', minZoom: 4.0, size: 13, isCapital: true }, geometry: { type: 'Point', coordinates: [77.2090, 28.6139] } },
    { type: 'Feature', properties: { name: 'Mumbai', minZoom: 4.2, size: 12.5 }, geometry: { type: 'Point', coordinates: [72.8777, 19.0760] } },
    { type: 'Feature', properties: { name: 'Kolkata', minZoom: 4.2, size: 12.5 }, geometry: { type: 'Point', coordinates: [88.3639, 22.5726] } },
    { type: 'Feature', properties: { name: 'Bengaluru', minZoom: 4.2, size: 12.5 }, geometry: { type: 'Point', coordinates: [77.5946, 12.9716] } },
    { type: 'Feature', properties: { name: 'Chennai', minZoom: 4.2, size: 12.5 }, geometry: { type: 'Point', coordinates: [80.2707, 13.0827] } },
    { type: 'Feature', properties: { name: 'Hyderabad', minZoom: 4.2, size: 12.5 }, geometry: { type: 'Point', coordinates: [78.4867, 17.3850] } },
    { type: 'Feature', properties: { name: 'Ahmedabad', minZoom: 4.5, size: 12 }, geometry: { type: 'Point', coordinates: [72.5714, 23.0225] } },
    { type: 'Feature', properties: { name: 'Jaipur', minZoom: 4.5, size: 12 }, geometry: { type: 'Point', coordinates: [75.7873, 26.9124] } },
    { type: 'Feature', properties: { name: 'Lucknow', minZoom: 4.5, size: 12 }, geometry: { type: 'Point', coordinates: [80.9462, 26.8467] } },
    { type: 'Feature', properties: { name: 'Patna', minZoom: 4.5, size: 12 }, geometry: { type: 'Point', coordinates: [85.1376, 25.5941] } },
    { type: 'Feature', properties: { name: 'Bhopal', minZoom: 4.5, size: 12 }, geometry: { type: 'Point', coordinates: [77.4126, 23.2599] } },
    { type: 'Feature', properties: { name: 'Chandigarh', minZoom: 4.5, size: 12 }, geometry: { type: 'Point', coordinates: [76.7794, 30.7333] } },
    { type: 'Feature', properties: { name: 'Srinagar', minZoom: 4.5, size: 12 }, geometry: { type: 'Point', coordinates: [74.7973, 34.0837] } },
    { type: 'Feature', properties: { name: 'Guwahati', minZoom: 4.5, size: 12 }, geometry: { type: 'Point', coordinates: [91.7362, 26.1445] } },
    { type: 'Feature', properties: { name: 'Bhubaneswar', minZoom: 4.5, size: 12 }, geometry: { type: 'Point', coordinates: [85.8245, 20.2961] } },
    { type: 'Feature', properties: { name: 'Thiruvananthapuram', minZoom: 4.5, size: 12 }, geometry: { type: 'Point', coordinates: [76.9366, 8.5241] } },

    // Neighboring Capitals (Zoom >= 4.0)
    { type: 'Feature', properties: { name: 'Islamabad', minZoom: 4.0, size: 12, isCapital: true }, geometry: { type: 'Point', coordinates: [73.0479, 33.6844] } },
    { type: 'Feature', properties: { name: 'Dhaka', minZoom: 4.0, size: 12, isCapital: true }, geometry: { type: 'Point', coordinates: [90.4125, 23.8103] } },
    { type: 'Feature', properties: { name: 'Kathmandu', minZoom: 4.0, size: 12, isCapital: true }, geometry: { type: 'Point', coordinates: [85.3240, 27.7172] } },
    { type: 'Feature', properties: { name: 'Colombo', minZoom: 4.0, size: 12, isCapital: true }, geometry: { type: 'Point', coordinates: [79.8612, 6.9271] } },
    { type: 'Feature', properties: { name: 'Kabul', minZoom: 4.0, size: 12, isCapital: true }, geometry: { type: 'Point', coordinates: [69.1723, 34.5553] } },
    { type: 'Feature', properties: { name: 'Thimphu', minZoom: 4.2, size: 11, isCapital: true }, geometry: { type: 'Point', coordinates: [89.6393, 27.4728] } },
    { type: 'Feature', properties: { name: 'Naypyidaw', minZoom: 4.2, size: 11, isCapital: true }, geometry: { type: 'Point', coordinates: [96.0785, 19.7633] } },

    // ==========================================
    // TIER 2: STATE NAMES (Zoom 4.6 - 7.5)
    // ==========================================
    { type: 'Feature', properties: { name: 'UTTARAKHAND', minZoom: 4.8, maxZoom: 7.2, size: 11, isState: true }, geometry: { type: 'Point', coordinates: [79.0, 30.1] } },
    { type: 'Feature', properties: { name: 'HIMACHAL PRADESH', minZoom: 4.8, maxZoom: 7.2, size: 11, isState: true }, geometry: { type: 'Point', coordinates: [77.2, 31.8] } },
    { type: 'Feature', properties: { name: 'JAMMU & KASHMIR', minZoom: 4.8, maxZoom: 7.2, size: 11, isState: true }, geometry: { type: 'Point', coordinates: [75.3, 33.7] } },
    { type: 'Feature', properties: { name: 'LADAKH', minZoom: 4.6, maxZoom: 7.2, size: 11.5, isState: true }, geometry: { type: 'Point', coordinates: [77.5, 34.2] } },
    { type: 'Feature', properties: { name: 'PUNJAB', minZoom: 4.8, maxZoom: 7.2, size: 11, isState: true }, geometry: { type: 'Point', coordinates: [75.3, 31.1] } },
    { type: 'Feature', properties: { name: 'HARYANA', minZoom: 5.0, maxZoom: 7.2, size: 10.5, isState: true }, geometry: { type: 'Point', coordinates: [76.0, 29.0] } },
    { type: 'Feature', properties: { name: 'RAJASTHAN', minZoom: 4.6, maxZoom: 7.2, size: 12, isState: true }, geometry: { type: 'Point', coordinates: [73.8, 26.5] } },
    { type: 'Feature', properties: { name: 'UTTAR PRADESH', minZoom: 4.6, maxZoom: 7.2, size: 12, isState: true }, geometry: { type: 'Point', coordinates: [80.3, 26.8] } },
    { type: 'Feature', properties: { name: 'BIHAR', minZoom: 4.8, maxZoom: 7.2, size: 11.5, isState: true }, geometry: { type: 'Point', coordinates: [85.3, 25.6] } },
    { type: 'Feature', properties: { name: 'MADHYA PRADESH', minZoom: 4.6, maxZoom: 7.2, size: 12, isState: true }, geometry: { type: 'Point', coordinates: [78.0, 23.5] } },
    { type: 'Feature', properties: { name: 'GUJARAT', minZoom: 4.6, maxZoom: 7.2, size: 12, isState: true }, geometry: { type: 'Point', coordinates: [71.5, 22.5] } },
    { type: 'Feature', properties: { name: 'MAHARASHTRA', minZoom: 4.6, maxZoom: 7.2, size: 12, isState: true }, geometry: { type: 'Point', coordinates: [75.7, 19.7] } },
    { type: 'Feature', properties: { name: 'ODISHA', minZoom: 4.8, maxZoom: 7.2, size: 11.5, isState: true }, geometry: { type: 'Point', coordinates: [84.8, 20.9] } },
    { type: 'Feature', properties: { name: 'WEST BENGAL', minZoom: 4.8, maxZoom: 7.2, size: 11.5, isState: true }, geometry: { type: 'Point', coordinates: [87.8, 23.0] } },
    { type: 'Feature', properties: { name: 'KARNATAKA', minZoom: 4.6, maxZoom: 7.2, size: 12, isState: true }, geometry: { type: 'Point', coordinates: [75.8, 15.3] } },
    { type: 'Feature', properties: { name: 'TAMIL NADU', minZoom: 4.6, maxZoom: 7.2, size: 12, isState: true }, geometry: { type: 'Point', coordinates: [78.6, 11.1] } },
    { type: 'Feature', properties: { name: 'KERALA', minZoom: 4.8, maxZoom: 7.2, size: 11, isState: true }, geometry: { type: 'Point', coordinates: [76.5, 10.8] } },
    { type: 'Feature', properties: { name: 'ASSAM', minZoom: 4.8, maxZoom: 7.2, size: 11, isState: true }, geometry: { type: 'Point', coordinates: [92.9, 26.2] } },

    // ==========================================
    // TIER 3: REGIONAL CITIES (Zoom >= 6.0)
    // ==========================================
    { type: 'Feature', properties: { name: 'Dehradun', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [78.0322, 30.3165] } },
    { type: 'Feature', properties: { name: 'Shimla', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [77.1734, 31.1048] } },
    { type: 'Feature', properties: { name: 'Haridwar', minZoom: 6.2, size: 11 }, geometry: { type: 'Point', coordinates: [78.1642, 29.9457] } },
    { type: 'Feature', properties: { name: 'Rishikesh', minZoom: 6.2, size: 11 }, geometry: { type: 'Point', coordinates: [78.2676, 30.0869] } },
    { type: 'Feature', properties: { name: 'Amritsar', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [74.8723, 31.6340] } },
    { type: 'Feature', properties: { name: 'Ludhiana', minZoom: 6.0, size: 11 }, geometry: { type: 'Point', coordinates: [75.8573, 30.9010] } },
    { type: 'Feature', properties: { name: 'Agra', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [78.0081, 27.1767] } },
    { type: 'Feature', properties: { name: 'Varanasi', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [82.9739, 25.3176] } },
    { type: 'Feature', properties: { name: 'Prayagraj', minZoom: 6.0, size: 11 }, geometry: { type: 'Point', coordinates: [81.8463, 25.4358] } },
    { type: 'Feature', properties: { name: 'Kanpur', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [80.3319, 26.4499] } },
    { type: 'Feature', properties: { name: 'Indore', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [75.8577, 22.7196] } },
    { type: 'Feature', properties: { name: 'Nagpur', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [79.0882, 21.1458] } },
    { type: 'Feature', properties: { name: 'Pune', minZoom: 5.5, size: 12 }, geometry: { type: 'Point', coordinates: [73.8567, 18.5204] } },
    { type: 'Feature', properties: { name: 'Nashik', minZoom: 6.0, size: 11 }, geometry: { type: 'Point', coordinates: [73.7898, 19.9975] } },
    { type: 'Feature', properties: { name: 'Surat', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [72.8311, 21.1702] } },
    { type: 'Feature', properties: { name: 'Vadodara', minZoom: 6.0, size: 11 }, geometry: { type: 'Point', coordinates: [73.1812, 22.3072] } },
    { type: 'Feature', properties: { name: 'Jodhpur', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [73.0243, 26.2389] } },
    { type: 'Feature', properties: { name: 'Udaipur', minZoom: 6.0, size: 11 }, geometry: { type: 'Point', coordinates: [73.7125, 24.5854] } },
    { type: 'Feature', properties: { name: 'Kota', minZoom: 6.0, size: 11 }, geometry: { type: 'Point', coordinates: [75.8648, 25.2138] } },
    { type: 'Feature', properties: { name: 'Ranchi', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [85.3096, 23.3441] } },
    { type: 'Feature', properties: { name: 'Jamshedpur', minZoom: 6.0, size: 11 }, geometry: { type: 'Point', coordinates: [86.2029, 22.8046] } },
    { type: 'Feature', properties: { name: 'Raipur', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [81.6296, 21.2514] } },
    { type: 'Feature', properties: { name: 'Visakhapatnam', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [83.2185, 17.6868] } },
    { type: 'Feature', properties: { name: 'Vijayawada', minZoom: 6.0, size: 11 }, geometry: { type: 'Point', coordinates: [80.6480, 16.5062] } },
    { type: 'Feature', properties: { name: 'Coimbatore', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [76.9558, 11.0168] } },
    { type: 'Feature', properties: { name: 'Madurai', minZoom: 6.0, size: 11 }, geometry: { type: 'Point', coordinates: [78.1198, 9.9252] } },
    { type: 'Feature', properties: { name: 'Kochi', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [76.2673, 9.9312] } },
    { type: 'Feature', properties: { name: 'Kozhikode', minZoom: 6.0, size: 11 }, geometry: { type: 'Point', coordinates: [75.7804, 11.2588] } },
    { type: 'Feature', properties: { name: 'Mangaluru', minZoom: 6.0, size: 11 }, geometry: { type: 'Point', coordinates: [74.8560, 12.9141] } },
    { type: 'Feature', properties: { name: 'Mysuru', minZoom: 6.0, size: 11 }, geometry: { type: 'Point', coordinates: [76.6394, 12.2958] } },
    { type: 'Feature', properties: { name: 'Leh', minZoom: 5.5, size: 11.5 }, geometry: { type: 'Point', coordinates: [77.5771, 34.1526] } },
    { type: 'Feature', properties: { name: 'Jammu', minZoom: 5.8, size: 11.5 }, geometry: { type: 'Point', coordinates: [74.8570, 32.7266] } },

    // ==========================================
    // TIER 4: MOUNTAIN VALLEYS & LOCAL STATIONS (Zoom >= 8.0)
    // ==========================================
    { type: 'Feature', properties: { name: 'Kedarnath', minZoom: 7.8, size: 10.5 }, geometry: { type: 'Point', coordinates: [79.0669, 30.7346] } },
    { type: 'Feature', properties: { name: 'Badrinath', minZoom: 8.0, size: 10 }, geometry: { type: 'Point', coordinates: [79.4938, 30.7433] } },
    { type: 'Feature', properties: { name: 'Joshimath', minZoom: 7.8, size: 10.5 }, geometry: { type: 'Point', coordinates: [79.5667, 30.5583] } },
    { type: 'Feature', properties: { name: 'Uttarkashi', minZoom: 7.8, size: 10.5 }, geometry: { type: 'Point', coordinates: [78.4354, 30.7268] } },
    { type: 'Feature', properties: { name: 'Mussoorie', minZoom: 7.8, size: 10.5 }, geometry: { type: 'Point', coordinates: [78.0700, 30.4598] } },
    { type: 'Feature', properties: { name: 'Nainital', minZoom: 7.8, size: 10.5 }, geometry: { type: 'Point', coordinates: [79.4542, 29.3919] } },
    { type: 'Feature', properties: { name: 'Almora', minZoom: 8.0, size: 10 }, geometry: { type: 'Point', coordinates: [79.6600, 29.5971] } },
    { type: 'Feature', properties: { name: 'Pithoragarh', minZoom: 8.0, size: 10 }, geometry: { type: 'Point', coordinates: [80.2182, 29.5829] } },
    { type: 'Feature', properties: { name: 'Tehri', minZoom: 8.0, size: 10 }, geometry: { type: 'Point', coordinates: [78.4800, 30.3800] } },
    { type: 'Feature', properties: { name: 'Rudraprayag', minZoom: 8.2, size: 10 }, geometry: { type: 'Point', coordinates: [78.9800, 30.2800] } },
    { type: 'Feature', properties: { name: 'Karnaprayag', minZoom: 8.5, size: 9.5 }, geometry: { type: 'Point', coordinates: [79.2200, 30.2600] } },
    { type: 'Feature', properties: { name: 'Roorkee', minZoom: 8.0, size: 10 }, geometry: { type: 'Point', coordinates: [77.8880, 29.8543] } },
    { type: 'Feature', properties: { name: 'Vikasnagar', minZoom: 8.5, size: 9.5 }, geometry: { type: 'Point', coordinates: [77.7800, 30.4900] } },
    { type: 'Feature', properties: { name: 'Dharamshala', minZoom: 7.8, size: 10.5 }, geometry: { type: 'Point', coordinates: [76.3242, 32.2190] } },
    { type: 'Feature', properties: { name: 'Manali', minZoom: 7.8, size: 10.5 }, geometry: { type: 'Point', coordinates: [77.1892, 32.2432] } },
    { type: 'Feature', properties: { name: 'Kullu', minZoom: 8.0, size: 10 }, geometry: { type: 'Point', coordinates: [77.1095, 31.9579] } },
    { type: 'Feature', properties: { name: 'Mandi', minZoom: 8.0, size: 10 }, geometry: { type: 'Point', coordinates: [76.9322, 31.7087] } },
    { type: 'Feature', properties: { name: 'Solan', minZoom: 8.2, size: 9.5 }, geometry: { type: 'Point', coordinates: [77.1084, 30.9045] } },
    { type: 'Feature', properties: { name: 'Gulmarg', minZoom: 8.0, size: 10 }, geometry: { type: 'Point', coordinates: [74.3800, 34.0500] } },
    { type: 'Feature', properties: { name: 'Pahalgam', minZoom: 8.0, size: 10 }, geometry: { type: 'Point', coordinates: [75.3200, 34.0100] } },
    { type: 'Feature', properties: { name: 'Sonamarg', minZoom: 8.2, size: 9.5 }, geometry: { type: 'Point', coordinates: [75.2900, 34.3100] } },
    { type: 'Feature', properties: { name: 'Kargil', minZoom: 7.8, size: 10.5 }, geometry: { type: 'Point', coordinates: [76.1000, 34.5500] } },
    { type: 'Feature', properties: { name: 'Drass', minZoom: 8.5, size: 9.5 }, geometry: { type: 'Point', coordinates: [75.7600, 34.4300] } },
    { type: 'Feature', properties: { name: 'Nubra', minZoom: 8.5, size: 9.5 }, geometry: { type: 'Point', coordinates: [77.5600, 34.6900] } },
    { type: 'Feature', properties: { name: 'Cherrapunji', minZoom: 7.8, size: 10.5 }, geometry: { type: 'Point', coordinates: [91.7314, 25.2986] } },
    { type: 'Feature', properties: { name: 'Mawsynram', minZoom: 8.2, size: 9.5 }, geometry: { type: 'Point', coordinates: [91.5833, 25.3000] } },
    { type: 'Feature', properties: { name: 'Tawang', minZoom: 8.0, size: 10 }, geometry: { type: 'Point', coordinates: [91.8687, 27.5861] } }
  ]
};

