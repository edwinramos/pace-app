/** Acciones con varios pasos de base de datos (fin de carrera, crear plan). */
import type { SQLiteDatabase } from 'expo-sqlite';
import * as repo from '../db/repo';
import { localDate } from '../engine/format';
import { applyDailyAdaptation, generatePlan, matchRunToSession, type PlanConfig } from '../engine/plans';
import type { Recommendation } from '../engine/types';
import { notifyNow } from '../services/notify';

export async function createPlanFromConfig(db: SQLiteDatabase, cfg: PlanConfig) {
  const gen = generatePlan(cfg);
  await repo.createPlan(db, cfg, gen);
  return gen;
}

export interface FinishResult {
  id: string;
  shoeAlert: string | null;
  notified: boolean;
  sessionMarked: boolean;
}

/**
 * Guarda la carrera y:
 *  - si hoy el motor cambió la sesión clave (R1/R8), guarda la versión adaptada y mueve la original;
 *  - marca como hecha la sesión del plan del día (o la perdida de la semana);
 *  - avisa (notificación local) si la zapatilla cruza 550 o 600 km.
 */
export async function finishRun(
  db: SQLiteDatabase,
  run: Omit<repo.NewRun, 'plan_session_id'>,
  points: Parameters<typeof repo.saveRun>[2],
  splits: Parameters<typeof repo.saveRun>[3],
  opts: { planId: string | null; rec: Recommendation | null },
): Promise<FinishResult> {
  const runDate = localDate(new Date(run.started_at));
  let planSessionId: string | null = null;
  if (opts.planId) {
    let sessions = await repo.getPlanSessions(db, opts.planId);
    if (opts.rec && opts.rec.fecha === runDate) {
      const before = sessions;
      sessions = applyDailyAdaptation(sessions, runDate, opts.rec).sessions;
      await repo.updateSessions(db, before, sessions);
    }
    const idx = matchRunToSession(sessions, runDate);
    if (idx >= 0) planSessionId = sessions[idx].id ?? null;
  }

  const shoeBefore = run.shoe_id ? await repo.getShoe(db, run.shoe_id) : null;
  const id = await repo.saveRun(db, { ...run, plan_session_id: planSessionId }, points, splits);

  let shoeAlert: string | null = null;
  let notified = false;
  if (shoeBefore) {
    const total = shoeBefore.totalKm + run.distance_m / 1000;
    const level = total >= shoeBefore.retireKm ? 2 : total >= shoeBefore.retireKm - 50 ? 1 : 0;
    if (level > shoeBefore.notifiedLevel) {
      shoeAlert =
        level === 2
          ? `${shoeBefore.name} superó ${shoeBefore.retireKm} km (${Math.round(total)} km). Toca recambio.`
          : `${shoeBefore.name} va por ${Math.round(total)} de ${shoeBefore.retireKm} km. El recambio se acerca.`;
      notified = await notifyNow(level === 2 ? 'Zapatillas al límite' : 'Zapatillas: aviso', shoeAlert);
      await repo.setShoeNotified(db, shoeBefore.id, level);
    }
  }
  return { id, shoeAlert, notified, sessionMarked: planSessionId != null };
}
