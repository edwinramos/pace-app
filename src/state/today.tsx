import { useSQLiteContext } from 'expo-sqlite';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as repo from '../db/repo';
import { localDate } from '../engine/format';
import { restingBaseline } from '../engine/metrics';
import { derivePaces } from '../engine/paces';
import { reconcile, type PlanChange, type PlanSession } from '../engine/plans';
import { recommend } from '../engine/rules';
import type { HealthSnapshot, PaceRange, PlannedSession, Recommendation, SessionType, WeatherDay } from '../engine/types';
import { health } from '../services/health';
import { fetchForecast, parseForecast } from '../services/weather/openMeteo';
import { useSettings } from './settings';

export interface TodayState {
  loading: boolean;
  needsOnboarding: boolean;
  date: string;
  profile: repo.Profile | null;
  weather: WeatherDay | null;
  weatherStatus: 'live' | 'cache' | 'stale' | 'error' | 'loading';
  healthData: HealthSnapshot | null;
  healthOrigin: 'manual' | 'mock' | 'none';
  plan: repo.PlanRow | null;
  sessions: PlanSession[];
  todaySession: PlanSession | null;
  planChanges: PlanChange[];
  planned: PlannedSession;
  routes: repo.StoredRoute[];
  shoes: repo.Shoe[];
  paces: Record<Exclude<SessionType, 'descanso'>, PaceRange>;
  rec: Recommendation | null;
  error: string | null;
  refresh: (forceWeather?: boolean) => Promise<void>;
}

const Ctx = createContext<TodayState | null>(null);

const EMPTY: Omit<TodayState, 'refresh'> = {
  loading: true,
  needsOnboarding: false,
  date: localDate(new Date()),
  profile: null,
  weather: null,
  weatherStatus: 'loading',
  healthData: null,
  healthOrigin: 'none',
  plan: null,
  sessions: [],
  todaySession: null,
  planChanges: [],
  planned: { type: 'suave', km: 5 },
  routes: [],
  shoes: [],
  paces: derivePaces('intermedio'),
  rec: null,
  error: null,
};

export function TodayProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const settings = useSettings();
  const [state, setState] = useState(EMPTY);

  const refresh = useCallback(
    async (forceWeather = false) => {
      const now = new Date();
      const date = localDate(now);
      try {
        const profile = await repo.getProfile(db);
        if (!profile?.onboarded_at) {
          setState({ ...EMPTY, loading: false, needsOnboarding: true, date });
          return;
        }
        const [routes, shoes, plan] = await Promise.all([repo.getRoutes(db), repo.getShoes(db), repo.getActivePlan(db)]);

        // Clima (Open-Meteo, caché 1 h; sin red → última lectura)
        const key = `${profile.home_lat.toFixed(2)},${profile.home_lon.toFixed(2)}`;
        const cached = await repo.getCachedWeather(db, key);
        let weatherJson: any = null;
        let weatherStatus: TodayState['weatherStatus'] = 'error';
        if (cached?.fresh && !forceWeather) {
          weatherJson = cached.json;
          weatherStatus = 'cache';
        } else {
          try {
            weatherJson = await fetchForecast(profile.home_lat, profile.home_lon);
            await repo.putCachedWeather(db, key, weatherJson);
            weatherStatus = 'live';
          } catch {
            weatherJson = cached?.json ?? null;
            weatherStatus = cached ? 'stale' : 'error';
          }
        }
        let weather: WeatherDay | null = null;
        try {
          weather = weatherJson ? parseForecast(weatherJson, date) : null;
          if (weather && !weather.hourly.some((h) => h.time.startsWith(date))) weather = null; // caché de otro día
        } catch {
          weather = null;
        }
        if (!weather && weatherStatus !== 'error') weatherStatus = 'error';

        // Recuperación: manual del día > simulado (si está elegido) > nada
        let healthData: HealthSnapshot | null = null;
        let healthOrigin: TodayState['healthOrigin'] = 'none';
        const row = await repo.getHealthDay(db, date);
        if (row && row.source === 'manual') {
          healthData = { sleepHours: row.sleep_min != null ? row.sleep_min / 60 : undefined, restingHr: row.resting_hr ?? undefined, source: 'Manual' };
          healthOrigin = 'manual';
        } else if (settings.healthSource === 'mock') {
          healthData = await health.readDaily(date);
          if (!row) await repo.saveHealthDay(db, date, healthData.sleepHours != null ? healthData.sleepHours * 60 : null, healthData.restingHr ?? null, 'mock');
          healthOrigin = 'mock';
        }
        if (healthData) {
          const hist = await repo.getHealthHistory(db, 14, healthOrigin === 'manual' ? 'manual' : undefined);
          const base = restingBaseline(hist.map((h) => ({ date: h.date, restingHr: h.resting_hr })), date);
          healthData = { ...healthData, restingHrBaseline: base ?? healthData.restingHrBaseline };
        }

        // Plan: poner al día (R10/R11) y sesión de hoy
        let sessions: PlanSession[] = [];
        let planChanges: PlanChange[] = [];
        if (plan) {
          const before = await repo.getPlanSessions(db, plan.id);
          const r = reconcile(before, date);
          await repo.updateSessions(db, before, r.sessions);
          sessions = r.sessions;
          planChanges = r.changes;
        }
        const todaySession = sessions.find((s) => s.date === date) ?? null;
        const planned: PlannedSession = todaySession ? { type: todaySession.type, km: todaySession.km } : { type: 'suave', km: 5 };

        const paces = derivePaces(profile.level, profile.five_k_s, plan?.goal ?? '10k');
        const input = { date, now, weather: weather ?? undefined, health: healthData ?? {}, planned, routes, shoes, basePaces: paces };
        const rec = recommend(input);
        await repo.saveRecommendation(db, rec, {
          date, planned, health: healthData, healthOrigin,
          weather: weather ? { current: weather.current, uvMax: weather.uvMax } : null,
          routes: routes.map((r) => r.id),
        });

        setState({
          loading: false, needsOnboarding: false, date, profile, weather, weatherStatus, healthData, healthOrigin,
          plan, sessions, todaySession, planChanges, planned, routes, shoes, paces, rec, error: null,
        });
      } catch (e: any) {
        setState((s) => ({ ...s, loading: false, error: String(e?.message ?? e) }));
      }
    },
    [db, settings.healthSource],
  );

  useEffect(() => {
    if (settings.loaded) refresh();
  }, [refresh, settings.loaded]);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useToday(): TodayState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToday fuera de TodayProvider');
  return v;
}
