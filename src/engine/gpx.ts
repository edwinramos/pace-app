/** Exportación GPX 1.1 y JSON de una carrera (puro). */
import type { Split, TrackPoint } from './run';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function toGPX(run: { name: string; startedAt: number; type?: string | null }, points: TrackPoint[]): string {
  const segs = new Map<number, TrackPoint[]>();
  for (const p of points) {
    if (!segs.has(p.segment)) segs.set(p.segment, []);
    segs.get(p.segment)!.push(p);
  }
  const body = [...segs.values()]
    .map(
      (seg) =>
        '    <trkseg>\n' +
        seg
          .map(
            (p) =>
              `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">` +
              (p.alt != null ? `<ele>${p.alt.toFixed(1)}</ele>` : '') +
              `<time>${new Date(p.t).toISOString()}</time></trkpt>`,
          )
          .join('\n') +
        '\n    </trkseg>',
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Pace" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(run.name)}</name><time>${new Date(run.startedAt).toISOString()}</time></metadata>
  <trk>
    <name>${esc(run.name)}</name>
    <type>running</type>
${body}
  </trk>
</gpx>
`;
}

export function toJSON(run: Record<string, unknown>, points: TrackPoint[], splits: Split[]): string {
  return JSON.stringify({ format: 'pace-run', version: 1, run, splits, points }, null, 2);
}
