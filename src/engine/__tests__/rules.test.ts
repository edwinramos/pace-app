import { heatLevel, pickRoute, pickWindow, readiness, recommend, shoeAlerts } from '../rules';
import type { HourlyWeather, RecommendationInput, RouteInfo, WeatherDay } from '../types';

const malecon: RouteInfo = { id: 'malecon-5k', name: 'Malecón de Santo Domingo', distanceKm: 5.24, gainM: 18, surface: 'asfalto', shade: 'media', isFavorite: true };
const mirador: RouteInfo = { id: 'mirador-sur-8k', name: 'Parque Mirador Sur', distanceKm: 8, gainM: 40, surface: 'asfalto', shade: 'alta', isFavorite: true };
const loma: RouteInfo = { id: 'loma-5k', name: 'Subida Los Ríos', distanceKm: 5, gainM: 90, surface: 'mixta', shade: 'baja', isFavorite: true };

function hours(date: string, f: (h: number) => Partial<HourlyWeather>): HourlyWeather[] {
  return Array.from({ length: 24 }, (_, h) => ({
    time: `${date}T${String(h).padStart(2, '0')}:00`,
    temperature: 27, apparent: 29, humidity: 75, dewPoint: 22, uv: 0, windKmh: 12, precipProb: 10,
    ...f(h),
  }));
}

function weather(date: string, f: (h: number) => Partial<HourlyWeather>, uvMax = 8): WeatherDay {
  const hourly = hours(date, f);
  return {
    current: { time: `${date}T13:00`, temperature: 30, apparent: 33, humidity: 70, windKmh: 15, uv: 7, precipProb: 10 },
    hourly, uvMax, sunrise: `${date}T06:40`, sunset: `${date}T17:50`,
  };
}

const D = '2026-11-14';
const early = new Date(2026, 10, 14, 4, 30);

function base(over: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    date: D, now: early,
    weather: weather(D, (h) => ({ apparent: h < 8 ? 27 : 33, uv: h >= 9 && h <= 15 ? 9 : 1 })),
    health: { sleepHours: 8, restingHr: 56, restingHrBaseline: 57 },
    planned: { type: 'suave', km: 5 },
    routes: [malecon, mirador],
    shoes: [],
    ...over,
  };
}

describe('readiness (R3/R4)', () => {
  it('coincide con el simulador de la Page: 6,3 h y +5 lpm => 66', () => {
    // sueño: (7,5−6,3)×12 = 14,4 ; FC: 5×4 = 20 ; 100−34,4 = 65,6 → 66
    expect(readiness({ sleepHours: 6.3, restingHr: 62, restingHrBaseline: 57 }).score).toBe(66);
  });
  it('limita cada penalización a 30', () => {
    expect(readiness({ sleepHours: 2, restingHr: 80, restingHrBaseline: 55 }).score).toBe(40);
  });
  it('sin datos no penaliza pero cuenta los faltantes', () => {
    const r = readiness({});
    expect(r.score).toBe(100);
    expect(r.missing).toBe(2);
  });
});

describe('heatLevel (R1)', () => {
  it.each([
    [27, 60, 0],
    [28, 60, 1],
    [32, 60, 2],
    [27, 85, 1],
    [30, 85, 2],
    [25, 90, 0],
  ])('sensación %p °C, humedad %p %% => %p', (a, h, lvl) => {
    expect(heatLevel(a, h)).toBe(lvl);
  });
});

describe('pickWindow (R2)', () => {
  it('con UV ≥ 8 elige antes de 08:00 o desde 17:00', () => {
    const w = weather(D, (h) => ({ apparent: h === 12 ? 20 : 30 + (h === 6 ? -3 : 0) }));
    const r = pickWindow(w.hourly, D, early, 9)!;
    expect(r.desde).toBe('06:00');
    expect(r.hasta).toBe('08:00');
    expect(r.reason?.id).toBe('R2');
  });
  it('no propone horas ya pasadas', () => {
    const r = pickWindow(weather(D, () => ({})).hourly, D, new Date(2026, 10, 14, 18, 10), 9)!;
    expect(Number(r.desde.slice(0, 2))).toBeGreaterThanOrEqual(18);
  });
  it('devuelve null si no quedan horas útiles', () => {
    expect(pickWindow(weather(D, () => ({})).hourly, D, new Date(2026, 10, 14, 22, 0), 3)).toBeNull();
  });
});

