import * as Location from 'expo-location';
import type { LocationTracker, RawPoint } from './types';

/**
 * GPS real en primer plano con expo-location (funciona en Expo Go).
 * Limitación: si la pantalla se apaga o la app pasa a segundo plano,
 * Android deja de entregar puntos. La versión con foreground service
 * está en background.devbuild.ts (requiere dev build).
 */
export function createForegroundTracker(): LocationTracker {
  let sub: Location.LocationSubscription | null = null;
  return {
    mode: 'gps',
    async start(onPoint, onError) {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        onError?.('Sin permiso de ubicación. Actívalo en Ajustes o usa el modo simulado.');
        return;
      }
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) onError?.('El GPS del teléfono está apagado.');
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
        (loc) => {
          const p: RawPoint = {
            t: loc.timestamp,
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
            alt: loc.coords.altitude,
            accuracy: loc.coords.accuracy,
          };
          onPoint(p);
        },
        (reason) => onError?.(String(reason)),
      );
    },
    stop() {
      sub?.remove();
      sub = null;
    },
  };
}
