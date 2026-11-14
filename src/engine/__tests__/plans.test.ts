import { diagnose } from '../diagnosis';
import { derivePaces, estimateMaxHr, riegel } from '../paces';
import {
  addDays,
  applyDailyAdaptation,
  generatePlan,
  matchRunToSession,
  pickLongDay,
  reconcile,
  weekLayout,
  weekOf,
  type PlanSession,
} from '../plans';

const base = { goal: '10k' as const, level: 'intermedio' as const, startDate: '2026-11-16', goalDate: '2027-01-24', days: [1, 3, 5, 6] };

describe('generatePlan', () => {
  const plan = generatePlan(base);

  it('calcula las semanas desde el lunes de inicio hasta la semana de la carrera', () => {
    expect(plan.weeks).toBe(10);
    expect(plan.firstMonday).toBe('2026-11-16');
    expect(plan.warnings).toEqual([]);
  });

  it('una sesión por día desde el inicio hasta la carrera, sin días fuera', () => {
    expect(plan.sessions[0].date).toBe('2026-11-16');
    expect(plan.sessions[plan.sessions.length - 1].date).toBe('2027-01-24');
    expect(new Set(plan.sessions.map((s) => s.date)).size).toBe(plan.sessions.length);
  });

  it('solo corre en los días disponibles, con la larga en domingo', () => {
    const run = plan.sessions.filter((s) => s.type !== 'descanso' && s.type !== 'carrera');
    expect(run.every((s) => base.days.includes(s.dayIndex))).toBe(true);
    const w2 = weekOf(plan.sessions, '2026-11-23');
    expect(w2.find((s) => s.dayIndex === 6)?.type).toBe('larga');
    expect(w2.filter((s) => s.type === 'series' || s.type === 'tempo')).toHaveLength(1);
  });

  it('el día de la meta es la carrera con la distancia objetivo', () => {
    const race = plan.sessions.find((s) => s.type === 'carrera')!;
    expect(race.date).toBe('2027-01-24');
    expect(race.km).toBe(10);
  });

  it('progresa, descarga en la semana 4 y afina al final', () => {
    const vol = (w: number) => plan.sessions.filter((s) => s.week === w).reduce((a, s) => a + s.km, 0);
    expect(vol(3)).toBeGreaterThan(vol(1));
    expect(vol(4)).toBeLessThan(vol(3));
    expect(vol(8)).toBeGreaterThan(vol(1));
    const raceWeekNoRace = plan.sessions.filter((s) => s.week === 10 && s.type !== 'carrera').reduce((a, s) => a + s.km, 0);
    expect(raceWeekNoRace).toBeLessThanOrEqual(8);
  });

  it('respeta el tope de la tirada larga', () => {
    const longs = plan.sessions.filter((s) => s.type === 'larga').map((s) => s.km);
    expect(Math.max(...longs)).toBeLessThanOrEqual(12);
    expect(Math.min(...longs)).toBeGreaterThanOrEqual(3);
  });

  it('avisa si hay poco tiempo y recorta si hay demasiado', () => {
    const short = generatePlan({ ...base, goal: '21k', goalDate: '2026-12-20' });
    expect(short.warnings[0]).toMatch(/comprimido/);
    const long = generatePlan({ ...base, goalDate: '2027-11-21' });
    expect(long.weeks).toBe(24);
    expect(long.warnings[0]).toMatch(/más de 24 semanas/);
  });

  it('rechaza menos de 2 días o fecha demasiado cercana', () => {
    expect(() => generatePlan({ ...base, days: [2] })).toThrow(/2 días/);
    expect(() => generatePlan({ ...base, goalDate: '2026-11-18' })).toThrow(/una semana/);
  });

  it('principiante: sin calidad las 2 primeras semanas', () => {
    const p = generatePlan({ ...base, level: 'principiante', goal: '5k', goalDate: '2027-01-10' });
    const firstTwo = p.sessions.filter((s) => s.week <= 2);
    expect(firstTwo.some((s) => s.type === 'series' || s.type === 'tempo')).toBe(false);
    expect(p.sessions.filter((s) => s.week === 3).some((s) => s.type === 'tempo')).toBe(true);
  });

  it('2 días: larga + suave; 5 días avanzado: dos calidades', () => {
    expect([...weekLayout([2, 6], 6, 'intermedio', 1).values()].sort()).toEqual(['larga', 'suave']);
    const five = [...weekLayout([0, 1, 3, 4, 6], 6, 'avanzado', 1).values()];
    expect(five.filter((t) => t === 'series' || t === 'tempo')).toHaveLength(2);
  });

  it('pickLongDay prefiere domingo, luego sábado', () => {
    expect(pickLongDay([1, 3, 5])).toBe(5);
    expect(pickLongDay([1, 3])).toBe(3);
    expect(pickLongDay([1, 3, 6], 3)).toBe(3);
  });
});

