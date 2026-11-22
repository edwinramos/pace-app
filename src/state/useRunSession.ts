import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatPace } from '../engine/format';
import { computeSplits, currentPace, elevationGain, totalDistance, type Split, type TrackPoint } from '../engine/run';
import { createTracker, type GpsMode, type LocationTracker, type TreadmillTracker } from '../services/location';

export type RunStatus = 'idle' | 'running' | 'paused' | 'finished';

/**
 * Estado de una carrera en vivo. El tiempo en movimiento sale del reloj de
 * pared en modo GPS / caminadora y de los timestamps virtuales en modo simulado
 * (que puede ir acelerado).
 */
export function useRunSession(opts: {
  mode: GpsMode;
  route?: { path: [number, number][]; outAndBack: boolean };
  speedup?: number;
  initialSpeedKmh?: number;
  initialInclinePct?: number;
  origin?: { lat: number; lon: number };
  voice: boolean;
}) {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [treadmillSpeedKmh, setTreadmillSpeedState] = useState<number>(
    Math.max(1, Math.min(25, Math.round((opts.initialSpeedKmh ?? 10) * 10) / 10)),
  );
  const [treadmillInclinePct, setTreadmillInclineState] = useState<number>(
    Math.max(0, Math.min(15, Math.round((opts.initialInclinePct ?? 1) * 2) / 2)),
  );

  const tracker = useRef<LocationTracker | null>(null);
  const segment = useRef(0);
  const startedAt = useRef<number | null>(null);
  const accMs = useRef(0);
  const resumedAt = useRef<number | null>(null);
  const announced = useRef(0);
  const voiceRef = useRef(opts.voice);
  voiceRef.current = opts.voice;

  if (!tracker.current) {
    tracker.current = createTracker(opts.mode, opts.route, {
      speedup: opts.speedup,
      initialSpeedKmh: treadmillSpeedKmh,
      initialInclinePct: treadmillInclinePct,
      origin: opts.origin,
    });
  }

  const setTreadmillSpeed = useCallback((kmh: number) => {
    const clamped = Math.max(1, Math.min(25, Math.round(kmh * 10) / 10));
    setTreadmillSpeedState(clamped);
    if (tracker.current && tracker.current.mode === 'treadmill') {
      (tracker.current as TreadmillTracker).setSpeedKmh(clamped);
    }
  }, []);

  const setTreadmillIncline = useCallback((pct: number) => {
    const clamped = Math.max(0, Math.min(15, Math.round(pct * 2) / 2));
    setTreadmillInclineState(clamped);
    if (tracker.current && tracker.current.mode === 'treadmill') {
      (tracker.current as TreadmillTracker).setInclinePct(clamped);
    }
  }, []);

  // refresco del cronómetro
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const begin = useCallback(async () => {
    setError(null);
    await tracker.current!.start(
      (p) => setPoints((prev) => [...prev, { ...p, segment: segment.current }]),
      (msg) => setError(msg),
    );
  }, []);

  const start = useCallback(async () => {
    startedAt.current = Date.now();
    resumedAt.current = Date.now();
    setStatus('running');
    await begin();
  }, [begin]);

  const pause = useCallback(() => {
    tracker.current?.stop();
    if (resumedAt.current) accMs.current += Date.now() - resumedAt.current;
    resumedAt.current = null;
    setStatus('paused');
  }, []);

  const resume = useCallback(async () => {
    segment.current += 1;
    resumedAt.current = Date.now();
    setStatus('running');
    await begin();
  }, [begin]);

  const finish = useCallback(() => {
    tracker.current?.stop();
    if (resumedAt.current) accMs.current += Date.now() - resumedAt.current;
    resumedAt.current = null;
    setStatus('finished');
    Speech.stop();
  }, []);

  useEffect(() => () => tracker.current?.stop(), []);

  // métricas derivadas
  const distanceM = totalDistance(points);
  let movingS: number;
  if (opts.mode === 'sim') {
    movingS = 0;
    const bySeg = new Map<number, { a: number; b: number }>();
    for (const p of points) {
      const s = bySeg.get(p.segment);
      if (!s) bySeg.set(p.segment, { a: p.t - 1000, b: p.t });
      else s.b = p.t;
    }
    bySeg.forEach((s) => (movingS += (s.b - s.a) / 1000));
  } else {
    movingS = (accMs.current + (resumedAt.current ? Date.now() - resumedAt.current : 0)) / 1000;
  }
  const splits: Split[] = computeSplits(points);
  const pace = opts.mode === 'treadmill' ? 3600 / treadmillSpeedKmh : currentPace(points);
  const avgPace = distanceM > 50 ? movingS / (distanceM / 1000) : null;

  // coach por voz cada km (expo-speech funciona en Expo Go)
  useEffect(() => {
    const done = splits.filter((s) => !s.partialKm);
    if (done.length > announced.current) {
      announced.current = done.length;
      if (voiceRef.current) {
        const last = done[done.length - 1];
        Speech.speak(`Kilómetro ${last.km}. Parcial ${spokenPace(last.durationS)}. Ritmo medio ${spokenPace(avgPace ?? last.durationS)}.`, { language: 'es-ES' });
      }
    }
  }, [splits.length, avgPace]);

  return {
    status,
    points,
    error,
    distanceM,
    movingS,
    splits,
    pace,
    avgPace,
    gainM: elevationGain(points),
    startedAt: startedAt.current,
    treadmillSpeedKmh,
    treadmillInclinePct,
    setTreadmillSpeed,
    setTreadmillIncline,
    start,
    pause,
    resume,
    finish,
  };
}

function spokenPace(sec: number) {
  const [m, s] = formatPace(sec).split(':');
  return `${Number(m)} minutos ${Number(s)} segundos`;
}
