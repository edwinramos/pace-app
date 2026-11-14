import type { SQLiteDatabase } from 'expo-sqlite';
import { EXAMPLE_ROUTES, type RouteData } from '../data/routes';
import type { Level } from '../engine/paces';
import type { GeneratedPlan, Goal, PlanConfig, PlanSession } from '../engine/plans';
import type { Split, TrackPoint } from '../engine/run';
import type { Recommendation, SessionType, ShoeInfo } from '../engine/types';
import { uid } from './index';

/* ---------- settings ---------- */
export async function getSetting(db: SQLiteDatabase, key: string, def: string): Promise<string> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r?.value ?? def;
}
export async function setSetting(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}

/* ---------- profile ---------- */
export interface Profile {
  name: string;
  age: number | null;
  max_hr: number | null;
  weight_kg: number | null;
  level: Level;
  five_k_s: number | null;
  home_lat: number;
  home_lon: number;
  home_label: string | null;
  onboarded_at: number | null;
}
export async function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  return db.getFirstAsync<Profile>(
    'SELECT name, age, max_hr, weight_kg, level, five_k_s, home_lat, home_lon, home_label, onboarded_at FROM profile WHERE id = 1',
  );
}
export async function saveProfile(db: SQLiteDatabase, p: Omit<Profile, 'onboarded_at'>) {
  await db.runAsync(
    `INSERT INTO profile (id, name, age, max_hr, weight_kg, level, five_k_s, home_lat, home_lon, home_label, onboarded_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, age = excluded.age, max_hr = excluded.max_hr,
       weight_kg = excluded.weight_kg, level = excluded.level, five_k_s = excluded.five_k_s,
       home_lat = excluded.home_lat, home_lon = excluded.home_lon, home_label = excluded.home_label`,
    p.name, p.age, p.max_hr, p.weight_kg, p.level, p.five_k_s, p.home_lat, p.home_lon, p.home_label, Date.now(),
  );
}

