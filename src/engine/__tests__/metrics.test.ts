import { toGPX, toJSON } from '../gpx';
import { loopAround, pathLength, simplify } from '../geo';
import { formatDist, formatPaceU, parseDmy, toDmy } from '../format';
import { paceTrend, restingBaseline, sleepVsPace, totals, weeklyStats } from '../metrics';
import type { TrackPoint } from '../run';

const day = (iso: string, h = 6) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, h).getTime();
};

describe('métricas', () => {
  const runs = [
    { startedAt: day('2026-11-02'), distanceM: 5000, movingS: 1900 },
    { startedAt: day('2026-11-04'), distanceM: 6000, movingS: 2220 },
    { startedAt: day('2026-11-10'), distanceM: 8000, movingS: 2920 },
    { startedAt: day('2026-11-14'), distanceM: 5240, movingS: 1812 },
  ];
  const now = new Date(2026, 10, 14, 12);

  it('volumen semanal por lunes, con semanas vacías', () => {
    const w = weeklyStats(runs, now, 3);
    expect(w.map((x) => x.monday)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09']);
    expect(w[0].km).toBe(0);
    expect(w[0].avgPace).toBeNull();
    expect(w[1].km).toBeCloseTo(11);
    expect(w[2].runs).toBe(2);
    expect(w[2].avgPace).toBeCloseTo((2920 + 1812) / 13.24);
  });

  it('totales', () => {
    const t = totals(runs);
    expect(t.runs).toBe(4);
    expect(t.km).toBeCloseTo(24.24);
    expect(t.longestKm).toBe(8);
    expect(t.bestPace).toBeCloseTo(1812 / 5.24);
    expect(totals([]).avgPace).toBeNull();
  });

  it('tendencia: negativa si cada vez más rápido; null con pocos datos', () => {
    const tr = paceTrend(runs, now)!;
    expect(tr.n).toBe(4);
    expect(tr.slopePerWeek).toBeLessThan(0);
    expect(paceTrend(runs.slice(0, 2), now)).toBeNull();
  });

  it('sueño vs ritmo empareja por fecha', () => {
    const p = sleepVsPace(runs, [
      { date: '2026-11-14', sleepMin: 380 },
      { date: '2026-11-10', sleepMin: 470 },
      { date: '2026-11-11', sleepMin: 400 },
    ]);
    expect(p.map((x) => x.date)).toEqual(['2026-11-10', '2026-11-14']);
    expect(p[0].sleepH).toBeCloseTo(7.83, 1);
  });

  it('línea base de FC con ≥ 3 días previos', () => {
    const h = [
      { date: '2026-11-11', restingHr: 56 },
      { date: '2026-11-12', restingHr: 58 },
      { date: '2026-11-13', restingHr: 57 },
      { date: '2026-11-14', restingHr: 70 },
    ];
    expect(restingBaseline(h, '2026-11-14')).toBe(57);
    expect(restingBaseline(h.slice(0, 2), '2026-11-14')).toBeUndefined();
  });
});

describe('GPX / JSON', () => {
  const pts: TrackPoint[] = [
    { t: Date.UTC(2026, 10, 14, 10, 0, 0), lat: 18.4718, lon: -69.8846, alt: 3, accuracy: 5, segment: 0 },
    { t: Date.UTC(2026, 10, 14, 10, 0, 5), lat: 18.4719, lon: -69.8848, alt: null, accuracy: 5, segment: 0 },
    { t: Date.UTC(2026, 10, 14, 10, 5, 0), lat: 18.4721, lon: -69.8850, alt: 4, accuracy: 5, segment: 1 },
  ];
  it('GPX 1.1 válido con un trkseg por tramo y nombre escapado', () => {
    const g = toGPX({ name: 'Malecón <ida & vuelta>', startedAt: pts[0].t }, pts);
    expect(g.startsWith('<?xml')).toBe(true);
    expect(g).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    expect(g).toContain('Malecón &lt;ida &amp; vuelta&gt;');
    expect(g.match(/<trkseg>/g)).toHaveLength(2);
    expect(g.match(/<trkpt /g)).toHaveLength(3);
    expect(g).toContain('<ele>3.0</ele>');
    expect(g).toContain('<time>2026-11-14T10:00:05.000Z</time>');
  });
  it('JSON con formato y puntos', () => {
    const j = JSON.parse(toJSON({ id: 'r1' }, pts, [{ km: 1, durationS: 300, gainM: 2 }]));
    expect(j.format).toBe('pace-run');
    expect(j.points).toHaveLength(3);
    expect(j.splits[0].durationS).toBe(300);
  });
});

describe('geo y formato', () => {
  it('simplify conserva extremos y quita puntos colineales', () => {
    const line: [number, number][] = Array.from({ length: 50 }, (_, i) => [18.46 + i * 0.0001, -69.89]);
    const s = simplify(line, 5);
    expect(s).toHaveLength(2);
    expect(pathLength(s)).toBeCloseTo(pathLength(line), 0);
  });
  it('loopAround cierra el bucle', () => {
    const l = loopAround(18.46, -69.89);
    expect(l[0][0]).toBeCloseTo(l[l.length - 1][0], 6);
    expect(pathLength(l)).toBeGreaterThan(3000);
  });
  it('unidades km/mi', () => {
    expect(formatDist(1609.344, 'mi')).toBe('1,00');
    expect(formatDist(5240, 'km')).toBe('5,24');
    expect(formatPaceU(300, 'mi')).toBe('8:03');
  });
  it('fechas dd/mm/aaaa', () => {
    expect(parseDmy('24/01/2027')).toBe('2027-01-24');
    expect(parseDmy('31/02/2027')).toBeNull();
    expect(toDmy('2027-01-24')).toBe('24/01/2027');
  });
});
