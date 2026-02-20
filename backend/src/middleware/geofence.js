const { isWithinShahkot } = require('../utils/geolocation');

/**
 * Geofence Middleware
 * Checks if user's location is within 50KM of Shahkot center
 * Requires latitude and longitude in request body or user profile
 */
function geofenceCheck(req, res, next) {
  // Get location from request body (during registration) or from user profile
  const latitude = req.body.latitude || (req.user && req.user.latitude);
  const longitude = req.body.longitude || (req.user && req.user.longitude);

  if (!latitude || !longitude) {
    return res.status(400).json({
      error: 'Location is required. Please enable GPS/location services.',
      code: 'LOCATION_REQUIRED',
    });
  }

  const result = isWithinShahkot(parseFloat(latitude), parseFloat(longitude));

  if (!result.isWithin) {
    return res.status(403).json({
      error: `You are ${result.distance}KM away from Shahkot. This app is only available within ${result.maxRadius}KM of Shahkot city.`,
      code: 'OUTSIDE_GEOFENCE',
      distance: result.distance,
      maxRadius: result.maxRadius,
    });
  }

  // Attach location info to request
  req.locationInfo = result;
  next();
}

module.exports = { geofenceCheck };
