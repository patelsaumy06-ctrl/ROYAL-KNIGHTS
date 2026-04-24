export const DEFAULT_WEATHER_COORDS = {
  lat: 23.03,
  lon: 72.58,
};

export const FALLBACK_WEATHER = {
  rainfallMm: 0,
  windKph: 0,
  temperatureC: 30,
};

export async function fetchWeather(lat, lon) {
  try {
    const query = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'rain,windspeed_10m,temperature_2m',
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);

    if (!response.ok) {
      throw new Error(`Open-Meteo request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const current = payload?.current || {};

    return {
      rainfallMm: Number.isFinite(current.rain) ? current.rain : 0,
      windKph: Number.isFinite(current.windspeed_10m) ? current.windspeed_10m : 0,
      temperatureC: Number.isFinite(current.temperature_2m) ? current.temperature_2m : 30,
    };
  } catch (error) {
    console.error('Failed to fetch weather data from Open-Meteo', error);
    return { ...FALLBACK_WEATHER };
  }
}