/* ---------- routes ---------- */
export interface StoredRoute extends RouteData {
  elevation?: number[];
  source: 'example' | 'run' | 'manual';
  createdAt: number;
}
function mapRoute(r: any): StoredRoute {
  return {
    id: r.id,
    name: r.name,
    area: r.area ?? '',
    description: r.description ?? '',
    path: JSON.parse(r.path_json),
    distanceKm: r.distance_m / 1000,
    gainM: r.gain_m,
    surface: r.surface,
    shade: r.shade,
    isFavorite: !!r.is_favorite,
    outAndBack: !!r.out_and_back,
    water: r.water ?? '',
    elevation: r.elevation_json ? JSON.parse(r.elevation_json) : undefined,
    source: r.source,
    createdAt: r.created_at,
  };
}
export async function getRoutes(db: SQLiteDatabase): Promise<StoredRoute[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM route ORDER BY is_favorite DESC, created_at DESC');
  return rows.map(mapRoute);
}
export async function getRoute(db: SQLiteDatabase, id: string): Promise<StoredRoute | null> {
  const r = await db.getFirstAsync<any>('SELECT * FROM route WHERE id = ?', id);
  return r ? mapRoute(r) : null;
}
export async function createRoute(
  db: SQLiteDatabase,
  r: { name: string; path: [number, number][]; distanceM: number; gainM?: number; outAndBack?: boolean; surface?: string; shade?: string; source: StoredRoute['source']; area?: string; description?: string; water?: string; isFavorite?: boolean; id?: string },
): Promise<string> {
  const id = r.id ?? uid('route');
  await db.runAsync(
    `INSERT OR IGNORE INTO route (id, name, area, description, path_json, distance_m, gain_m, surface, shade, is_favorite, out_and_back, water, source, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, r.name, r.area ?? null, r.description ?? null, JSON.stringify(r.path), r.distanceM, r.gainM ?? 0,
    r.surface ?? 'asfalto', r.shade ?? 'media', r.isFavorite ? 1 : 0, r.outAndBack ? 1 : 0, r.water ?? null, r.source, Date.now(),
  );
  return id;
}
export async function updateRoute(
  db: SQLiteDatabase,
  id: string,
  f: { name: string; surface: string; shade: string; isFavorite: boolean; description?: string },
) {
  await db.runAsync(
    'UPDATE route SET name = ?, surface = ?, shade = ?, is_favorite = ?, description = ? WHERE id = ?',
    f.name, f.surface, f.shade, f.isFavorite ? 1 : 0, f.description ?? null, id,
  );
}
export async function deleteRoute(db: SQLiteDatabase, id: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE run SET route_id = NULL WHERE route_id = ?', id);
    await db.runAsync('DELETE FROM route WHERE id = ?', id);
  });
}
export async function saveRouteElevation(db: SQLiteDatabase, id: string, elevation: number[], gainM: number) {
  await db.runAsync('UPDATE route SET elevation_json = ?, gain_m = ? WHERE id = ?', JSON.stringify(elevation), gainM, id);
}
export async function addExampleRoutes(db: SQLiteDatabase): Promise<number> {
  let n = 0;
  for (const r of EXAMPLE_ROUTES) {
    if (await db.getFirstAsync('SELECT id FROM route WHERE id = ?', r.id)) continue;
    n++;
    await createRoute(db, {
      id: r.id, name: `${r.name} (ejemplo)`, path: r.path, distanceM: r.distanceKm * 1000, gainM: r.gainM,
      outAndBack: r.outAndBack, surface: r.surface, shade: r.shade, source: 'example', area: r.area,
      description: r.description, water: r.water,
    });
  }
  return n;
}

/* ---------- shoes ---------- */
export interface Shoe extends ShoeInfo {
  brand: string;
  model: string;
  useNote: string | null;
  startKm: number;
  isDefault: boolean;
  retiredAt: number | null;
  runKm: number;
  runs: number;
  notifiedLevel: number;
}
export async function getShoes(db: SQLiteDatabase, includeRetired = false): Promise<Shoe[]> {
  const rows = await db.getAllAsync<any>(
    `SELECT s.*, COALESCE(SUM(r.distance_m), 0) / 1000.0 AS run_km, COUNT(r.id) AS runs
     FROM shoe s LEFT JOIN run r ON r.shoe_id = s.id
     ${includeRetired ? '' : 'WHERE s.retired_at IS NULL'}
     GROUP BY s.id ORDER BY s.retired_at IS NOT NULL, s.is_default DESC, s.created_at`,
  );
  return rows.map((r) => ({
    id: r.id,
    brand: r.brand,
    model: r.model,
    name: `${r.brand} ${r.model}`,
    useNote: r.use_note,
    startKm: r.start_km,
    retireKm: r.retire_km,
    isDefault: !!r.is_default,
    retiredAt: r.retired_at,
    runKm: r.run_km,
    runs: r.runs,
    totalKm: r.start_km + r.run_km,
    notifiedLevel: r.notified_level,
  }));
}
export async function getShoe(db: SQLiteDatabase, id: string): Promise<Shoe | null> {
  return (await getShoes(db, true)).find((s) => s.id === id) ?? null;
}
export interface ShoeInput { brand: string; model: string; useNote?: string | null; startKm: number; retireKm: number }
export async function addShoe(db: SQLiteDatabase, s: ShoeInput): Promise<string> {
  const id = uid('shoe');
  const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM shoe WHERE retired_at IS NULL');
  await db.runAsync(
    'INSERT INTO shoe (id, brand, model, use_note, start_km, retire_km, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, s.brand, s.model, s.useNote ?? null, s.startKm, s.retireKm, (count?.n ?? 0) === 0 ? 1 : 0, Date.now(),
  );
  return id;
}
export async function updateShoe(db: SQLiteDatabase, id: string, s: ShoeInput) {
  await db.runAsync(
    'UPDATE shoe SET brand = ?, model = ?, use_note = ?, start_km = ?, retire_km = ?, notified_level = 0 WHERE id = ?',
    s.brand, s.model, s.useNote ?? null, s.startKm, s.retireKm, id,
  );
}
/** Borra si no tiene carreras; si las tiene, las deja sin zapatilla. */
export async function deleteShoe(db: SQLiteDatabase, id: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE run SET shoe_id = NULL WHERE shoe_id = ?', id);
    await db.runAsync('DELETE FROM shoe WHERE id = ?', id);
  });
}
export async function setDefaultShoe(db: SQLiteDatabase, id: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE shoe SET is_default = 0');
    await db.runAsync('UPDATE shoe SET is_default = 1 WHERE id = ?', id);
  });
}
export async function retireShoe(db: SQLiteDatabase, id: string, retired: boolean) {
  await db.runAsync('UPDATE shoe SET retired_at = ?, is_default = CASE WHEN ? THEN 0 ELSE is_default END WHERE id = ?', retired ? Date.now() : null, retired ? 1 : 0, id);
}
export async function setShoeNotified(db: SQLiteDatabase, id: string, level: number) {
  await db.runAsync('UPDATE shoe SET notified_level = ? WHERE id = ?', level, id);
}

/* ---------- plans ---------- */
export interface PlanRow {
  id: string; goal: Goal; level: Level; start_date: string; goal_date: string; days: number[];
  long_day: number | null; weeks: number; status: 'active' | 'archived'; warnings: string[];
}
export async function getActivePlan(db: SQLiteDatabase): Promise<PlanRow | null> {
  const r = await db.getFirstAsync<any>("SELECT * FROM plan WHERE status = 'active' ORDER BY created_at DESC LIMIT 1");
  if (!r) return null;
  return { ...r, days: JSON.parse(r.days_json), warnings: r.warnings_json ? JSON.parse(r.warnings_json) : [] };
}
export async function createPlan(db: SQLiteDatabase, cfg: PlanConfig, gen: GeneratedPlan): Promise<string> {
  const id = uid('plan');
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE plan SET status = 'archived' WHERE status = 'active'");
    await db.runAsync(
      `INSERT INTO plan (id, goal, level, start_date, goal_date, days_json, long_day, weeks, status, warnings_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      id, cfg.goal, cfg.level, cfg.startDate, cfg.goalDate, JSON.stringify(cfg.days), cfg.longDay ?? null, gen.weeks,
      JSON.stringify(gen.warnings), Date.now(),
    );
    for (const s of gen.sessions) {
      await db.runAsync(
        'INSERT INTO plan_session (id, plan_id, date, week, day_index, type, target_km, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        uid('ps'), id, s.date, s.week, s.dayIndex, s.type, s.km, s.status, s.note ?? null,
      );
    }
  });
  return id;
}
export async function getPlanSessions(db: SQLiteDatabase, planId: string): Promise<PlanSession[]> {
  const rows = await db.getAllAsync<any>('SELECT * FROM plan_session WHERE plan_id = ? ORDER BY date', planId);
  return rows.map((r) => ({
    id: r.id, date: r.date, week: r.week, dayIndex: r.day_index, type: r.type as SessionType, km: r.target_km,
    status: r.status, runId: r.run_id, note: r.note,
  }));
}
/** Guarda solo las sesiones que cambiaron. */
export async function updateSessions(db: SQLiteDatabase, before: PlanSession[], after: PlanSession[]) {
  const prev = new Map(before.map((s) => [s.id, s]));
  const changed = after.filter((s) => {
    const p = prev.get(s.id);
    return !p || p.type !== s.type || p.km !== s.km || p.status !== s.status || (p.note ?? null) !== (s.note ?? null) || (p.runId ?? null) !== (s.runId ?? null);
  });
  if (changed.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const s of changed) {
      await db.runAsync('UPDATE plan_session SET type = ?, target_km = ?, status = ?, note = ?, run_id = ? WHERE id = ?', s.type, s.km, s.status, s.note ?? null, s.runId ?? null, s.id!);
    }
  });
}
export async function setSessionStatus(db: SQLiteDatabase, id: string, status: PlanSession['status'], runId: string | null) {
  await db.runAsync('UPDATE plan_session SET status = ?, run_id = ? WHERE id = ?', status, runId, id);
}

