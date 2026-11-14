import { computeSplits, currentPace, elevationGain, haversine, totalDistance, type TrackPoint } from '../run';
import { formatDuration, formatKm, formatPace } from '../format';

/** Recta hacia el norte a velocidad constante (m/s), un punto por segundo. */
function line(n: number, speed: number, opts: { segment?: number; t0?: number; lat0?: number; alt?: (i: number) => number } = {}): TrackPoint[] {
  const dLat = speed / 111195; // grados por segundo
  return Array.from({ length: n }, (_, i) => ({
    t: (opts.t0 ?? 0) + i * 1000,
    lat: (opts.lat0 ?? 18.46) + i * dLat,
    lon: -69.89,
    alt: opts.alt ? opts.alt(i) : null,
    accuracy: 5,
    segment: opts.segment ?? 0,
  }));
}

describe('run math', () => {
  it('haversine ~111 km por grado de latitud', () => {
    expect(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111195, -2);
  });

  it('distancia y parciales a 5:00 /km', () => {
    const pts = line(1503, 1000 / 300); // ~1500 s a 3,33 m/s = 5 km
    expect(totalDistance(pts) / 1000).toBeCloseTo(5, 1);
    const splits = computeSplits(pts);
    expect(splits.filter((s) => !s.partialKm)).toHaveLength(5);
    splits.filter((s) => !s.partialKm).forEach((s) => expect(Math.abs(s.durationS - 300)).toBeLessThanOrEqual(1));
  });

  it('no suma distancia ni tiempo entre tramos (pausa)', () => {
    const a = line(301, 1000 / 300);
    const last = a[a.length - 1];
    const b = line(301, 1000 / 300, { segment: 1, t0: last.t + 600000, lat0: last.lat + 0.01 });
    const pts = [...a, ...b];
    expect(totalDistance(pts) / 1000).toBeCloseTo(2, 1);
    const splits = computeSplits(pts);
    expect(Math.abs(splits[0].durationS - 300)).toBeLessThanOrEqual(1);
    expect(Math.abs(splits[1].durationS - 300)).toBeLessThanOrEqual(1);
  });

  it('descarta puntos con mala precisión', () => {
    const pts = line(100, 3);
    pts[50] = { ...pts[50], lat: pts[50].lat + 0.01, accuracy: 80 };
    expect(totalDistance(pts)).toBeCloseTo(297, -1);
  });

  it('ritmo actual de los últimos 30 s', () => {
    expect(currentPace(line(120, 1000 / 346))!).toBeCloseTo(346, -1);
  });

  it('desnivel positivo filtra ruido', () => {
    const pts = line(20, 3, { alt: (i) => (i < 10 ? 10 + (i % 2) * 0.4 : 10 + (i - 9) * 2) });
    expect(elevationGain(pts)).toBeCloseTo(20, 0);
  });
});

describe('format', () => {
  it('formatea en español', () => {
    expect(formatKm(5.24)).toBe('5,24');
    expect(formatPace(346)).toBe('5:46');
    expect(formatPace(null)).toBe('--:--');
    expect(formatDuration(1122)).toBe('00:18:42');
    expect(formatDuration(1812, true)).toBe('30:12');
  });
});

import { densify, gainLoss, pathLength } from '../geo';
describe('geo', () => {
  it('densify mantiene la longitud y pone puntos cada ~100 m', () => {
    const path: [number, number][] = [[18.46, -69.89], [18.47, -69.89]];
    const d = densify(path, 100);
    expect(pathLength(d)).toBeCloseTo(pathLength(path), 0);
    expect(d.length).toBe(13); // 1112 m → 0,100…1100 + final
  });
  it('gainLoss', () => {
    expect(gainLoss([0, 5, 3, 10])).toEqual({ gain: 12, loss: 2 });
  });
});
