import type { HealthSnapshot } from '../../engine/types';

export type HealthAvailability = 'available' | 'needs_install' | 'unsupported';

export interface ExerciseToSave {
  startTime: number; // epoch ms
  endTime: number;
  distanceM: number;
  title: string;
  kcal?: number;
}

/**
 * Única vía de datos del reloj en Android: Health Connect.
 * La UI solo conoce esta interfaz; en Expo Go se usa el mock.
 */
export interface HealthProvider {
  readonly id: 'mock' | 'health-connect';
  readonly label: string;
  readonly simulated: boolean;
  availability(): Promise<HealthAvailability>;
  /** permisos de lectura de sueño y FC en reposo + escritura de ExerciseSession */
  requestPermissions(): Promise<boolean>;
  hasPermissions(): Promise<boolean>;
  /** sueño de anoche, FC en reposo de hoy y su línea base de 7 días */
  readDaily(date: string): Promise<HealthSnapshot>;
  /** guarda la carrera como sesión de ejercicio; devuelve el id del registro */
  saveExercise(e: ExerciseToSave): Promise<string>;
}
