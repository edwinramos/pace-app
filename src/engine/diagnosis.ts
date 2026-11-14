/** Diagnóstico post-carrera por reglas (texto del Resumen). */
import { formatKm, formatPace } from './format';
import { splitPace, type Split } from './run';
import type { PaceRange, ShoeInfo } from './types';

export function diagnose(opts: {
  splits: Split[];
  target: PaceRange | null;
  humidity?: number;
  apparent?: number;
  shoe?: ShoeInfo | null;
}): string {
  const { splits, target, humidity, apparent, shoe } = opts;
  const parts: string[] = [];
  const full = splits.filter((s) => !s.partialKm);
  if (full.length === 0) {
    parts.push('Carrera corta: todavía no hay parciales completos para analizar.');
  } else {
    const paces = full.map(splitPace);
    const avg = paces.reduce((a, b) => a + b, 0) / paces.length;
    const slow = full.filter((s) => splitPace(s) > avg + 5).map((s) => s.km);
    const hot = (apparent ?? 0) >= 28 || (humidity ?? 0) >= 80;
    if (target && avg <= target.to && avg >= target.from - 15) {
      parts.push(`Ritmo medio ${formatPace(avg)} /km, dentro del objetivo${hot ? ' a pesar del calor' : ''}.`);
    } else if (target && avg < target.from - 15) {
      parts.push(`Fuiste más rápido que el objetivo (${formatPace(avg)} frente a ${formatPace(target.from)}): en días suaves conviene contenerse.`);
    } else {
      parts.push(`Ritmo medio ${formatPace(avg)} /km.`);
    }
    if (slow.length > 0) {
      const hum = humidity != null ? ` (humedad ${Math.round(humidity)} %)` : '';
      const list = slow.length === 1 ? `El km ${slow[0]} se te fue` : `Los km ${slow.slice(0, -1).join(', ')} y ${slow[slow.length - 1]} se te fueron`;
      parts.push(`${list} un poco${hot ? hum : ''}.`);
    } else if (full.length >= 3) {
      parts.push('Parciales muy parejos: buen control.');
    }
  }
  if (shoe) {
    if (shoe.totalKm >= shoe.retireKm) parts.push(`Las ${shoe.name} ya superan ${shoe.retireKm} km: toca recambio.`);
    else if (shoe.totalKm >= shoe.retireKm - 50)
      parts.push(`Las ${shoe.name} van por ${formatKm(shoe.totalKm, 0)} km: el recambio se acerca.`);
  }
  return parts.join(' ');
}
