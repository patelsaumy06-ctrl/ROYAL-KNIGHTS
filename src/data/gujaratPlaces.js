/**
 * Region centers + curated place lists for autosuggest and coordinate fallback.
 * Keeps map pins aligned with "Region" + "Location specifics" in the task form.
 */

export const REGION_ORDER = ["Mehsana", "Patan", "Banaskantha", "Ahmedabad", "Gandhinagar", "Sabarkantha"];

export const REGION_CENTERS = {
  Mehsana: { lat: 23.588, lng: 72.3693 },
  Patan: { lat: 23.8493, lng: 72.1266 },
  Banaskantha: { lat: 24.1725, lng: 72.4383 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Gandhinagar: { lat: 23.2156, lng: 72.6369 },
  Sabarkantha: { lat: 23.63, lng: 73.0 },
};

/** @type {Record<string, { location: string, lat: number, lng: number }[]>} */
export const PLACE_SUGGESTIONS_BY_REGION = {
  Mehsana: [
    { location: "Rajpur Village", lat: 23.5889, lng: 72.3694 },
    { location: "Vijapur", lat: 23.5632, lng: 72.7466 },
    { location: "Unjha", lat: 23.8002, lng: 72.3925 },
    { location: "Vadnagar", lat: 23.7861, lng: 72.6361 },
    { location: "Visnagar", lat: 23.6997, lng: 72.549 },
    { location: "Kadi", lat: 23.298, lng: 72.331 },
    { location: "Mehsana City", lat: 23.588, lng: 72.3693 },
    { location: "Santhal", lat: 23.65, lng: 72.42 },
  ],
  Patan: [
    { location: "Sidhpur Block", lat: 23.9161, lng: 72.3802 },
    { location: "Siddhpur Town", lat: 23.9161, lng: 72.3802 },
    { location: "Harij Village", lat: 23.6938, lng: 71.9072 },
    { location: "Chanasma Town", lat: 23.7134, lng: 72.1127 },
    { location: "Chanasma", lat: 23.7134, lng: 72.1127 },
    { location: "Patan City", lat: 23.8493, lng: 72.1266 },
    { location: "Sami Village", lat: 23.7, lng: 71.7833 },
    { location: "Radhanpur", lat: 23.8333, lng: 71.6 },
  ],
  Banaskantha: [
    { location: "Dhanera Town", lat: 24.5083, lng: 72.0217 },
    { location: "Bhabhar Village", lat: 24.0333, lng: 72.3333 },
    { location: "Palanpur City", lat: 24.1725, lng: 72.4383 },
    { location: "Palanpur", lat: 24.1725, lng: 72.4383 },
    { location: "Tharad", lat: 24.3961, lng: 71.6256 },
    { location: "Suigam", lat: 24.1333, lng: 71.4833 },
    { location: "Deesa", lat: 24.2581, lng: 72.189 },
    { location: "Kankrej", lat: 23.9917, lng: 71.7425 },
  ],
  Ahmedabad: [
    { location: "Maninagar", lat: 22.9992, lng: 72.6187 },
    { location: "Satellite", lat: 23.0304, lng: 72.5176 },
    { location: "Navrangpura", lat: 23.036, lng: 72.561 },
    { location: "SG Highway", lat: 23.051, lng: 72.508 },
    { location: "Sabarmati", lat: 23.08, lng: 72.58 },
    { location: "Vastrapur", lat: 23.034, lng: 72.528 },
    { location: "Ahmedabad Old City", lat: 23.0225, lng: 72.5714 },
  ],
  Gandhinagar: [
    { location: "Sector 21", lat: 23.2156, lng: 72.6369 },
    { location: "Sector 7", lat: 23.225, lng: 72.645 },
    { location: "Infocity", lat: 23.185, lng: 72.628 },
  ],
  Sabarkantha: [
    { location: "Himatnagar", lat: 23.597, lng: 72.966 },
    { location: "Idar", lat: 23.84, lng: 73.0 },
    { location: "Modasa", lat: 23.467, lng: 73.3 },
  ],
};

export function listSuggestions(region) {
  return PLACE_SUGGESTIONS_BY_REGION[region] || [];
}

/** Nearest region label for a lat/lng (for map pin → task region default). */
export function nearestRegion(lat, lng) {
  let best = "Mehsana";
  let bestD = Infinity;
  for (const [name, c] of Object.entries(REGION_CENTERS)) {
    const d = (lat - c.lat) ** 2 + (lng - c.lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

/**
 * Resolve coordinates for a need row (Firestore may omit lat/lng).
 * Honors explicit lat/lng on the object.
 */
export function resolveNeedCoordinates(need) {
  if (need.lat != null && need.lng != null && !Number.isNaN(Number(need.lat)) && !Number.isNaN(Number(need.lng))) {
    return { lat: Number(need.lat), lng: Number(need.lng) };
  }
  const loc = (need.location || "").trim();
  const region = need.region || "";

  const lower = loc.toLowerCase();
  for (const arr of Object.values(PLACE_SUGGESTIONS_BY_REGION)) {
    const exact = arr.find((p) => p.location.toLowerCase() === lower);
    if (exact) return { lat: exact.lat, lng: exact.lng };
  }

  const regional = listSuggestions(region);
  const partial = regional.find(
    (p) =>
      lower.includes(p.location.toLowerCase()) ||
      p.location.toLowerCase().includes(lower)
  );
  if (partial) return { lat: partial.lat, lng: partial.lng };

  const base = REGION_CENTERS[region] || { lat: 23.03, lng: 72.58 };
  return { lat: base.lat, lng: base.lng };
}
