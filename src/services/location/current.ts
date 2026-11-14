import * as Location from 'expo-location';

/** Ubicación actual + nombre de la zona (reverse geocoding del sistema). */
export async function currentPlace(): Promise<{ lat: number; lon: number; label: string }> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new Error('Sin permiso de ubicación.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  let label = 'Mi zona';
  try {
    const [g] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    if (g) label = [g.district ?? g.subregion, g.city ?? g.region].filter(Boolean).join(', ') || label;
  } catch {
    // sin red o sin geocoder: se queda el nombre genérico
  }
  return { lat: pos.coords.latitude, lon: pos.coords.longitude, label };
}
