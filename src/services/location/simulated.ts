import { haversine } from '../../engine/run';
import type { LocationTracker, RawPoint } from './types';

/**
 * Tracker simulado: recorre el trazado de la ruta (ida y vuelta) a un ritmo
 * dado, con ruido de GPS. `speedup` acelera el tiempo para probar en casa
 * (x1 = tiempo real). Los timestamps son "virtuales" y coherentes con el ritmo.
 */
export function createSimulatedTracker(
  path: [number, number][],
  opts: { paceSecPerKm?: number; speedup?: number; outAndBack?: boolean } = {},
): LocationTracker {
  const pace = opts.paceSecPerKm ?? 345;
  const speedup = opts.speedup ?? 1;
  const speed = 1000 / pace; // m/s
  const pts = opts.outAndBack === false ? path : [...path, ...path.slice(0, -1).reverse()];
  let timer: ReturnType<typeof setInterval> | null = null;
  // estado fuera de start() para que pausar/reanudar siga desde el mismo sitio
  let seg = 0;
  let along = 0; // metros dentro del segmento actual
  let virtualT = Date.now();

  return {
    mode: 'sim',
    async start(onPoint) {
      const tick = () => {
        virtualT += 1000; // un punto por segundo virtual
        // pequeña variación de ritmo (fatiga + oleaje)
        const v = speed * (1 + Math.sin(virtualT / 90000) * 0.04);
        let move = v;
        while (move > 0) {
          const a = pts[seg % (pts.length - 1)];
          const b = pts[(seg % (pts.length - 1)) + 1];
          const len = haversine({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] });
          if (along + move < len) {
            along += move;
            move = 0;
          } else {
            move -= len - along;
            along = 0;
            seg++;
          }
        }
        const a = pts[seg % (pts.length - 1)];
        const b = pts[(seg % (pts.length - 1)) + 1];
        const len = haversine({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] }) || 1;
        const f = along / len;
        const noise = () => (Math.random() - 0.5) * 0.00002;
        const p: RawPoint = {
          t: virtualT,
          lat: a[0] + (b[0] - a[0]) * f + noise(),
          lon: a[1] + (b[1] - a[1]) * f + noise(),
          alt: 3 + Math.sin(seg + f) * 2,
          accuracy: 4 + Math.random() * 4,
        };
        onPoint(p);
      };
      timer = setInterval(() => {
        for (let i = 0; i < speedup; i++) tick();
      }, 1000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
