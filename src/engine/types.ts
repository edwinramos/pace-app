export type SessionType = 'suave' | 'tempo' | 'series' | 'larga' | 'carrera' | 'descanso';

export interface HourlyWeather {
  /** ISO local, p. ej. "2026-11-14T06:00" */
  time: string;
  temperature: number;
  apparent: number;
  humidity: number;
  dewPoint: number;
  uv: number;
  windKmh: number;
  precipProb: number;
}

export interface WeatherDay {
  current: {
    time: string;
    temperature: number;
    apparent: number;
    humidity: number;
    windKmh: number;
    uv: number;
    precipProb: number;
  };
  hourly: HourlyWeather[];
  sunrise?: string;
  sunset?: string;
  uvMax: number;
}

export interface HealthSnapshot {
  /** horas de sueño de anoche; undefined si Health Connect no lo tiene */
  sleepHours?: number;
  restingHr?: number;
  /** media de FC en reposo de los últimos 7 días */
  restingHrBaseline?: number;
  source?: string;
}

export interface RouteInfo {
  id: string;
  name: string;
  distanceKm: number;
  gainM: number;
  surface: 'asfalto' | 'mixta' | 'tierra' | 'pista';
  shade: 'baja' | 'media' | 'alta';
  isFavorite: boolean;
}

export interface ShoeInfo {
  id: string;
  name: string;
  totalKm: number;
  retireKm: number;
}

export interface PlannedSession {
  type: SessionType;
  km: number;
}

export interface PaceRange {
  /** segundos por km */
  from: number;
  to: number;
}

export interface RecommendationInput {
  date: string; // YYYY-MM-DD
  now: Date;
  weather?: WeatherDay;
  health: HealthSnapshot;
  planned: PlannedSession;
  routes: RouteInfo[];
  shoes: ShoeInfo[];
  /** ritmos base del corredor por tipo de sesión (s/km) */
  basePaces?: Partial<Record<SessionType, PaceRange>>;
}

export interface Reason {
  id: string;
  text: string;
}

export interface Recommendation {
  fecha: string;
  sesion: SessionType;
  /** sesión original del plan */
  planificada: SessionType;
  distancia_km: number;
  ruta_id: string | null;
  ritmo_objetivo: string | null;
  ritmo_rango: PaceRange | null;
  ajuste_ritmo: string;
  ventana: { desde: string; hasta: string } | null;
  recuperacion: number;
  nivel_calor: 0 | 1 | 2;
  razones: Reason[];
  alertas: Reason[];
  confianza: 'alta' | 'media' | 'baja';
  /** frase corta lista para la tarjeta "Veredicto" */
  veredicto: string;
}
