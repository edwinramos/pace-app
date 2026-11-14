/** Cálculos puros de la carrera: distancia, ritmo, parciales y desnivel. */
export interface TrackPoint {
  t: number; // epoch ms
  lat: number;
  lon: number;
  alt?: number | null;
  accuracy?: number | null;
  /** tramo: sube al reanudar tras una pausa, para no sumar distancia en pausa */
  segment: number;
}

export interface Split {
  km: number; // 1, 2, 3…
  durationS: number;
  gainM: number;
  partialKm?: number; // para el último parcial incompleto
}

export const MAX_ACCURACY_M = 30;

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function goodPoints(points: TrackPoint[]): TrackPoint[] {
  return points.filter((p) => p.accuracy == null || p.accuracy <= MAX_ACCURACY_M);
}

export function totalDistance(points: TrackPoint[]): number {
  const pts = goodPoints(points);
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].segment !== pts[i - 1].segment) continue;
    d += haversine(pts[i - 1], pts[i]);
  }
  return d;
}

/** Desnivel positivo con umbral de 1 m para filtrar ruido del GPS. */
export function elevationGain(points: TrackPoint[], noiseM = 1): number {
  const pts = goodPoints(points).filter((p) => p.alt != null);
  let gain = 0;
  let ref = pts[0]?.alt ?? 0;
  for (const p of pts.slice(1)) {
    const diff = (p.alt as number) - ref;
    if (diff >= noiseM) {
      gain += diff;
      ref = p.alt as number;
    } else if (diff <= -noiseM) {
      ref = p.alt as number;
    }
  }
  return gain;
}

/** Ritmo (s/km) de los últimos `windowS` segundos del tramo actual. */
export function currentPace(points: TrackPoint[], windowS = 30): number | null {
  const pts = goodPoints(points);
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1];
  const recent = pts.filter((p) => p.segment === last.segment && last.t - p.t <= windowS * 1000);
  if (recent.length < 2) return null;
  const d = totalDistance(recent);
  const dt = (recent[recent.length - 1].t - recent[0].t) / 1000;
  if (d < 10 || dt <= 0) return null;
  return dt / (d / 1000);
}

/**
 * Parciales por km. El tiempo se mide solo dentro de cada tramo (las pausas no cuentan).
 * El último parcial, si está incompleto, se devuelve con partialKm.
 */
export function computeSplits(points: TrackPoint[]): Split[] {
  const pts = goodPoints(points);
  const splits: Split[] = [];
  let dist = 0;
  let splitTime = 0;
  let splitGain = 0;
  let nextKm = 1000;
  let lastAlt = pts[0]?.alt ?? null;

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a.segment !== b.segment) {
      lastAlt = b.alt ?? lastAlt;
      continue;
    }
    let seg = haversine(a, b);
    let segTime = (b.t - a.t) / 1000;
    if (b.alt != null && lastAlt != null && b.alt - lastAlt > 0) splitGain += b.alt - lastAlt;
    if (b.alt != null) lastAlt = b.alt;

    while (dist + seg >= nextKm && seg > 0) {
      const need = nextKm - dist;
      const frac = need / seg;
      const tPart = segTime * frac;
      splitTime += tPart;
      splits.push({ km: splits.length + 1, durationS: Math.round(splitTime), gainM: Math.round(splitGain) });
      dist = nextKm;
      seg -= need;
      segTime -= tPart;
      splitTime = 0;
      splitGain = 0;
      nextKm += 1000;
    }
    dist += seg;
    splitTime += segTime;
  }
  const rest = dist - (nextKm - 1000);
  if (rest >= 50) {
    splits.push({
      km: splits.length + 1,
      durationS: Math.round(splitTime),
      gainM: Math.round(splitGain),
      partialKm: Math.round(rest) / 1000,
    });
  }
  return splits;
}

/** s/km de un parcial (normaliza los incompletos). */
export function splitPace(s: Split): number {
  return s.durationS / (s.partialKm ?? 1);
}

/** Estimación grosera: ~1 kcal por kg y km. */
export function estimateKcal(distanceM: number, weightKg = 70): number {
  return Math.round((distanceM / 1000) * weightKg);
}
