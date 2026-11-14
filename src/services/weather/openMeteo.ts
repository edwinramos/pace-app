/**
 * Clima real con Open-Meteo (sin clave; plan gratis solo uso no comercial,
 * atribución CC-BY 4.0). Este archivo no importa nada de React Native para
 * poder probar el parser con jest.
 */
import type { HourlyWeather, WeatherDay } from '../../engine/types';

const BASE = 'https://api.open-meteo.com/v1';

export function forecastUrl(lat: number, lon: number): string {
  const hourly = [
    'temperature_2m',
    'apparent_temperature',
    'relative_humidity_2m',
    'dew_point_2m',
    'uv_index',
    'wind_speed_10m',
    'precipitation_probability',
  ].join(',');
  const current = [
    'temperature_2m',
    'apparent_temperature',
    'relative_humidity_2m',
    'wind_speed_10m',
    'uv_index',
    'precipitation_probability',
  ].join(',');
  return (
    `${BASE}/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=${current}&hourly=${hourly}&daily=sunrise,sunset,uv_index_max` +
    `&timezone=auto&forecast_days=2`
  );
}

/** Convierte la respuesta JSON de Open-Meteo en WeatherDay (día de `date`). */
export function parseForecast(json: any, date?: string): WeatherDay {
  const h = json.hourly;
  const hourly: HourlyWeather[] = (h.time as string[]).map((time, i) => ({
    time,
    temperature: h.temperature_2m[i],
    apparent: h.apparent_temperature[i],
    humidity: h.relative_humidity_2m[i],
    dewPoint: h.dew_point_2m?.[i] ?? NaN,
    uv: h.uv_index?.[i] ?? 0,
    windKmh: h.wind_speed_10m[i],
    precipProb: h.precipitation_probability?.[i] ?? 0,
  }));
  const day = date ?? (json.current?.time as string | undefined)?.slice(0, 10) ?? hourly[0]?.time.slice(0, 10);
  const dIdx = Math.max(0, (json.daily?.time as string[] | undefined)?.indexOf(day) ?? 0);
  const c = json.current ?? {};
  return {
    current: {
      time: c.time,
      temperature: c.temperature_2m,
      apparent: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      windKmh: c.wind_speed_10m,
      uv: c.uv_index ?? 0,
      precipProb: c.precipitation_probability ?? 0,
    },
    hourly,
    sunrise: json.daily?.sunrise?.[dIdx],
    sunset: json.daily?.sunset?.[dIdx],
    uvMax: json.daily?.uv_index_max?.[dIdx] ?? Math.max(0, ...hourly.filter((x) => x.time.startsWith(day)).map((x) => x.uv)),
  };
}

async function fetchWithTimeout(url: string, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function fetchForecast(lat: number, lon: number): Promise<any> {
  const res = await fetchWithTimeout(forecastUrl(lat, lon));
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return res.json();
}

/** Elevación (DEM 90 m): sirve para el desnivel aproximado de una ruta. Máx. 100 puntos por llamada. */
export async function fetchElevations(points: { lat: number; lon: number }[]): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 100) {
    const chunk = points.slice(i, i + 100);
    const lat = chunk.map((p) => p.lat.toFixed(5)).join(',');
    const lon = chunk.map((p) => p.lon.toFixed(5)).join(',');
    const res = await fetchWithTimeout(`${BASE}/elevation?latitude=${lat}&longitude=${lon}`);
    if (!res.ok) throw new Error(`Open-Meteo elevation ${res.status}`);
    const j = await res.json();
    out.push(...(j.elevation as number[]));
  }
  return out;
}

export interface Place {
  name: string;
  admin1?: string;
  country?: string;
  lat: number;
  lon: number;
}

/** Geocoding de Open-Meteo (sin clave) para elegir ciudad a mano. */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=es&format=json`);
  if (!res.ok) throw new Error(`Open-Meteo geocoding ${res.status}`);
  const j = await res.json();
  return parsePlaces(j);
}

export function parsePlaces(j: any): Place[] {
  return ((j?.results as any[]) ?? []).map((r) => ({
    name: r.name,
    admin1: r.admin1,
    country: r.country,
    lat: r.latitude,
    lon: r.longitude,
  }));
}
