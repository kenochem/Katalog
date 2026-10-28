import { useSyncExternalStore } from 'react';

/**
 * Bezpiecznik hostów zdjęć: gdy zewnętrzny serwer (np. sklep) przestaje odpowiadać, przeglądarka trzyma setki
 * zawieszonych żądań (po ~20 s każde), a karty długo zostają puste. Po kilku błędach z rzędu uznajemy host za
 * niedostępny na kilka minut i pomijamy jego adresy (przełączamy na kolejne zdjęcie albo pokazujemy zastępnik).
 */
const WINDOW_MS = 60_000;
const THRESHOLD = 6;
const DOWN_MS = 5 * 60_000;

const failures = new Map<string, { url: string; t: number }[]>();
const downUntil = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

/** Własne hosty (nasz magazyn, aplikacja) są zawsze „zdrowe” — błąd to najpewniej brak pliku, nie awaria. */
function isOwnHost(host: string): boolean {
  return host.endsWith('.supabase.co') || host.endsWith('.web.app') || host.endsWith('.firebaseapp.com') || host === 'localhost';
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function emit() {
  version++;
  listeners.forEach((fn) => fn());
}

export function recordImageError(url: string, now = Date.now()): void {
  const host = hostOf(url);
  if (!host || isOwnHost(host)) return;
  const recent = (failures.get(host) ?? []).filter((x) => now - x.t < WINDOW_MS);
  recent.push({ url, t: now });
  failures.set(host, recent);
  // awaria = kilka RÓŻNYCH adresów z tego hosta zawiodło, bez żadnego udanego ładowania w tym czasie
  if (new Set(recent.map((x) => x.url)).size >= THRESHOLD && !(downUntil.get(host) && downUntil.get(host)! > now)) {
    downUntil.set(host, now + DOWN_MS);
    emit();
  }
}

export function recordImageOk(url: string): void {
  const host = hostOf(url);
  if (!host) return;
  if (failures.has(host)) failures.delete(host);
  if (downUntil.has(host)) {
    downUntil.delete(host);
    emit();
  }
}

export function isImageHostDown(url: string, now = Date.now()): boolean {
  const host = hostOf(url);
  const until = host ? downUntil.get(host) : undefined;
  return !!until && until > now;
}

export function resetImageHostHealth(): void {
  failures.clear();
  downUntil.clear();
  emit();
}

export function useImageHostHealthVersion(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
    () => 0,
  );
}
