/**
 * Motor de recomendaciones por reglas (R1–R9, S1) de la Page
 * "Pace — Arquitectura y plan del MVP". TypeScript puro: sin React ni Expo,
 * para poder probarlo con jest. Los umbrales son la propuesta inicial,
 * todavía sin calibrar; no son recomendaciones médicas.
 */
import { formatKm, formatPace, hourLabel, hourOf } from './format';
import type {
  HealthSnapshot,
  HourlyWeather,
  PaceRange,
  Reason,
  Recommendation,
  RecommendationInput,
  RouteInfo,
  SessionType,
  ShoeInfo,
} from './types';

export const THRESHOLDS = {
  sleepTargetH: 7.5,
  sleepPenaltyPerHour: 12,
  rhrPenaltyPerBpm: 4,
  penaltyCap: 30,
  heatModerate: 28,
  heatHigh: 32,
  humidityBump: 80,
  humidityBumpMinApparent: 26,
  uvHigh: 8,
  uvModerate: 6,
  rainProb: 60,
  hillyGainPerKm: 8,
  readinessQuality: 70,
  readinessRest: 50,
  shoeWarnBeforeKm: 50,
  windowStartHour: 5,
  windowEndHour: 20,
} as const;

export const DEFAULT_BASE_PACES: Record<Exclude<SessionType, 'descanso'>, PaceRange> = {
  suave: { from: 360, to: 375 }, // 6:00–6:15
  tempo: { from: 315, to: 330 }, // 5:15–5:30
  series: { from: 285, to: 300 }, // 4:45–5:00
  larga: { from: 370, to: 390 }, // 6:10–6:30
  carrera: { from: 330, to: 340 }, // ritmo objetivo de la carrera
};

export const SESSION_LABEL: Record<SessionType, string> = {
  suave: 'rodaje suave',
  tempo: 'tempo',
  series: 'series',
  larga: 'tirada larga',
  carrera: 'carrera objetivo',
  descanso: 'descanso',
};

/* ---------- R3 / R4: recuperación ---------- */
export function readiness(h: HealthSnapshot): { score: number; reasons: Reason[]; missing: number } {
  const reasons: Reason[] = [];
  let missing = 0;
  let sleepPenalty = 0;
  let rhrPenalty = 0;

  if (h.sleepHours == null) {
    missing++;
    reasons.push({ id: 'R3', text: 'Sin datos de sueño en Health Connect: no se penaliza, baja la confianza.' });
  } else {
    sleepPenalty = Math.min(
      THRESHOLDS.penaltyCap,
      Math.max(0, THRESHOLDS.sleepTargetH - h.sleepHours) * THRESHOLDS.sleepPenaltyPerHour,
    );
    if (sleepPenalty > 0) {
      reasons.push({ id: 'R3', text: `Sueño corto (${formatKm(h.sleepHours, 1)} h): −${Math.round(sleepPenalty)} de recuperación.` });
    }
  }

  if (h.restingHr == null || h.restingHrBaseline == null) {
    missing++;
    reasons.push({ id: 'R4', text: 'Sin FC en reposo o sin línea base de 7 días: no se penaliza, baja la confianza.' });
  } else {
    const delta = h.restingHr - h.restingHrBaseline;
    rhrPenalty = Math.min(THRESHOLDS.penaltyCap, Math.max(0, delta) * THRESHOLDS.rhrPenaltyPerBpm);
    if (rhrPenalty > 0) {
      reasons.push({ id: 'R4', text: `FC en reposo ${delta > 0 ? '+' : ''}${Math.round(delta)} lpm sobre tu base: −${Math.round(rhrPenalty)} de recuperación.` });
    }
  }

  return { score: Math.round(100 - sleepPenalty - rhrPenalty), reasons, missing };
}

