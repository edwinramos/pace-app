import { forecastUrl, parseForecast } from '../../services/weather/openMeteo';
import { recommend } from '../rules';

// Recorte con la misma forma que la respuesta real de Open-Meteo para Santo Domingo (14 nov 2026)
const hours = Array.from({ length: 24 }, (_, h) => `2026-11-14T${String(h).padStart(2, '0')}:00`);
const temp = [27.6, 27.7, 27.6, 27.5, 27.4, 27.3, 27.0, 26.7, 27.8, 28.8, 29.7, 30.0, 30.4, 30.6, 29.9, 29.8, 28.8, 28.8, 27.7, 26.9, 26.9, 26.9, 26.9, 26.7];
const fixture = {
  timezone: 'America/Santo_Domingo',
  current: { time: '2026-11-14T13:15', temperature_2m: 30.5, apparent_temperature: 34.1, relative_humidity_2m: 68, wind_speed_10m: 21.4, uv_index: 6.65, precipitation_probability: 81 },
  hourly: {
    time: hours,
    temperature_2m: temp,
    apparent_temperature: temp.map((t) => t + 4),
    relative_humidity_2m: temp.map((t) => (t < 28 ? 82 : 68)),
    dew_point_2m: temp.map(() => 23),
    uv_index: hours.map((_, h) => (h >= 9 && h <= 15 ? 8.5 : h >= 7 && h <= 17 ? 3 : 0)),
    wind_speed_10m: temp.map(() => 18),
    precipitation_probability: hours.map((_, h) => (h >= 12 && h <= 15 ? 80 : 20)),
  },
  daily: { time: ['2026-11-14', '2026-11-15'], sunrise: ['2026-11-14T06:44', '2026-11-15T06:45'], sunset: ['2026-11-14T17:52', '2026-11-15T17:52'], uv_index_max: [8.6, 8.2] },
};

describe('Open-Meteo', () => {
  it('URL sin clave con las variables que usa el motor', () => {
    const u = forecastUrl(18.4655, -69.8863);
    expect(u).toContain('api.open-meteo.com/v1/forecast');
    expect(u).toContain('apparent_temperature');
    expect(u).toContain('uv_index_max');
    expect(u).not.toMatch(/apikey|key=/i);
  });

  it('parsea y alimenta el motor', () => {
    const w = parseForecast(fixture, '2026-11-14');
    expect(w.hourly).toHaveLength(24);
    expect(w.uvMax).toBe(8.6);
    expect(w.current.apparent).toBe(34.1);
    const r = recommend({
      date: '2026-11-14',
      now: new Date(2026, 10, 14, 5, 0),
      weather: w,
      health: { sleepHours: 6 + 20 / 60, restingHr: 62, restingHrBaseline: 57 },
      planned: { type: 'larga', km: 8 },
      routes: [{ id: 'malecon-5k', name: 'Malecón de Santo Domingo', distanceKm: 5.24, gainM: 18, surface: 'asfalto', shade: 'media', isFavorite: true }],
      shoes: [],
    });
    // UV ≥ 8: solo antes de 08:00 o desde 17:00; 19:00 tiene la menor sensación + UV
    expect(r.ventana?.desde).toBe('19:00');
    expect(r.sesion).toBe('suave');
    expect(r.ruta_id).toBe('malecon-5k');
  });
});
