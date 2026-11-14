import type { TrackPoint } from '../../engine/run';

export type RawPoint = Omit<TrackPoint, 'segment'>;

export interface LocationTracker {
  readonly mode: 'gps' | 'sim';
  /** pide permiso y empieza a emitir puntos */
  start(onPoint: (p: RawPoint) => void, onError?: (msg: string) => void): Promise<void>;
  stop(): void;
}