/* ---------- health ---------- */
export interface HealthRow { date: string; sleep_min: number | null; resting_hr: number | null; source: string; updated_at: number }
export async function getHealthDay(db: SQLiteDatabase, date: string): Promise<HealthRow | null> {
  return db.getFirstAsync<HealthRow>('SELECT * FROM health_daily WHERE date = ?', date);
}
export async function saveHealthDay(db: SQLiteDatabase, date: string, sleepMin: number | null, restingHr: number | null, source: 'manual' | 'mock' | 'health-connect') {
  await db.runAsync(
    'INSERT OR REPLACE INTO health_daily (date, sleep_min, resting_hr, source, updated_at) VALUES (?, ?, ?, ?, ?)',
    date, sleepMin, restingHr, source, Date.now(),
  );
}
export async function deleteHealthDay(db: SQLiteDatabase, date: string) {
  await db.runAsync('DELETE FROM health_daily WHERE date = ?', date);
}
export async function getHealthHistory(db: SQLiteDatabase, days = 30, source?: string): Promise<HealthRow[]> {
  if (source) return db.getAllAsync<HealthRow>('SELECT * FROM health_daily WHERE source = ? ORDER BY date DESC LIMIT ?', source, days);
  return db.getAllAsync<HealthRow>('SELECT * FROM health_daily ORDER BY date DESC LIMIT ?', days);
}

