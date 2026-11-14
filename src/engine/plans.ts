/**
 * Planes 5K / 10K / 21K generados desde la meta y la fecha, y su adaptación.
 * TypeScript puro (sin Expo) para probarlo con jest.
 */
import { localDate } from './format';
import { GOAL_KM, type Level } from './paces';
import type { SessionType } from './types';

export type Goal = '5k' | '10k' | '21k';

export const GOAL_INFO: Record<Goal, { label: string; minWeeks: number; idealWeeks: number }> = {
  '5k': { label: '5K', minWeeks: 4, idealWeeks: 8 },
  '10k': { label: '10K', minWeeks: 6, idealWeeks: 10 },
  '21k': { label: 'Media maratón', minWeeks: 8, idealWeeks: 14 },
};

export const MAX_WEEKS = 24;

/** km semanales de partida según meta y nivel */
const BASE_KM: Record<Goal, Record<Level, number>> = {
  '5k': { principiante: 10, intermedio: 18, avanzado: 26 },
  '10k': { principiante: 14, intermedio: 24, avanzado: 34 },
  '21k': { principiante: 20, intermedio: 30, avanzado: 42 },
};
const LONG_CAP: Record<Goal, Record<Level, number>> = {
  '5k': { principiante: 6, intermedio: 8, avanzado: 10 },
  '10k': { principiante: 10, intermedio: 12, avanzado: 15 },
  '21k': { principiante: 16, intermedio: 19, avanzado: 22 },
};

export interface PlanConfig {
  goal: Goal;
  level: Level;
  startDate: string; // YYYY-MM-DD (hoy normalmente)
  goalDate: string; // día de la carrera
  days: number[]; // días disponibles, 0 = lunes … 6 = domingo
  longDay?: number;
}

export type SessionStatus = 'planned' | 'done' | 'missed' | 'skipped';

export interface PlanSession {
  date: string;
  week: number;
  dayIndex: number; // 0 = lunes
  type: SessionType;
  km: number;
  status: SessionStatus;
  note?: string | null;
  id?: string;
  runId?: string | null;
}

export interface GeneratedPlan {
  weeks: number;
  sessions: PlanSession[];
  warnings: string[];
  firstMonday: string;
}

/* ---------- fechas ---------- */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return localDate(d);
}
/** Lunes de la semana de una fecha. */
export function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - dow);
  return out;
}
export function mondayIso(iso: string): string {
  return localDate(mondayOf(parseDate(iso)));
}
export function dayIndexOf(iso: string): number {
  return (parseDate(iso).getDay() + 6) % 7;
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

const round05 = (x: number) => Math.round(x * 2) / 2;

/** Elige el día de la tirada larga: el pedido, o domingo, o sábado, o el último disponible. */
export function pickLongDay(days: number[], preferred?: number): number {
  if (preferred != null && days.includes(preferred)) return preferred;
  if (days.includes(6)) return 6;
  if (days.includes(5)) return 5;
  return days[days.length - 1];
}

/** Distancia circular entre dos días de la semana. */
function dayGap(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 7 - d);
}

/** Asigna tipos a los días disponibles de una semana normal. */
export function weekLayout(days: number[], longDay: number, level: Level, week: number): Map<number, SessionType> {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const out = new Map<number, SessionType>();
  for (const d of sorted) out.set(d, 'suave');
  out.set(longDay, 'larga');
  const rest = sorted.filter((d) => d !== longDay);
  const qualityAllowed = !(level === 'principiante' && week <= 2);
  if (sorted.length >= 3 && qualityAllowed) {
    // calidad lo más lejos posible de la larga
    const q1 = rest.reduce((a, b) => (dayGap(b, longDay) > dayGap(a, longDay) ? b : a));
    out.set(q1, level === 'principiante' ? 'tempo' : week % 2 === 1 ? 'series' : 'tempo');
    if (sorted.length >= 5 && level !== 'principiante') {
      const candidates = rest.filter((d) => d !== q1 && dayGap(d, q1) >= 2 && dayGap(d, longDay) >= 2);
      if (candidates.length) out.set(candidates[0], out.get(q1) === 'series' ? 'tempo' : 'series');
    }
  }
  return out;
}

