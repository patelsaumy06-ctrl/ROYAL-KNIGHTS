import { haversineKm } from "../utils/geo";
// REPLACE WITH YOUR ACTUAL GOOGLE MAPS API KEY
export const GOOGLE_MAPS_API_KEY = "YOUR_API_KEY_HERE";

/* ═══════════════════════════════════════════════════════
   DISTANCE MATRIX CACHE & HELPER
═══════════════════════════════════════════════════════ */
const distanceCache = new Map();

// Helper to estimate duration based on straight-line distance if API is disabled
function estimateOfflineMetrics(origin, destination) {
  const lat1 = parseFloat(origin.lat);
  const lng1 = parseFloat(origin.lng);
  const lat2 = parseFloat(destination.lat);
  const lng2 = parseFloat(destination.lng);
  
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return { distance: "N/A", duration: "N/A", durationInTraffic: "N/A", value: Infinity };
  }

  // Calculate direct distance in km exactly as AddVolunteerModal does
  const dist = haversineKm(lat1, lng1, lat2, lng2);
  const routedDistanceKm = Math.max(dist, 0.1); 
  
  // Estimate time: assume average speed of 40 km/h + 10 min overhead
  const durationHours = (routedDistanceKm / 40) + (10 / 60); 
  const durationMins = Math.round(durationHours * 60);

  return {
    distance: `${routedDistanceKm.toFixed(1)} km`,
    duration: `${durationMins} mins`,
    durationInTraffic: `${Math.round(durationMins * 1.15)} mins`, 
    value: durationMins * 60
  };
}

export async function getPreciseTravelTime(origin, destination, mode = 'DRIVING') {
  const cacheKey = `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}|${mode}`;
  if (distanceCache.has(cacheKey)) return distanceCache.get(cacheKey);

  if (GOOGLE_MAPS_API_KEY === "YOUR_API_KEY_HERE") {
    // Fallback to Haversine offline calculations
    const data = estimateOfflineMetrics(origin, destination);
    distanceCache.set(cacheKey, data);
    return data;
  }
  
  try {
    const service = new window.google.maps.DistanceMatrixService();
    const response = await service.getDistanceMatrix({
      origins: [origin],
      destinations: [destination],
      travelMode: window.google.maps.TravelMode[mode],
      drivingOptions: {
        departureTime: new Date(Date.now()),
        trafficModel: 'bestguess'
      },
      unitSystem: window.google.maps.UnitSystem.METRIC,
    });

    const result = response.rows[0].elements[0];
    if (result.status === "OK") {
      const data = {
        distance: result.distance.text,
        duration: result.duration.text,
        durationInTraffic: result.duration_in_traffic ? result.duration_in_traffic.text : result.duration.text,
        value: result.duration.value
      };
      distanceCache.set(cacheKey, data);
      return data;
    }
    throw new Error(result.status);
  } catch (error) {
    console.warn("Distance Matrix API Failed, falling back to Haversine logic:", error);
    const data = estimateOfflineMetrics(origin, destination);
    distanceCache.set(cacheKey, data);
    return data;
  }
}
