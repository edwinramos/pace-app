import type { LocationTracker, RawPoint } from './types';

export interface TreadmillTracker extends LocationTracker {
  readonly mode: 'treadmill';
  setSpeedKmh(kmh: number): void;
  setInclinePct(pct: number): void;
  getSpeedKmh(): number;
  getInclinePct(): number;
}

/**
 * Tracker de caminadora (corrida en casa):
 * Avanza a la velocidad (km/h) e inclinación (%) elegidas en vivo por el corredor.
 * Genera coordenadas sintéticas hacia el norte desde `origin` para que todo el
 * motor de parciales (computeSplits), distancia (totalDistance) y desnivel
 * (elevationGain) funcione exactamente igual que en exterior.
 */
export function createTreadmillTracker(opts: {
  initialSpeedKmh?: number;
  initialInclinePct?: number;
  origin?: { lat: number; lon: number };
} = {}): TreadmillTracker {
  let speedKmh = Math.max(1, Math.min(25, opts.initialSpeedKmh ?? 10));
  let inclinePct = Math.max(0, Math.min(15, opts.initialInclinePct ?? 1));
  const originLat = opts.origin?.lat ?? 18.4655;
  const originLon = opts.origin?.lon ?? -69.8863;

  // 1 metro en latitud sobre una esfera de radio R = 6371000 m
  const DEG_PER_METER = 180 / (Math.PI * 6371000);

  let timer: ReturnType<typeof setInterval> | null = null;
  let lat = originLat;
  let alt = 10;
  let lastT: number | null = null;

  return {
    mode: 'treadmill',
    setSpeedKmh(kmh: number) {
      speedKmh = Math.max(1, Math.min(25, Math.round(kmh * 10) / 10));
    },
    setInclinePct(pct: number) {
      inclinePct = Math.max(0, Math.min(15, Math.round(pct * 2) / 2));
    },
    getSpeedKmh() {
      return speedKmh;
    },
    getInclinePct() {
      return inclinePct;
    },
    async start(onPoint) {
      lastT = Date.now();
      // Emitir punto inicial del tramo
      onPoint({ t: lastT, lat, lon: originLon, alt, accuracy: 1 });
      timer = setInterval(() => {
        const now = Date.now();
        const dtS = Math.max(0.1, (now - (lastT ?? now - 1000)) / 1000);
        lastT = now;
        const distM = (speedKmh / 3.6) * dtS;
        lat += distM * DEG_PER_METER;
        alt += distM * (inclinePct / 100);
        const p: RawPoint = {
          t: now,
          lat,
          lon: originLon,
          alt,
          accuracy: 1,
        };
        onPoint(p);
      }, 1000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      lastT = null;
    },
  };
}