describe('adaptación', () => {
  const week: PlanSession[] = [
    { date: '2026-11-16', week: 1, dayIndex: 0, type: 'descanso', km: 0, status: 'planned' },
    { date: '2026-11-17', week: 1, dayIndex: 1, type: 'series', km: 5, status: 'planned' },
    { date: '2026-11-18', week: 1, dayIndex: 2, type: 'descanso', km: 0, status: 'planned' },
    { date: '2026-11-19', week: 1, dayIndex: 3, type: 'suave', km: 5, status: 'planned' },
    { date: '2026-11-20', week: 1, dayIndex: 4, type: 'descanso', km: 0, status: 'planned' },
    { date: '2026-11-21', week: 1, dayIndex: 5, type: 'suave', km: 4, status: 'planned' },
    { date: '2026-11-22', week: 1, dayIndex: 6, type: 'larga', km: 9, status: 'planned' },
    { date: '2026-11-24', week: 2, dayIndex: 1, type: 'suave', km: 5, status: 'planned' },
    { date: '2026-11-26', week: 2, dayIndex: 3, type: 'tempo', km: 5, status: 'planned' },
  ];

  it('R10: la sesión clave perdida pasa al siguiente suave que no sea víspera de larga', () => {
    const { sessions, changes } = reconcile(week, '2026-11-18');
    expect(sessions[1].status).toBe('missed');
    expect(sessions[3]).toMatchObject({ type: 'series', km: 5, status: 'planned' });
    expect(sessions[5].type).toBe('suave'); // víspera de la larga: no se toca
    expect(changes.map((c) => c.rule)).toContain('R10');
    // idempotente
    const again = reconcile(sessions, '2026-11-18');
    expect(again.changes).toHaveLength(0);
  });

  it('los descansos pasados no cuentan como perdidos', () => {
    const { sessions } = reconcile(week, '2026-11-17');
    expect(sessions[0].status).toBe('planned');
  });

  it('R11: dos perdidas en 7 días bajan los próximos 7 días un 10 %', () => {
    const { sessions, changes } = reconcile(week, '2026-11-23');
    expect(changes.map((c) => c.rule)).toContain('R11');
    expect(sessions[7].km).toBe(4.5);
    expect(sessions[8].note).toMatch(/R11/);
    const again = reconcile(sessions, '2026-11-23');
    expect(again.sessions[7].km).toBe(4.5);
  });

  it('R8: si el motor baja la series de hoy, se guarda suave y la series se mueve', () => {
    const { sessions, changes } = applyDailyAdaptation(week, '2026-11-17', { sesion: 'suave', distancia_km: 3.5 });
    expect(sessions[1]).toMatchObject({ type: 'suave', km: 3.5 });
    expect(sessions[3].type).toBe('series');
    expect(changes[0].rule).toBe('R8');
    expect(applyDailyAdaptation(sessions, '2026-11-17', { sesion: 'suave', distancia_km: 3.5 }).changes).toHaveLength(0);
  });

  it('asocia la carrera a la sesión del día o a la perdida de la semana', () => {
    expect(matchRunToSession(week, '2026-11-19')).toBe(3);
    const r = reconcile(week, '2026-11-18').sessions;
    expect(matchRunToSession(r, '2026-11-18')).toBe(1);
  });

  it('addDays cruza meses', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });
});

describe('ritmos', () => {
  it('derivePaces desde un 5K de 25:00', () => {
    const p = derivePaces('intermedio', 1500, '10k');
    expect(p.suave.from).toBe(366); // 300 × 1,22
    expect(p.series.from).toBe(291);
    expect(p.carrera.from).toBeGreaterThan(300); // el 10K va más lento que el 5K
  });
  it('Riegel y FC máx', () => {
    expect(Math.round(riegel(1500, 5, 10))).toBe(3127);
    expect(estimateMaxHr(40)).toBe(180);
  });
});

describe('diagnose', () => {
  it('detecta km lentos y avisa de la zapatilla', () => {
    const txt = diagnose({
      splits: [
        { km: 1, durationS: 338, gainM: 2 },
        { km: 2, durationS: 342, gainM: 4 },
        { km: 3, durationS: 355, gainM: 6 },
        { km: 4, durationS: 356, gainM: 3 },
      ],
      target: { from: 360, to: 375 },
      humidity: 79,
      apparent: 31,
      shoe: { id: 'p', name: 'Pegasus 41', totalKm: 617, retireKm: 600 },
    });
    expect(txt).toMatch(/km 3 y 4/);
    expect(txt).toMatch(/humedad 79/);
    expect(txt).toMatch(/Pegasus 41 ya superan 600/);
  });
});