/* ---------- R1: calor ---------- */
export function heatLevel(apparent: number, humidity: number): 0 | 1 | 2 {
  let heat = 0;
  if (apparent >= THRESHOLDS.heatHigh) heat = 2;
  else if (apparent >= THRESHOLDS.heatModerate) heat = 1;
  if (humidity >= THRESHOLDS.humidityBump && apparent >= THRESHOLDS.humidityBumpMinApparent) {
    heat = Math.min(2, heat + 1);
  }
  return heat as 0 | 1 | 2;
}

/* ---------- R2: ventana horaria ---------- */
export function pickWindow(
  hourly: HourlyWeather[],
  date: string,
  now: Date,
  uvMax: number,
): { best: HourlyWeather; desde: string; hasta: string; reason: Reason | null } | null {
  const nowIsSameDay = isSameLocalDay(now, date);
  const nowHour = now.getHours();
  const candidates = hourly.filter((h) => {
    if (!h.time.startsWith(date)) return false;
    const hr = hourOf(h.time);
    if (hr < THRESHOLDS.windowStartHour || hr > THRESHOLDS.windowEndHour) return false;
    if (nowIsSameDay && hr < nowHour) return false;
    return true;
  });
  if (candidates.length === 0) return null;

  let reason: Reason | null = null;
  let allowed = candidates;
  if (uvMax >= THRESHOLDS.uvHigh) {
    allowed = candidates.filter((h) => hourOf(h.time) < 8 || hourOf(h.time) >= 17);
    reason = { id: 'R2', text: `UV alto (máx. ${Math.round(uvMax)}): sal antes de las 08:00 o después de las 17:00.` };
  } else if (uvMax >= THRESHOLDS.uvModerate) {
    allowed = candidates.filter((h) => hourOf(h.time) < 11 || hourOf(h.time) >= 15);
    reason = { id: 'R2', text: `UV moderado (máx. ${Math.round(uvMax)}): evita 11:00–15:00.` };
  }
  if (allowed.length === 0) allowed = candidates;

  const score = (h: HourlyWeather) =>
    h.apparent + h.uv * 0.5 + (h.precipProb >= THRESHOLDS.rainProb ? 3 : 0);
  const best = allowed.reduce((a, b) => (score(b) < score(a) ? b : a));
  const endHour = Math.min(THRESHOLDS.windowEndHour + 1, hourOf(best.time) + 2);
  return {
    best,
    desde: hourLabel(best.time),
    hasta: `${String(endHour).padStart(2, '0')}:00`,
    reason,
  };
}

