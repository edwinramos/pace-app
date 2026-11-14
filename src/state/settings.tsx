import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as repo from '../db/repo';
import { formatDist, formatPaceU, paceLabel, unitLabel, type Units } from '../engine/format';

export type HealthSource = 'manual' | 'mock';

export interface Settings {
  units: Units;
  voice: boolean;
  healthSource: HealthSource;
  gpsMode: 'gps' | 'sim';
}

interface Ctx extends Settings {
  loaded: boolean;
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => Promise<void>;
  reload: () => Promise<void>;
  /** formateadores según unidades */
  dist: (m: number, decimals?: number) => string;
  pace: (secPerKm: number | null | undefined) => string;
  du: string; // "km" | "mi"
  pu: string; // "/km" | "/mi"
}

const DEFAULTS: Settings = { units: 'km', voice: true, healthSource: 'manual', gpsMode: 'gps' };
const C = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [units, voice, healthSource, gpsMode] = await Promise.all([
      repo.getSetting(db, 'units', DEFAULTS.units),
      repo.getSetting(db, 'voice', DEFAULTS.voice ? '1' : '0'),
      repo.getSetting(db, 'health_source', DEFAULTS.healthSource),
      repo.getSetting(db, 'gps_mode', DEFAULTS.gpsMode),
    ]);
    setS({
      units: units === 'mi' ? 'mi' : 'km',
      voice: voice === '1',
      healthSource: healthSource === 'mock' ? 'mock' : 'manual',
      gpsMode: gpsMode === 'sim' ? 'sim' : 'gps',
    });
    setLoaded(true);
  }, [db]);

  useEffect(() => {
    reload();
  }, [reload]);

  const set = useCallback(
    async <K extends keyof Settings>(k: K, v: Settings[K]) => {
      const key = k === 'healthSource' ? 'health_source' : k === 'gpsMode' ? 'gps_mode' : k;
      await repo.setSetting(db, key, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
      setS((prev) => ({ ...prev, [k]: v }));
    },
    [db],
  );

  const value = useMemo<Ctx>(
    () => ({
      ...s,
      loaded,
      set,
      reload,
      dist: (m, d = 2) => formatDist(m, s.units, d),
      pace: (p) => formatPaceU(p, s.units),
      du: unitLabel(s.units),
      pu: paceLabel(s.units),
    }),
    [s, loaded, set, reload],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useSettings(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('useSettings fuera de SettingsProvider');
  return v;
}