/** Volumen semanal para la semana w de n. */
export function weekVolume(goal: Goal, level: Level, w: number, n: number): number {
  const base = BASE_KM[goal][level];
  const taper = goal === '21k' && n >= 6 ? 2 : 1;
  const build = Math.max(1, n - taper);
  if (w > build) {
    const k = n - w; // 0 = semana de la carrera
    return base * (k === 0 ? 0.55 : 0.75) * 1.3;
  }
  // con muchos meses de margen, las primeras semanas son de base plana
  const rampStart = Math.max(1, build - 16 + 1);
  const ramp = w < rampStart ? 0 : (w - rampStart) / Math.max(1, build - rampStart);
  let vol = base * (1 + 0.5 * ramp);
  if (w % 4 === 0 && w < build) vol *= 0.8; // semana de descarga
  return vol;
}

export function generatePlan(cfg: PlanConfig): GeneratedPlan {
  const warnings: string[] = [];
  const days = [...new Set(cfg.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (days.length < 2) throw new Error('Elige al menos 2 días por semana.');
  if (daysBetween(cfg.startDate, cfg.goalDate) < 7) throw new Error('La fecha de la carrera debe ser al menos una semana después de hoy.');

  let firstMonday = mondayIso(cfg.startDate);
  const raceMonday = mondayIso(cfg.goalDate);
  let n = daysBetween(firstMonday, raceMonday) / 7 + 1;
  if (n > MAX_WEEKS) {
    firstMonday = addDays(raceMonday, -(MAX_WEEKS - 1) * 7);
    n = MAX_WEEKS;
    warnings.push(`Faltan más de ${MAX_WEEKS} semanas: el plan empieza el ${firstMonday}. Hasta entonces, rodajes suaves libres.`);
  }
  const info = GOAL_INFO[cfg.goal];
  if (n < info.minWeeks) warnings.push(`Solo hay ${n} semanas; para ${info.label} se recomiendan al menos ${info.minWeeks}. El plan va comprimido.`);

  const longDay = pickLongDay(days, cfg.longDay);
  const sessions: PlanSession[] = [];
  const raceDay = dayIndexOf(cfg.goalDate);

  for (let w = 1; w <= n; w++) {
    const monday = addDays(firstMonday, (w - 1) * 7);
    const vol = weekVolume(cfg.goal, cfg.level, w, n);
    const isRaceWeek = w === n;
    let layout: Map<number, SessionType>;
    if (isRaceWeek) {
      layout = new Map();
      // 2 rodajes cortos antes de la carrera, nada después
      const before = days.filter((d) => d < raceDay - 1).slice(-2);
      for (const d of before) layout.set(d, 'suave');
      layout.set(raceDay, 'carrera');
    } else {
      layout = weekLayout(days, longDay, cfg.level, w);
    }

    const types = [...layout.entries()];
    const longKm = Math.min(LONG_CAP[cfg.goal][cfg.level], vol * 0.33);
    const qualityKm = Math.max(3, vol * 0.18);
    const fixed = types.reduce((a, [, t]) => a + (t === 'larga' ? longKm : t === 'series' || t === 'tempo' ? qualityKm : 0), 0);
    const easyCount = types.filter(([, t]) => t === 'suave').length;
    const easyKm = Math.max(3, (vol - fixed) / Math.max(1, easyCount));

    for (let d = 0; d < 7; d++) {
      const date = addDays(monday, d);
      if (date < cfg.startDate || date > cfg.goalDate) continue;
      const t = layout.get(d) ?? 'descanso';
      let km = 0;
      if (t === 'larga') km = round05(longKm);
      else if (t === 'series' || t === 'tempo') km = round05(qualityKm);
      else if (t === 'suave') km = round05(isRaceWeek ? Math.min(easyKm, 4) : easyKm);
      else if (t === 'carrera') km = GOAL_KM[cfg.goal];
      sessions.push({ date, week: w, dayIndex: d, type: t, km, status: 'planned' });
    }
  }
  return { weeks: n, sessions, warnings, firstMonday };
}

/* ---------- adaptación ---------- */

export interface PlanChange {
  rule: string;
  text: string;
}

const KEY: SessionType[] = ['series', 'tempo', 'larga'];

/**
 * Mueve una sesión clave a un rodaje suave posterior de la misma semana,
 * evitando el día anterior a una larga o carrera. Devuelve true si la movió.
 */
export function deferSession(sessions: PlanSession[], idx: number, today: string, note: string): boolean {
  const s = sessions[idx];
  const weekEnd = addDays(mondayIso(s.date), 6);
  const targetIdx = sessions.findIndex((x, i) => {
    if (i === idx || x.status !== 'planned' || x.type !== 'suave') return false;
    if (x.date < today || x.date <= s.date || x.date > weekEnd) return false;
    const next = sessions.find((y) => y.date === addDays(x.date, 1));
    return !(next && (next.type === 'larga' || next.type === 'carrera'));
  });
  if (targetIdx < 0) return false;
  const t = sessions[targetIdx];
  sessions[targetIdx] = { ...t, type: s.type, km: Math.max(t.km, s.km), note };
  return true;
}

/**
 * Pone el plan al día:
 *  - R10: sesiones pasadas sin carrera → "perdida"; si era clave se mueve dentro de la semana.
 *  - R11: 2 o más sesiones perdidas en 7 días → los próximos 7 días bajan un 10 %.
 * Idempotente (usa las notas como marca).
 */
export function reconcile(input: PlanSession[], today: string): { sessions: PlanSession[]; changes: PlanChange[] } {
  const sessions = input.map((s) => ({ ...s }));
  const changes: PlanChange[] = [];

  sessions.forEach((s, i) => {
    if (s.status === 'planned' && s.date < today && s.type !== 'descanso') {
      sessions[i] = { ...s, status: 'missed' };
      changes.push({ rule: 'R10', text: `Sesión del ${s.date} (${s.type}) marcada como perdida.` });
      if (KEY.includes(s.type) && daysBetween(s.date, today) <= 6) {
        const moved = deferSession(sessions, i, today, `R10: movida desde el ${s.date}`);
        if (moved) changes.push({ rule: 'R10', text: `La ${s.type} perdida se movió a otro día de la semana.` });
      }
    }
  });

  const weekAgo = addDays(today, -7);
  const recentMissed = sessions.filter((s) => s.status === 'missed' && s.date >= weekAgo && s.date < today).length;
  if (recentMissed >= 2) {
    // los próximos 7 días a partir de hoy
    const nextMonday = today;
    const nextSunday = addDays(today, 6);
    let touched = false;
    sessions.forEach((s, i) => {
      if (s.date >= nextMonday && s.date <= nextSunday && s.status === 'planned' && s.type !== 'carrera' && s.type !== 'descanso' && !(s.note ?? '').includes('R11')) {
        sessions[i] = { ...s, km: Math.max(3, round05(s.km * 0.9)), note: [s.note, 'R11: −10 % por sesiones perdidas'].filter(Boolean).join(' · ') };
        touched = true;
      }
    });
    if (touched) changes.push({ rule: 'R11', text: `${recentMissed} sesiones perdidas en 7 días: los próximos 7 días bajan un 10 %.` });
  }
  return { sessions, changes };
}

/**
 * R8 aplicada al plan: si hoy el motor cambió una sesión clave por suave,
 * se guarda la versión suave hoy y la clave se intenta mover a otro día.
 */
export function applyDailyAdaptation(
  input: PlanSession[],
  today: string,
  rec: { sesion: SessionType; distancia_km: number },
): { sessions: PlanSession[]; changes: PlanChange[] } {
  const sessions = input.map((s) => ({ ...s }));
  const changes: PlanChange[] = [];
  const i = sessions.findIndex((s) => s.date === today && s.status === 'planned');
  if (i < 0) return { sessions, changes };
  const s = sessions[i];
  if ((s.note ?? '').includes('R8')) return { sessions, changes };
  if (KEY.includes(s.type) && (rec.sesion === 'suave' || rec.sesion === 'descanso')) {
    const original = { ...s };
    sessions[i] = { ...s, type: rec.sesion, km: rec.distancia_km, note: `R8: ${s.type} cambiada por recuperación` };
    const tmp = [...sessions];
    tmp[i] = original;
    const moved = deferSession(tmp, i, addDays(today, 1), `R8: movida desde el ${today}`);
    if (moved) {
      tmp.forEach((x, j) => {
        if (j !== i) sessions[j] = x;
      });
    }
    changes.push({ rule: 'R8', text: moved ? `La ${s.type} de hoy pasa a otro día de esta semana.` : `La ${s.type} de hoy se cambió; no hay hueco esta semana para recuperarla.` });
  }
  return { sessions, changes };
}

/** Marca como hecha la sesión de ese día (o la perdida más reciente de la misma semana si hoy era descanso). */
export function matchRunToSession(sessions: PlanSession[], runDate: string): number {
  const same = sessions.findIndex((s) => s.date === runDate && s.type !== 'descanso' && s.status !== 'done');
  if (same >= 0) return same;
  const monday = mondayIso(runDate);
  let best = -1;
  sessions.forEach((s, i) => {
    if (s.status === 'missed' && s.date >= monday && s.date < runDate) best = i;
  });
  return best;
}

export function weekOf(sessions: PlanSession[], monday: string): PlanSession[] {
  const end = addDays(monday, 6);
  return sessions.filter((s) => s.date >= monday && s.date <= end);
}
