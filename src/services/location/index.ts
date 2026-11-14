import { createForegroundTracker } from './foreground';
import { createSimulatedTracker } from './simulated';
import type { LocationTracker } from './types';

export type GpsMode = 'gps' | 'sim';

/** En el dev build, 'gps' pasará a createBackgroundTracker() (background.devbuild.ts). */
export function createTracker(
  mode: GpsMode,
  route?: { path: [number, number][]; outAndBack: boolean },
  sim?: { paceSecPerKm?: number; speedup?: number },
): LocationTracker {
  if (mode === 'sim' && route) return createSimulatedTracker(route.path, { ...sim, outAndBack: route.outAndBack });
  return createForegroundTracker();
}
export type { LocationTracker, RawPoint } from './types';
