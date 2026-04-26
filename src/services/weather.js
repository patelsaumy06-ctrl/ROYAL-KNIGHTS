// src/services/weather.js

export const DEFAULT_WEATHER_COORDS = {
  lat: 23.03,
  lon: 72.58,
};

export const FALLBACK_WEATHER = {
  rainfallMm: 0,
  windKph: 0,
  temperatureC: 30,
};

// ── Cache config ────────────────────────────────────────────────
// Open-Meteo free tier is rate-limited. Cache results for 10 min
// so the API is only hit once per session regardless of how many
// components or ticks call fetchWeather().
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const _cache = {
  data: null,
  timestamp: 0,
  inFlight: null, // deduplicate concurrent calls
};

function isFresh() {
  return _cache.data !== null && Date.now() - _cache.timestamp < CACHE_TTL_MS;
}

// ── Main fetch ──────────────────────────────────────────────────
export async function fetchWeather(lat, lon) {
  // Return cached result if still fresh
  if (isFresh()) {
    return _cache.data;
  }

  // If a request is already in flight, wait for it instead of firing another
  if (_cache.inFlight) {
    return _cache.inFlight;
  }

  // Fire the request and store the promise
  _cache.inFlight = _fetchFromAPI(lat, lon).finally(() => {
    _cache.inFlight = null;
  });

  return _cache.inFlight;
}

async function _fetchFromAPI(lat, lon) {
  try {
    const query = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'rain,windspeed_10m,temperature_2m',
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${query.toString()}`,
    );

    // If rate-limited, return stale cache or fallback — don't throw
    if (response.status === 429) {
      console.warn('[weather] Rate limited by Open-Meteo. Using cached/fallback data.');
      return _cache.data ?? { ...FALLBACK_WEATHER };
    }

    if (!response.ok) {
      throw new Error(`Open-Meteo responded with status ${response.status}`);
    }

    const payload = await response.json();
    const current = payload?.current || {};

    const result = {
      rainfallMm: Number.isFinite(current.rain) ? current.rain : 0,
      windKph: Number.isFinite(current.windspeed_10m) ? current.windspeed_10m : 0,
      temperatureC: Number.isFinite(current.temperature_2m) ? current.temperature_2m : 30,
    };

    // Store in cache
    _cache.data = result;
    _cache.timestamp = Date.now();

    return result;
  } catch (error) {
    console.error('[weather] Failed to fetch from Open-Meteo:', error);
    // Return stale cache if available, else fallback
    return _cache.data ?? { ...FALLBACK_WEATHER };
  }
}

// ── Manual cache clear (useful for testing) ─────────────────────
export function clearWeatherCache() {
  _cache.data = null;
  _cache.timestamp = 0;
}