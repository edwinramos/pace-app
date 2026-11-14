/** Formato numérico en español (coma decimal). */
export function formatKm(km: number, decimals = 2): string {
  return km.toFixed(decimals).replace('.', ',');
}

export function formatNumber(n: number, decimals = 1): string {
  return n.toFixed(decimals).replace('.', ',');
}

/** 346 -> "5:46" */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return '--:--';
  const s = Math.round(secPerKm);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** 1122 -> "00:18:42" (o "18:42" si short) */
export function formatDuration(totalSec: number, short = false): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  if (short && h === 0) return `${mm}:${ss}`;
  return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
}

export function formatSleep(hours: number | undefined): string {
  if (hours == null) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}`;
}

/** "2026-11-14T06:00" -> "06:00" */
export function hourLabel(isoLocal: string): string {
  return isoLocal.slice(11, 16);
}

export function hourOf(isoLocal: string): number {
  return parseInt(isoLocal.slice(11, 13), 10);
}

/** Fecha local YYYY-MM-DD de un Date. */
export function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function longDate(d: Date): string {
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/* ---------- unidades ---------- */
export type Units = 'km' | 'mi';
export const MI = 1.609344;

export function distValue(m: number, u: Units): number {
  return u === 'km' ? m / 1000 : m / 1000 / MI;
}
export function formatDist(m: number, u: Units, decimals = 2): string {
  return formatKm(distValue(m, u), decimals);
}
/** s/km → s por unidad */
export function paceValue(secPerKm: number | null | undefined, u: Units): number | null {
  if (secPerKm == null) return null;
  return u === 'km' ? secPerKm : secPerKm * MI;
}
export function formatPaceU(secPerKm: number | null | undefined, u: Units): string {
  return formatPace(paceValue(secPerKm, u));
}
export function unitLabel(u: Units): string {
  return u === 'km' ? 'km' : 'mi';
}
export function paceLabel(u: Units): string {
  return u === 'km' ? '/km' : '/mi';
}

/** "dd/mm/aaaa" → "aaaa-mm-dd" o null */
export function parseDmy(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return localDate(dt);
}
export function toDmy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return longDate(new Date(y, m - 1, d));
}