describe('pickRoute (R5/R6/R7)', () => {
  it('R7 ajusta a la ruta favorita más cercana', () => {
    const r = pickRoute([malecon, mirador], 5, 'suave', false);
    expect(r.route?.id).toBe('malecon-5k');
    expect(r.reasons.map((x) => x.id)).toContain('R7');
  });
  it('R6 evita la ruta con desnivel en un suave', () => {
    const r = pickRoute([loma, malecon], 5, 'suave', false);
    expect(r.route?.id).toBe('malecon-5k');
    expect(r.reasons.map((x) => x.id)).toContain('R6');
  });
  it('R5 con lluvia prefiere asfalto', () => {
    const r = pickRoute([loma, malecon], 5, 'tempo', true);
    expect(r.route?.surface).toBe('asfalto');
  });
  it('no fuerza una ruta demasiado distinta', () => {
    expect(pickRoute([malecon], 12, 'larga', false).route).toBeNull();
  });
});

describe('shoeAlerts (S1)', () => {
  it('alerta ≥ 600 y aviso ≥ 550', () => {
    const a = shoeAlerts([
      { id: 'a', name: 'Pegasus 41', totalKm: 617, retireKm: 600 },
      { id: 'b', name: 'Adizero SL', totalKm: 560, retireKm: 600 },
      { id: 'c', name: 'Nueva', totalKm: 100, retireKm: 600 },
    ]);
    expect(a).toHaveLength(2);
    expect(a[0].text).toMatch(/superó 600/);
    expect(a[1].text).toMatch(/560 de 600/);
  });
});

describe('recommend', () => {
  it('caso del prototipo: larga 8 km, sueño 6h20, FC +5, calor y humedad => suave en el Malecón', () => {
    const r = recommend(base({
      planned: { type: 'larga', km: 8 },
      health: { sleepHours: 6 + 20 / 60, restingHr: 62, restingHrBaseline: 57 },
      weather: weather(D, (h) => ({ apparent: h < 8 ? 29 : 34, humidity: 80, uv: h >= 9 && h <= 15 ? 9 : 1 })),
      shoes: [{ id: 'peg', name: 'Pegasus 41', totalKm: 617, retireKm: 600 }],
    }));
    expect(r.recuperacion).toBe(66);
    expect(r.sesion).toBe('suave');
    expect(r.planificada).toBe('larga');
    // 8 × 0,7 (R8) × 0,8 (R1 alto) = 4,5 → R7 lo ajusta al Malecón
    expect(r.distancia_km).toBe(5.24);
    expect(r.ruta_id).toBe('malecon-5k');
    expect(r.ajuste_ritmo).toBe('+20 a +30 s/km');
    expect(r.ritmo_objetivo).toBe('6:20–6:45 /km');
    expect(r.ventana?.desde).toBe('05:00');
    const ids = r.razones.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['R3', 'R4', 'R8', 'R1', 'R2', 'R7']));
    expect(r.alertas.map((x) => x.id)).toContain('S1');
    expect(r.confianza).toBe('alta');
    expect(r.veredicto).toMatch(/rodaje suave de 5,24 km por Malecón/);
  });

  it('R9: recuperación < 50 => descanso', () => {
    const r = recommend(base({ health: { sleepHours: 4, restingHr: 70, restingHrBaseline: 57 }, planned: { type: 'series', km: 6 } }));
    expect(r.sesion).toBe('descanso');
    expect(r.distancia_km).toBe(0);
    expect(r.razones.map((x) => x.id)).toContain('R9');
  });

  it('buena recuperación y fresco mantiene la sesión de calidad', () => {
    const r = recommend(base({
      planned: { type: 'tempo', km: 8 },
      weather: weather(D, () => ({ apparent: 24, humidity: 60, uv: 3 }), 4),
    }));
    expect(r.sesion).toBe('tempo');
    expect(r.ajuste_ritmo).toBe('sin ajuste');
    expect(r.distancia_km).toBe(8);
    expect(r.ruta_id).toBe('mirador-sur-8k');
  });

  it('calor alto convierte series en suave', () => {
    const r = recommend(base({
      planned: { type: 'series', km: 6 },
      weather: weather(D, () => ({ apparent: 33, humidity: 70, uv: 3 }), 4),
    }));
    expect(r.sesion).toBe('suave');
    expect(r.nivel_calor).toBe(2);
  });

  it('sin clima ni datos del reloj: confianza baja y no inventa datos', () => {
    const r = recommend(base({ weather: undefined, health: {} }));
    expect(r.confianza).toBe('baja');
    expect(r.recuperacion).toBe(100);
    expect(r.ventana).toBeNull();
  });

  it('falta un dato del reloj => confianza media', () => {
    expect(recommend(base({ health: { sleepHours: 7.5 } })).confianza).toBe('media');
  });

  it('descanso del plan se respeta', () => {
    const r = recommend(base({ planned: { type: 'descanso', km: 0 } }));
    expect(r.sesion).toBe('descanso');
    expect(r.ritmo_objetivo).toBeNull();
  });
});
