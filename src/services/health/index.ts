import { mockHealth } from './mock';
import type { HealthProvider } from './types';

/**
 * Proveedor activo. Expo Go no incluye el módulo nativo de Health Connect,
 * así que por ahora siempre es el mock.
 *
 * En el dev build (F4): instalar `react-native-health-connect` (v4, trae su
 * config plugin), añadir el plugin en app.json con minSdkVersion 26, y
 * cambiar esta línea por:
 *   export const health: HealthProvider =
 *     Constants.executionEnvironment === ExecutionEnvironment.StoreClient
 *       ? mockHealth : healthConnect;   // ver healthConnect.devbuild.ts
 */
export const health: HealthProvider = mockHealth;
export type { HealthProvider } from './types';
