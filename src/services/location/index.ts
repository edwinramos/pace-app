import { createForegroundTracker } from './foreground';
import { createSimulatedTracker } from './simulated';
import { createTreadmillTracker, type TreadmillTracker } from './treadmill';
import type { LocationTracker } from './types';

export type GpsMode = 'gps' | 'treadmill' | 'sim';

/** En el dev build, 'gps' pasará a createBackgroundTracker() (background.devbuild.ts). */
export function createTracker(
  mode: GpsMode,
  route?: { path: [number, number][]; outAndBack: boolean },
  opts?: {
    paceSecPerKm?: number;
    speedup?: number;
    initialSpeedKmh?: number;
    initialInclinePct?: number;
    origin?: { lat: number; lon: number };
  },
): LocationTracker {
  if (mode === 'treadmill') {
    return createTreadmillTracker({
      initialSpeedKmh: opts?.initialSpeedKmh,
      initialInclinePct: opts?.initialInclinePct,
      origin: opts?.origin,
    });
  }
  if (mode === 'sim' && route) return createSimulatedTracker(route.path, { ...opts, outAndBack: route.outAndBack });
  return createForegroundTracker();
}
export { createTreadmillTracker, type TreadmillTracker } from './treadmill';
export type { LocationTracker, RawPoint } from './types';
