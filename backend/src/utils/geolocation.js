/**
 * Geolocation utility for Shahkot App
 * Uses Haversine formula to calculate distance between two GPS coordinates
 * Shahkot Center: 31.9712° N, 73.4818° E
 */

const SHAHKOT_CENTER = {
  lat: parseFloat(process.env.SHAHKOT_LAT) || 31.9712,
  lng: parseFloat(process.env.SHAHKOT_LNG) || 73.4818,
};

const GEOFENCE_RADIUS_KM = parseFloat(process.env.GEOFENCE_RADIUS_KM) || 50;

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a location is within the Shahkot geofence (50KM radius)
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @returns {object} { isWithin: boolean, distance: number }
 */
function isWithinShahkot(latitude, longitude) {
  const distance = haversineDistance(
    SHAHKOT_CENTER.lat,
    SHAHKOT_CENTER.lng,
    latitude,
    longitude
  );

  return {
    isWithin: distance <= GEOFENCE_RADIUS_KM,
    distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
    maxRadius: GEOFENCE_RADIUS_KM,
    center: SHAHKOT_CENTER,
  };
}

module.exports = {
  haversineDistance,
  isWithinShahkot,
  SHAHKOT_CENTER,
  GEOFENCE_RADIUS_KM,
};