/* ---------- weather cache (TTL 1 h) ---------- */
export async function getCachedWeather(db: SQLiteDatabase, key: string, ttlMs = 3600_000): Promise<{ json: any; fetchedAt: number; fresh: boolean } | null> {
  const r = await db.getFirstAsync<{ fetched_at: number; payload_json: string }>('SELECT fetched_at, payload_json FROM weather_cache WHERE key = ?', key);
  if (!r) return null;
  return { json: JSON.parse(r.payload_json), fetchedAt: r.fetched_at, fresh: Date.now() - r.fetched_at <= ttlMs };
}
export async function putCachedWeather(db: SQLiteDatabase, key: string, json: any) {
  await db.runAsync('INSERT OR REPLACE INTO weather_cache (key, fetched_at, payload_json) VALUES (?, ?, ?)', key, Date.now(), JSON.stringify(json));
}

/* ---------- recommendation ---------- */
export async function saveRecommendation(db: SQLiteDatabase, rec: Recommendation, inputs: unknown) {
  const ruleIds = Array.from(new Set([...rec.razones, ...rec.alertas].map((r) => r.id))).join(',');
  await db.runAsync(
    `INSERT INTO recommendation (date, inputs_json, output_json, rule_ids) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET inputs_json = excluded.inputs_json, output_json = excluded.output_json, rule_ids = excluded.rule_ids`,
    rec.fecha, JSON.stringify(inputs), JSON.stringify(rec), ruleIds,
  );
}
export async function markRecommendationAccepted(db: SQLiteDatabase, date: string, accepted: boolean) {
  await db.runAsync('UPDATE recommendation SET accepted = ? WHERE date = ?', accepted ? 1 : 0, date);
}

/* ---------- runs ---------- */
export interface RunRow {
  id: string; started_at: number; ended_at: number; distance_m: number; moving_s: number; avg_pace_s: number | null;
  avg_hr: number | null; max_hr: number | null; gain_m: number | null; kcal: number | null; route_id: string | null;
  shoe_id: string | null; session_type: string | null; plan_session_id: string | null; target_from: number | null;
  target_to: number | null; recommendation_date: string | null; gps_mode: string | null; hc_record_id: string | null;
  weather_apparent: number | null; weather_humidity: number | null; notes: string | null;
}
export type NewRun = Omit<RunRow, 'id' | 'hc_record_id' | 'notes'>;

