// Geographical boundary and sector utilities

export function isIndiaSector(lon, lat) {
  if (lat == null || lon == null) return false;
  return lat >= 6.0 && lat <= 38.0 && lon >= 67.0 && lon <= 98.0;
}