function isSameLocalDay(d: Date, date: string): boolean {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}` === date;
}

/* ---------- R5 / R6 / R7: ruta ---------- */
export function pickRoute(
  routes: RouteInfo[],
  km: number,
  session: SessionType,
  rainy: boolean,
): { route: RouteInfo | null; reasons: Reason[] } {
  const reasons: Reason[] = [];
  if (routes.length === 0 || km <= 0) return { route: null, reasons };
  let pool = routes.filter((r) => r.isFavorite);
  if (pool.length === 0) pool = routes;

  if (rainy) {
    const asphalt = pool.filter((r) => r.surface === 'asfalto');
    if (asphalt.length > 0) pool = asphalt;
  }

  const closest = (list: RouteInfo[]) =>
    list.reduce((a, b) => (Math.abs(b.distanceKm - km) < Math.abs(a.distanceKm - km) ? b : a));

  if (session === 'suave' || session === 'larga') {
    const naive = closest(pool);
    const flat = pool.filter((r) => r.gainM / r.distanceKm <= THRESHOLDS.hillyGainPerKm);
    if (flat.length > 0 && naive.gainM / naive.distanceKm > THRESHOLDS.hillyGainPerKm) {
      pool = flat;
      reasons.push({ id: 'R6', text: `${naive.name} tiene mucho desnivel para un ${SESSION_LABEL[session]}: se propone una ruta más plana; corre por esfuerzo.` });
    }
  }

  const chosen = closest(pool);
  const tolerance = Math.max(1, km * 0.25);
  if (Math.abs(chosen.distanceKm - km) <= tolerance) {
    if (Math.abs(chosen.distanceKm - km) >= 0.05) {
      reasons.push({ id: 'R7', text: `Distancia ajustada de ${formatKm(km, 1)} a ${formatKm(chosen.distanceKm)} km para usar ${chosen.name}.` });
    }
    return { route: chosen, reasons };
  }
  return { route: null, reasons };
}

/* ---------- S1: zapatillas ---------- */
export function shoeAlerts(shoes: ShoeInfo[]): Reason[] {
  const out: Reason[] = [];
  for (const s of shoes) {
    if (s.totalKm >= s.retireKm) {
      out.push({ id: 'S1', text: `${s.name} superó ${s.retireKm} km (${Math.round(s.totalKm)} km): toca recambio.` });
    } else if (s.totalKm >= s.retireKm - THRESHOLDS.shoeWarnBeforeKm) {
      out.push({ id: 'S1', text: `${s.name} va por ${Math.round(s.totalKm)} de ${s.retireKm} km: ve pensando en el recambio.` });
    }
  }
  return out;
}

/* ---------- Motor completo ---------- */
export function recommend(input: RecommendationInput): Recommendation {
  const razones: Reason[] = [];
  const alertas: Reason[] = [];
  const planned = input.planned;
  const basePaces = { ...DEFAULT_BASE_PACES, ...(input.basePaces ?? {}) };

  // Recuperación (R3/R4)
  const rd = readiness(input.health);
  razones.push(...rd.reasons);

  let session: SessionType = planned.type;
  let factor = 1;

  if (planned.type === 'descanso') {
    factor = 0;
    razones.push({ id: 'PLAN', text: 'El plan marca descanso hoy.' });
  } else if (planned.type === 'carrera') {
    razones.push({ id: 'PLAN', text: 'Día de carrera: no se cambia la sesión, solo el ritmo según el calor.' });
    if (rd.score < THRESHOLDS.readinessQuality) {
      alertas.push({ id: 'R8', text: `Recuperación ${rd.score}/100: sal más conservador los primeros km.` });
    }
  } else if (rd.score < THRESHOLDS.readinessRest) {
    session = 'descanso';
    factor = 0;
    razones.push({ id: 'R9', text: `Recuperación ${rd.score}/100 (< 50): descanso o 20–30 min muy suave.` });
  } else if (rd.score < THRESHOLDS.readinessQuality) {
    if (planned.type !== 'suave') {
      razones.push({ id: 'R8', text: `${cap(SESSION_LABEL[planned.type])} cambiada a rodaje suave (−30 %) por recuperación ${rd.score}/100; la sesión de calidad se mueve.` });
    } else {
      razones.push({ id: 'R8', text: `Recuperación ${rd.score}/100: se acorta el rodaje suave (−30 %).` });
    }
    session = 'suave';
    factor *= 0.7;
  } else {
    razones.push({ id: 'OK', text: `Recuperación ${rd.score}/100: se mantiene la sesión del plan.` });
  }

  // Clima (R1, R2, R5)
  let heat: 0 | 1 | 2 = 0;
  let paceAdj: [number, number] = [0, 0];
  let ventana: Recommendation['ventana'] = null;
  let rainy = false;
  if (input.weather) {
    const w = input.weather;
    const win = pickWindow(w.hourly, input.date, input.now, w.uvMax);
    const ref = win?.best ?? {
      apparent: w.current.apparent,
      humidity: w.current.humidity,
      precipProb: w.current.precipProb,
    };
    if (win) {
      ventana = { desde: win.desde, hasta: win.hasta };
      if (win.reason) razones.push(win.reason);
    }
    heat = heatLevel(ref.apparent, ref.humidity);
    if (factor > 0 && heat === 2 && session === 'carrera') {
      paceAdj = [20, 30];
      razones.push({ id: 'R1', text: `Calor alto (sensación ${Math.round(ref.apparent)} °C): ajusta el ritmo de carrera +20 a +30 s/km e hidrátate.` });
    } else if (factor > 0 && heat === 2) {
      factor *= 0.8;
      paceAdj = [20, 30];
      if (session === 'series' || session === 'tempo') session = 'suave';
      razones.push({ id: 'R1', text: `Calor alto (sensación ${Math.round(ref.apparent)} °C, humedad ${Math.round(ref.humidity)} %): +20 a +30 s/km, −20 % de distancia y sin calidad.` });
    } else if (factor > 0 && heat === 1) {
      paceAdj = [10, 15];
      razones.push({ id: 'R1', text: `Calor moderado (sensación ${Math.round(ref.apparent)} °C): +10 a +15 s/km.` });
    }
    if (ref.precipProb >= THRESHOLDS.rainProb) {
      rainy = true;
      alertas.push({ id: 'R5', text: `Lluvia probable (${Math.round(ref.precipProb)} %): superficie resbaladiza, mejor asfalto.` });
    }
  } else {
    razones.push({ id: 'W0', text: 'Sin pronóstico de Open-Meteo: no se aplican R1, R2 ni R5.' });
  }

  // Distancia y ruta (R6, R7)
  let km = Math.round(planned.km * factor * 10) / 10;
  let rutaId: string | null = null;
  let routeName: string | null = null;
  if (km > 0 && session !== 'carrera') {
    const pr = pickRoute(input.routes, km, session, rainy);
    razones.push(...pr.reasons);
    if (pr.route) {
      km = pr.route.distanceKm;
      rutaId = pr.route.id;
      routeName = pr.route.name;
    }
  }

  // Zapatillas (S1)
  alertas.push(...shoeAlerts(input.shoes));

  // Ritmo
  let ritmo: PaceRange | null = null;
  if (session !== 'descanso' && km > 0) {
    const base = basePaces[session];
    ritmo = { from: base.from + paceAdj[0], to: base.to + paceAdj[1] };
  }

  const confianza: Recommendation['confianza'] = !input.weather
    ? 'baja'
    : rd.missing === 0
      ? 'alta'
      : rd.missing === 1
        ? 'media'
        : 'baja';

  const ajuste = paceAdj[0] === 0 ? 'sin ajuste' : `+${paceAdj[0]} a +${paceAdj[1]} s/km`;

  return {
    fecha: input.date,
    sesion: session,
    planificada: planned.type,
    distancia_km: session === 'descanso' ? 0 : km,
    ruta_id: rutaId,
    ritmo_objetivo: ritmo ? `${formatPace(ritmo.from)}–${formatPace(ritmo.to)} /km` : null,
    ritmo_rango: ritmo,
    ajuste_ritmo: ajuste,
    ventana,
    recuperacion: rd.score,
    nivel_calor: heat,
    razones,
    alertas,
    confianza,
    veredicto: buildVerdict(session, km, routeName, heat, input.weather, paceAdj, ventana),
  };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildVerdict(
  session: SessionType,
  km: number,
  routeName: string | null,
  heat: 0 | 1 | 2,
  weather: RecommendationInput['weather'],
  paceAdj: [number, number],
  ventana: Recommendation['ventana'],
): string {
  if (session === 'descanso') {
    return 'Hoy toca descanso o 20–30 min muy suaves. Prioriza dormir bien esta noche.';
  }
  const humid = (weather?.current.humidity ?? 0) >= THRESHOLDS.humidityBump;
  const lead =
    heat === 2 ? 'Calor alto' : heat === 1 ? (humid ? 'Caluroso y húmedo' : 'Caluroso') : 'Buen día para correr';
  const where = routeName ? ` por ${routeName}` : '';
  const adj = paceAdj[0] > 0 ? ` Baja el ritmo habitual en +${paceAdj[1]} s/km.` : '';
  const when = ventana ? ` Mejor hora: ${ventana.desde}–${ventana.hasta}.` : '';
  return `${lead}: ${SESSION_LABEL[session]} de ${formatKm(km)} km${where}.${adj}${when}`;
}
