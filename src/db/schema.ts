/**
 * Esquema SQLite (expo-sqlite), migraciones por PRAGMA user_version.
 * SQL directo; Drizzle queda para el dev build.
 */
export const TABLES = [
  'settings', 'profile', 'health_daily', 'weather_cache', 'route', 'shoe', 'run',
  'track_point', 'split', 'plan', 'plan_session', 'recommendation',
];

export const MIGRATIONS: string[] = [
  // v1
  `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, age INTEGER, max_hr INTEGER, weight_kg REAL,
    level TEXT NOT NULL DEFAULT 'intermedio', five_k_s REAL, home_lat REAL NOT NULL, home_lon REAL NOT NULL,
    home_label TEXT, onboarded_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS health_daily (
    date TEXT PRIMARY KEY NOT NULL, sleep_min REAL, resting_hr REAL, source TEXT NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS weather_cache (key TEXT PRIMARY KEY NOT NULL, fetched_at INTEGER NOT NULL, payload_json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS route (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, area TEXT, description TEXT, path_json TEXT NOT NULL,
    distance_m REAL NOT NULL, gain_m REAL NOT NULL DEFAULT 0, surface TEXT NOT NULL DEFAULT 'asfalto',
    shade TEXT NOT NULL DEFAULT 'media', is_favorite INTEGER NOT NULL DEFAULT 0, out_and_back INTEGER NOT NULL DEFAULT 0,
    water TEXT, elevation_json TEXT, source TEXT NOT NULL DEFAULT 'run', created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS shoe (
    id TEXT PRIMARY KEY NOT NULL, brand TEXT NOT NULL, model TEXT NOT NULL, use_note TEXT,
    start_km REAL NOT NULL DEFAULT 0, retire_km REAL NOT NULL DEFAULT 600, is_default INTEGER NOT NULL DEFAULT 0,
    retired_at INTEGER, notified_level INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS run (
    id TEXT PRIMARY KEY NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER NOT NULL,
    distance_m REAL NOT NULL, moving_s REAL NOT NULL, avg_pace_s REAL, avg_hr REAL, max_hr REAL,
    gain_m REAL, kcal REAL, route_id TEXT, shoe_id TEXT, session_type TEXT, plan_session_id TEXT,
    target_from REAL, target_to REAL, recommendation_date TEXT, gps_mode TEXT, hc_record_id TEXT,
    weather_apparent REAL, weather_humidity REAL, notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_run_started ON run (started_at);
  CREATE TABLE IF NOT EXISTS track_point (
    run_id TEXT NOT NULL, t INTEGER NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL,
    alt REAL, accuracy REAL, segment INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_track_point_run ON track_point (run_id, t);
  CREATE TABLE IF NOT EXISTS split (
    run_id TEXT NOT NULL, km_index INTEGER NOT NULL, duration_s REAL NOT NULL, gain_m REAL,
    partial_km REAL, avg_hr REAL, PRIMARY KEY (run_id, km_index)
  );
  CREATE TABLE IF NOT EXISTS plan (
    id TEXT PRIMARY KEY NOT NULL, goal TEXT NOT NULL, level TEXT NOT NULL, start_date TEXT NOT NULL,
    goal_date TEXT NOT NULL, days_json TEXT NOT NULL, long_day INTEGER, weeks INTEGER NOT NULL,
    status TEXT NOT NULL, warnings_json TEXT, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS plan_session (
    id TEXT PRIMARY KEY NOT NULL, plan_id TEXT NOT NULL, date TEXT NOT NULL, week INTEGER NOT NULL,
    day_index INTEGER NOT NULL, type TEXT NOT NULL, target_km REAL NOT NULL, status TEXT NOT NULL,
    run_id TEXT, note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_plan_session ON plan_session (plan_id, date);
  CREATE TABLE IF NOT EXISTS recommendation (
    date TEXT PRIMARY KEY NOT NULL, inputs_json TEXT NOT NULL, output_json TEXT NOT NULL,
    rule_ids TEXT NOT NULL, accepted INTEGER
  );
  `,
];
