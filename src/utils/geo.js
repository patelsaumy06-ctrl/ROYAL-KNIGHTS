const EARTH_RADIUS_KM = 6371;

export function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

export function isValidCoordinates(point) {
  if (!point) return false;
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function haversineDistanceKm(pointA, pointB) {
  if (!isValidCoordinates(pointA) || !isValidCoordinates(pointB)) return Infinity;
  const lat1 = Number(pointA.lat);
  const lng1 = Number(pointA.lng);
  const lat2 = Number(pointB.lat);
  const lng2 = Number(pointB.lng);

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  return haversineDistanceKm(
    { lat: Number(lat1), lng: Number(lng1) },
    { lat: Number(lat2), lng: Number(lng2) }
  );
}
