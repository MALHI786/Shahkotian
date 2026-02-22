/**
 * Client-side geolocation utility (mirrors backend logic)
 */

const SHAHKOT_CENTER = {
  lat: 31.9712,
  lng: 73.4818,
};

const GEOFENCE_RADIUS_KM = 50;

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isWithinShahkot(latitude, longitude) {
  // GEOFENCING DISABLED - Allow access from anywhere
  // Always return true to skip location restriction
  return { isWithin: true, distance: 0, maxRadius: GEOFENCE_RADIUS_KM };
  
  // Original code (disabled):
  // const distance = haversineDistance(
  //   SHAHKOT_CENTER.lat,
  //   SHAHKOT_CENTER.lng,
  //   latitude,
  //   longitude
  // );
  // return {
  //   isWithin: distance <= GEOFENCE_RADIUS_KM,
  //   distance: Math.round(distance * 100) / 100,
  //   maxRadius: GEOFENCE_RADIUS_KM,
  // };
}