export async function saveRun(db: SQLiteDatabase, run: NewRun, points: TrackPoint[], splits: Split[]): Promise<string> {
  const id = uid('run');
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO run (id, started_at, ended_at, distance_m, moving_s, avg_pace_s, avg_hr, max_hr, gain_m, kcal, route_id,
        shoe_id, session_type, plan_session_id, target_from, target_to, recommendation_date, gps_mode, weather_apparent, weather_humidity)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, run.started_at, run.ended_at, run.distance_m, run.moving_s, run.avg_pace_s, run.avg_hr, run.max_hr, run.gain_m,
      run.kcal, run.route_id, run.shoe_id, run.session_type, run.plan_session_id, run.target_from, run.target_to,
      run.recommendation_date, run.gps_mode, run.weather_apparent, run.weather_humidity,
    );
    for (let i = 0; i < points.length; i += 200) {
      const chunk = points.slice(i, i + 200);
      const placeholders = chunk.map(() => '(?,?,?,?,?,?,?)').join(',');
      const params = chunk.flatMap((p) => [id, p.t, p.lat, p.lon, p.alt ?? null, p.accuracy ?? null, p.segment]);
      await db.runAsync(`INSERT INTO track_point (run_id, t, lat, lon, alt, accuracy, segment) VALUES ${placeholders}`, params);
    }
    for (const s of splits) {
      await db.runAsync('INSERT INTO split (run_id, km_index, duration_s, gain_m, partial_km) VALUES (?, ?, ?, ?, ?)', id, s.km, s.durationS, s.gainM, s.partialKm ?? null);
    }
    if (run.plan_session_id) {
      await db.runAsync("UPDATE plan_session SET status = 'done', run_id = ? WHERE id = ?", id, run.plan_session_id);
    }
  });
  return id;
}

export async function getRun(db: SQLiteDatabase, id: string) {
  const run = await db.getFirstAsync<RunRow>('SELECT * FROM run WHERE id = ?', id);
  if (!run) return null;
  const splits = await db.getAllAsync<{ km_index: number; duration_s: number; gain_m: number; partial_km: number | null }>(
    'SELECT km_index, duration_s, gain_m, partial_km FROM split WHERE run_id = ? ORDER BY km_index', id,
  );
  const points = await db.getAllAsync<TrackPoint>('SELECT t, lat, lon, alt, accuracy, segment FROM track_point WHERE run_id = ? ORDER BY t', id);
  return {
    run,
    points,
    splits: splits.map((s) => ({ km: s.km_index, durationS: s.duration_s, gainM: s.gain_m, partialKm: s.partial_km ?? undefined })),
  };
}
export async function listRuns(db: SQLiteDatabase, sinceMs = 0): Promise<RunRow[]> {
  return db.getAllAsync<RunRow>('SELECT * FROM run WHERE started_at >= ? ORDER BY started_at DESC', sinceMs);
}
export async function setRunHcRecord(db: SQLiteDatabase, id: string, recordId: string) {
  await db.runAsync('UPDATE run SET hc_record_id = ? WHERE id = ?', recordId, id);
}
export async function setRunShoe(db: SQLiteDatabase, id: string, shoeId: string | null) {
  await db.runAsync('UPDATE run SET shoe_id = ? WHERE id = ?', shoeId, id);
}
export async function setRunRoute(db: SQLiteDatabase, id: string, routeId: string | null) {
  await db.runAsync('UPDATE run SET route_id = ? WHERE id = ?', routeId, id);
}
export async function setRunNotes(db: SQLiteDatabase, id: string, notes: string) {
  await db.runAsync('UPDATE run SET notes = ? WHERE id = ?', notes, id);
}
/** Borra la carrera, sus puntos y parciales; la sesión del plan vuelve a "pendiente" o "perdida". */
export async function deleteRun(db: SQLiteDatabase, id: string, today: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE plan_session SET run_id = NULL, status = CASE WHEN date < ? THEN 'missed' ELSE 'planned' END WHERE run_id = ?",
      today, id,
    );
    await db.runAsync('DELETE FROM track_point WHERE run_id = ?', id);
    await db.runAsync('DELETE FROM split WHERE run_id = ?', id);
    await db.runAsync('DELETE FROM run WHERE id = ?', id);
  });
}
