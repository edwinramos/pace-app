/** Ritmos de entrenamiento a partir del nivel o de un 5K reciente. */
import type { PaceRange, SessionType } from './types';

export type Level = 'principiante' | 'intermedio' | 'avanzado';

export const LEVEL_LABEL: Record<Level, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

/** Ritmo de 5K (s/km) típico por nivel si no hay marca. */
const DEFAULT_5K_PACE: Record<Level, number> = { principiante: 420, intermedio: 345, avanzado: 290 };

/** Distancia de la meta en km. */
export const GOAL_KM = { '5k': 5, '10k': 10, '21k': 21.0975 } as const;

/** Predicción de Riegel: T2 = T1 · (D2/D1)^1,06 */
export function riegel(timeS: number, fromKm: number, toKm: number): number {
  return timeS * Math.pow(toKm / fromKm, 1.06);
}

export function derivePaces(
  level: Level,
  fiveKTimeS?: number | null,
  goal: keyof typeof GOAL_KM = '10k',
): Record<Exclude<SessionType, 'descanso'>, PaceRange> {
  const p5 = fiveKTimeS && fiveKTimeS > 600 ? fiveKTimeS / 5 : DEFAULT_5K_PACE[level];
  const r = (a: number, b: number): PaceRange => ({ from: Math.round(p5 * a), to: Math.round(p5 * b) });
  const raceTime = riegel(p5 * 5, 5, GOAL_KM[goal]);
  const racePace = Math.round(raceTime / GOAL_KM[goal]);
  return {
    suave: r(1.22, 1.3),
    larga: r(1.25, 1.34),
    tempo: r(1.06, 1.1),
    series: r(0.97, 1.01),
    carrera: { from: racePace - 5, to: racePace + 5 },
  };
}

/** FC máxima estimada (Tanaka): 208 − 0,7 · edad */
export function estimateMaxHr(age: number): number {
  return Math.round(208 - 0.7 * age);
}
