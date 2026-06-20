import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const LIMA_TZ = 'America/Lima';

/** Fecha/hora actual en Lima como ISO 8601 con offset -05:00 */
export function nowLima(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: LIMA_TZ }).replace(' ', 'T') + '-05:00';
}

/** Formatea un timestamp ISO/DB a string legible en hora Lima */
export function fmtLima(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const defaults: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' };
  return d.toLocaleString('es-PE', { timeZone: LIMA_TZ, ...defaults, ...opts });
}

/** Retorna 'YYYY-MM-DD' de hoy en Lima */
export function todayLima(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: LIMA_TZ });
}
