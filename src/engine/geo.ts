import { haversine } from './run';

/** Longitud de un trazado [lat, lon][] en metros. */
export function pathLength(path: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) {
    d += haversine({ lat: path[i - 1][0], lon: path[i - 1][1] }, { lat: path[i][0], lon: path[i][1] });
  }
  return d;
}

/** Puntos cada `stepM` metros a lo largo del trazado (incluye extremos). */
export function densify(path: [number, number][], stepM = 100): [number, number][] {
  if (path.length < 2) return path;
  const out: [number, number][] = [path[0]];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = haversine({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] });
    let pos = stepM - carry;
    while (pos < len) {
      const f = pos / len;
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      pos += stepM;
    }
    carry = len - (pos - stepM);
  }
  out.push(path[path.length - 1]);
  return out;
}

/** Desnivel + y − de una serie de cotas. */
export function gainLoss(elev: number[]): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < elev.length; i++) {
    const d = elev[i] - elev[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  return { gain, loss };
}

/** Simplificación Douglas–Peucker (tolerancia en metros, aprox. plana). */
export function simplify(path: [number, number][], tolM = 8): [number, number][] {
  if (path.length <= 2) return path;
  const k = Math.cos((path[0][0] * Math.PI) / 180);
  const xy = path.map(([lat, lon]) => [lon * 111320 * k, lat * 110540]);
  const keep = new Array(path.length).fill(false);
  keep[0] = keep[path.length - 1] = true;
  const stack: [number, number][] = [[0, path.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    const [x1, y1] = xy[a];
    const [x2, y2] = xy[b];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = xy[i];
      const d = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tolM && idx > 0) {
      keep[idx] = true;
      stack.push([a, idx], [idx, b]);
    }
  }
  return path.filter((_, i) => keep[i]);
}

/** Bucle aproximado alrededor de un punto (para la carrera libre simulada). */
export function loopAround(lat: number, lon: number, radiusM = 700, n = 24): [number, number][] {
  const k = Math.cos((lat * Math.PI) / 180);
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([lat + (radiusM * Math.sin(a)) / 110540, lon + (radiusM * Math.cos(a) * 1.3) / (111320 * k)]);
  }
  return pts;
}
