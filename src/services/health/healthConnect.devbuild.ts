/**
 * IMPLEMENTACIÓN REAL — solo para el development build (no corre en Expo Go).
 * Este archivo está excluido de tsconfig y no se importa en ningún sitio, así
 * que no entra en el bundle. Para activarlo:
 *   1) npx expo install react-native-health-connect expo-build-properties
 *   2) app.json → plugins: ["react-native-health-connect",
 *        ["expo-build-properties", { "android": { "minSdkVersion": 26 } }]]
 *   3) Declarar permisos: android.permission.health.READ_SLEEP,
 *        READ_RESTING_HEART_RATE, WRITE_EXERCISE, WRITE_DISTANCE
 *   4) Importarlo en ./index.ts (ver comentario allí).
 * API según la documentación de react-native-health-connect v4 — verificar
 * firmas exactas al instalar.
 */
import {
  initialize,
  getSdkStatus,
  SdkAvailabilityStatus,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  insertRecords,
  ExerciseType,
} from 'react-native-health-connect';
import type { HealthProvider } from './types';

const PERMS = [
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'Distance' },
] as const;

let ready = false;
async function ensure() {
  if (!ready) ready = await initialize();
  return ready;
}

function dayRange(date: string, daysBack = 0) {
  const end = new Date(`${date}T12:00:00`);
  const start = new Date(end.getTime() - (daysBack + 1) * 86400000);
  return { operator: 'between' as const, startTime: start.toISOString(), endTime: end.toISOString() };
}

export const healthConnect: HealthProvider = {
  id: 'health-connect',
  label: 'Health Connect',
  simulated: false,
  async availability() {
    const s = await getSdkStatus();
    if (s === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (s === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs_install';
    return 'unsupported';
  },
  async requestPermissions() {
    await ensure();
    const granted = await requestPermission(PERMS as any);
    return granted.length >= 2;
  },
  async hasPermissions() {
    await ensure();
    const g = await getGrantedPermissions();
    return g.some((p: any) => p.recordType === 'SleepSession') && g.some((p: any) => p.recordType === 'RestingHeartRate');
  },
  async readDaily(date) {
    await ensure();
    // Sueño: sesiones que terminan entre ayer 12:00 y hoy 12:00
    const sleep = await readRecords('SleepSession', { timeRangeFilter: dayRange(date) });
    const sleepMs = sleep.records.reduce(
      (a: number, r: any) => a + (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()), 0,
    );
    // FC en reposo: hoy y últimos 7 días para la línea base
    const rhr = await readRecords('RestingHeartRate', { timeRangeFilter: dayRange(date, 7) });
    const vals = rhr.records.map((r: any) => ({ t: new Date(r.time).getTime(), bpm: r.beatsPerMinute }));
    vals.sort((a: any, b: any) => a.t - b.t);
    const today = vals.length ? vals[vals.length - 1].bpm : undefined;
    const prev = vals.slice(0, -1);
    const baseline = prev.length >= 3 ? prev.reduce((a: number, v: any) => a + v.bpm, 0) / prev.length : undefined;
    return {
      sleepHours: sleepMs > 0 ? sleepMs / 3600000 : undefined,
      restingHr: today,
      restingHrBaseline: baseline,
      source: sleep.records[0]?.metadata?.dataOrigin ?? 'Health Connect',
    };
  },
  async saveExercise(e) {
    await ensure();
    const startTime = new Date(e.startTime).toISOString();
    const endTime = new Date(e.endTime).toISOString();
    const ids = await insertRecords([
      { recordType: 'ExerciseSession', exerciseType: ExerciseType.RUNNING, title: e.title, startTime, endTime },
      { recordType: 'Distance', distance: { unit: 'meters', value: e.distanceM }, startTime, endTime },
    ] as any);
    return ids[0];
  },
};
