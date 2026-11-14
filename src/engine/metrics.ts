/** Métricas a partir del historial real de carreras (puro). */
import { localDate } from './format';
import { addDays, mondayOf } from './plans';

export interface RunLite {
  startedAt: number;
  distanceM: number;
  movingS: number;
  sessionType?: string | null;
}

export interface WeekStat {
  monday: string;
  km: number;
  runs: number;
  avgPace: number | null;
}

export function weeklyStats(runs: RunLite[], now: Date, weeks = 8): WeekStat[] {
  const thisMonday = localDate(mondayOf(now));
  const out: WeekStat[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = addDays(thisMonday, -7 * i);
    const end = addDays(monday, 7);
    const wr = runs.filter((r) => {
      const d = localDate(new Date(r.startedAt));
      return d >= monday && d < end;
    });
    const km = wr.reduce((a, r) => a + r.distanceM, 0) / 1000;
    const s = wr.reduce((a, r) => a + r.movingS, 0);
    out.push({ monday, km, runs: wr.length, avgPace: km > 0 ? s / km : null });
  }
  return out;
}

export function totals(runs: RunLite[]) {
  const km = runs.reduce((a, r) => a + r.distanceM, 0) / 1000;
  const s = runs.reduce((a, r) => a + r.movingS, 0);
  const longest = runs.reduce((a, r) => Math.max(a, r.distanceM), 0) / 1000;
  const paces = runs.filter((r) => r.distanceM >= 1000).map((r) => r.movingS / (r.distanceM / 1000));
  return {
    runs: runs.length,
    km,
    movingS: s,
    avgPace: km > 0 ? s / km : null,
    longestKm: longest,
    bestPace: paces.length ? Math.min(...paces) : null,
  };
}

/**
 * Tendencia de ritmo: pendiente (s/km por semana) de una regresión lineal
 * sobre las carreras de ≥ 1 km de los últimos `days` días. Negativo = más rápido.
 * Devuelve null con menos de `minRuns` carreras.
 */
export function paceTrend(runs: RunLite[], now: Date, days = 90, minRuns = 4): { slopePerWeek: number; n: number } | null {
  const since = now.getTime() - days * 86400000;
  const pts = runs
    .filter((r) => r.startedAt >= since && r.distanceM >= 1000)
    .map((r) => ({ x: (r.startedAt - since) / (7 * 86400000), y: r.movingS / (r.distanceM / 1000) }));
  if (pts.length < minRuns) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  if (den === 0) return null;
  return { slopePerWeek: num / den, n: pts.length };
}

/** Pares sueño de la noche anterior → ritmo de la carrera de ese día. */
export function sleepVsPace(
  runs: RunLite[],
  health: { date: string; sleepMin: number | null }[],
): { date: string; sleepH: number; pace: number }[] {
  const byDate = new Map(health.filter((h) => h.sleepMin != null).map((h) => [h.date, (h.sleepMin as number) / 60]));
  const out: { date: string; sleepH: number; pace: number }[] = [];
  for (const r of runs) {
    if (r.distanceM < 1000) continue;
    const d = localDate(new Date(r.startedAt));
    const s = byDate.get(d);
    if (s != null) out.push({ date: d, sleepH: s, pace: r.movingS / (r.distanceM / 1000) });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Línea base de FC en reposo: media de los 7 días previos (≥ 3 valores). */
export function restingBaseline(history: { date: string; restingHr: number | null }[], today: string): number | undefined {
  const weekAgo = addDays(today, -7);
  const vals = history.filter((h) => h.date < today && h.date >= weekAgo && h.restingHr != null).map((h) => h.restingHr as number);
  if (vals.length < 3) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
