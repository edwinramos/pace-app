/**
 * GPS EN SEGUNDO PLANO — solo dev build (Expo Go en Android no permite
 * ubicación en segundo plano). Excluido de tsconfig y del bundle.
 * Para activarlo:
 *   - app.json → expo-location plugin con
 *       { "isAndroidBackgroundLocationEnabled": true,
 *         "isAndroidForegroundServiceEnabled": true }
 *   - Importar este archivo en el arranque (app/_layout.tsx) para que
 *     TaskManager.defineTask se registre a nivel de módulo.
 *   - Para uso personal (APK propio) no hace falta la declaración de Play;
 *     solo al publicar.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { LocationTracker, RawPoint } from './types';

export const RUN_TASK = 'pace-run-location';
let listener: ((p: RawPoint) => void) | null = null;

TaskManager.defineTask(RUN_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  for (const loc of locations) {
    listener?.({
      t: loc.timestamp,
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
      alt: loc.coords.altitude,
      accuracy: loc.coords.accuracy,
    });
    // TODO: si la UI no está viva, persistir directamente en SQLite (track_point)
  }
});

export function createBackgroundTracker(): LocationTracker {
  return {
    mode: 'gps',
    async start(onPoint, onError) {
      const fg = await Location.requestForegroundPermissionsAsync();
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (fg.status !== 'granted' || bg.status !== 'granted') {
        onError?.('Hace falta permiso de ubicación "Permitir todo el tiempo".');
        return;
      }
      listener = onPoint;
      await Location.startLocationUpdatesAsync(RUN_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 2,
        foregroundService: {
          notificationTitle: 'Pace · carrera en curso',
          notificationBody: 'Grabando tu recorrido con GPS',
          notificationColor: '#C6F432',
        },
        pausesUpdatesAutomatically: false,
      });
    },
    stop() {
      listener = null;
      Location.stopLocationUpdatesAsync(RUN_TASK).catch(() => {});
    },
  };
}
