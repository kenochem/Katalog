import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { logAudit } from './auditLog';
import { fetchBlManufacturers, addBlManufacturers } from './baselinkerApi';
import { setExtraManufacturers, WAPRO_MANUFACTURERS } from './waproManufacturers';

/**
 * Rejestr producentów katalogu: lista z WAPRO + producenci dodani ręcznie + pobrani z BaseLinkera.
 * Zapisany w tabeli `catalog_manufacturers` (migration-catalog-manufacturers.sql) — wspólny dla wszystkich.
 */
export interface RegistryManufacturer {
  name: string;
  source: 'manual' | 'baselinker';
  blId: number | null;
}

let rows: RegistryManufacturer[] = [];
let version = 0;
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  version++;
  setExtraManufacturers(rows.map((r) => r.name));
  listeners.forEach((fn) => fn());
}

export function getRegistry(): RegistryManufacturer[] {
  return rows;
}

export function subscribeRegistry(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Hook odświeżający komponent po zmianie rejestru (zwraca numer wersji). */
export function useManufacturerRegistry(): number {
  return useSyncExternalStore(subscribeRegistry, () => version, () => 0);
}

export function loadManufacturerRegistry(force = false): Promise<void> {
  const client = supabase;
  if (!client) return Promise.resolve();
  if (loaded && !force) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await client
        .from('catalog_manufacturers')
        .select('name,source,bl_manufacturer_id')
        .order('name');
      if (error) throw error;
      rows = (data ?? []).map((r) => ({
        name: String(r.name),
        source: r.source === 'baselinker' ? 'baselinker' : 'manual',
        blId: r.bl_manufacturer_id != null ? Number(r.bl_manufacturer_id) : null,
      }));
      loaded = true;
      emit();
    } catch (err) {
      console.warn('catalog_manufacturers', err);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

const keyOf = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

export function cleanManufacturerName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Dodaje producentów do wspólnego rejestru (pomija istniejące). Zwraca liczbę dodanych. */
export async function registerManufacturers(
  names: { name: string; blId?: number | null }[],
  source: 'manual' | 'baselinker',
): Promise<number> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const known = new Map(rows.map((r) => [keyOf(r.name), r]));
  const wapro = new Set(WAPRO_MANUFACTURERS.map((n) => keyOf(n)));
  const toInsert: { name_key: string; name: string; source: string; bl_manufacturer_id: number | null }[] = [];
  const toUpdate: { key: string; blId: number }[] = [];
  for (const n of names) {
    const name = cleanManufacturerName(n.name);
    if (!name) continue;
    const key = keyOf(name);
    const existing = known.get(key);
    if (existing) {
      if (n.blId != null && existing.blId !== n.blId) toUpdate.push({ key, blId: n.blId });
      continue;
    }
    // producent z listy WAPRO: do rejestru trafia tylko po to, by zapamiętać jego id z BaseLinkera
    if (wapro.has(key) && !(source === 'baselinker' && n.blId != null)) continue;
    toInsert.push({ name_key: key, name, source, bl_manufacturer_id: n.blId ?? null });
    known.set(key, { name, source, blId: n.blId ?? null });
  }
  if (toInsert.length) {
    const { error } = await client.from('catalog_manufacturers').upsert(toInsert, { onConflict: 'name_key' });
    if (error) {
      throw new Error(
        /does not exist|catalog_manufacturers/i.test(error.message)
          ? 'Brak tabeli producentów w bazie — uruchom migrację migration-catalog-manufacturers.sql'
          : error.message,
      );
    }
  }
  for (const u of toUpdate) {
    await client.from('catalog_manufacturers').update({ bl_manufacturer_id: u.blId }).eq('name_key', u.key);
  }
  if (toInsert.length || toUpdate.length) {
    await loadManufacturerRegistry(true);
    logAudit({
      action: 'manufacturer.add',
      entityType: 'manufacturer',
      entityId: toInsert
        .map((r) => r.name)
        .slice(0, 5)
        .join(', '),
      summary: `Producenci: dodano ${toInsert.length} (${source === 'baselinker' ? 'z BaseLinkera' : 'ręcznie'})`,
    });
  }
  return toInsert.length;
}

/** Pobiera producentów z BaseLinkera do wspólnego rejestru. */
export async function importManufacturersFromBaselinker(): Promise<{ total: number; added: number }> {
  const list = await fetchBlManufacturers();
  const added = await registerManufacturers(
    list.map((m) => ({ name: m.name, blId: m.id })),
    'baselinker',
  );
  return { total: list.length, added };
}

/** Wysyła wskazanych producentów do BaseLinkera (tworzy tych, których tam jeszcze nie ma). */
export async function sendManufacturersToBaselinker(names: string[]): Promise<{ created: number; existing: number }> {
  const res = await addBlManufacturers(names);
  await registerManufacturers(
    res.items.map((m) => ({ name: m.name, blId: m.id })),
    'baselinker',
  );
  return { created: res.created, existing: res.existing };
}
