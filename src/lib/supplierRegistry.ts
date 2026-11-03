import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { logAudit } from './auditLog';

/**
 * Rejestr dostawców katalogu (tabela `catalog_suppliers`, migration-catalog-suppliers.sql).
 * Produkt wskazuje dostawcę nazwą (meta.supplier — docelowo z WAPRO); tu trzymamy profil: kontakt, NIP, warunki.
 * Bez wgranej migracji rejestr jest pusty, a reszta katalogu działa jak dotąd.
 */
export interface SupplierProfile {
  waproCode: string;
  nip: string;
  website: string;
  email: string;
  phone: string;
  contactPerson: string;
  leadTimeDays: number | null;
  minOrderNet: number | null;
  notes: string;
}

export interface RegistrySupplier extends SupplierProfile {
  name: string;
  source: 'manual' | 'wapro' | 'produkty';
  removed: boolean;
}

export const EMPTY_SUPPLIER_PROFILE: SupplierProfile = {
  waproCode: '',
  nip: '',
  website: '',
  email: '',
  phone: '',
  contactPerson: '',
  leadTimeDays: null,
  minOrderNet: null,
  notes: '',
};

let rows: RegistrySupplier[] = [];
let version = 0;
let loaded = false;
let tableMissing = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((fn) => fn());
}

export const supplierKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');
export const cleanSupplierName = (raw: string) => raw.trim().replace(/\s+/g, ' ');

export function getSupplierRegistry(): RegistrySupplier[] {
  return rows;
}

/** Czy tabela dostawców nie istnieje w bazie (migracja niewgrana). */
export function supplierTableMissing(): boolean {
  return tableMissing;
}

export function getSupplierEntry(name: string): RegistrySupplier | undefined {
  const k = supplierKey(name);
  return rows.find((r) => supplierKey(r.name) === k);
}

/** Hook odświeżający komponent po zmianie rejestru (zwraca numer wersji). */
export function useSupplierRegistry(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
    () => 0,
  );
}

function asError(message: string): Error {
  return new Error(
    /does not exist|catalog_suppliers|schema cache/i.test(message) ? 'Brak tabeli dostawców w bazie — uruchom migrację migration-catalog-suppliers.sql' : message,
  );
}

export function loadSupplierRegistry(force = false): Promise<void> {
  const client = supabase;
  if (!client) return Promise.resolve();
  if (loaded && !force) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await client.from('catalog_suppliers').select('*').order('name');
      if (error) throw error;
      rows = (data ?? []).map((r) => ({
        name: String(r.name),
        source: r.source === 'wapro' ? 'wapro' : r.source === 'produkty' ? 'produkty' : 'manual',
        removed: r.removed === true,
        waproCode: String(r.wapro_code ?? ''),
        nip: String(r.nip ?? ''),
        website: String(r.website ?? ''),
        email: String(r.email ?? ''),
        phone: String(r.phone ?? ''),
        contactPerson: String(r.contact_person ?? ''),
        leadTimeDays: r.lead_time_days != null ? Number(r.lead_time_days) : null,
        minOrderNet: r.min_order_net != null ? Number(r.min_order_net) : null,
        notes: String(r.notes ?? ''),
      }));
      loaded = true;
      tableMissing = false;
      emit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
      tableMissing = /does not exist|catalog_suppliers|schema cache/i.test(msg);
      console.warn('catalog_suppliers', err);
      emit();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Dodaje dostawców do rejestru (pomija istniejące, przywraca usuniętych). Zwraca liczbę nowych wpisów. */
export async function registerSuppliers(names: string[], source: RegistrySupplier['source']): Promise<number> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const known = new Map(rows.map((r) => [supplierKey(r.name), r]));
  const toInsert: { name_key: string; name: string; source: string }[] = [];
  const restore: string[] = [];
  for (const raw of names) {
    const name = cleanSupplierName(raw);
    if (!name) continue;
    const key = supplierKey(name);
    const existing = known.get(key);
    if (existing) {
      if (existing.removed && source === 'manual') restore.push(key);
      continue;
    }
    toInsert.push({ name_key: key, name, source });
    known.set(key, { ...EMPTY_SUPPLIER_PROFILE, name, source, removed: false });
  }
  if (toInsert.length) {
    const { error } = await client.from('catalog_suppliers').upsert(toInsert, { onConflict: 'name_key' });
    if (error) throw asError(error.message);
  }
  for (const key of restore) await client.from('catalog_suppliers').update({ removed: false }).eq('name_key', key);
  if (toInsert.length || restore.length) {
    await loadSupplierRegistry(true);
    if (toInsert.length) {
      logAudit({
        action: 'supplier.add',
        entityType: 'supplier',
        entityId: toInsert.map((r) => r.name).slice(0, 5).join(', '),
        summary: `Dostawcy: dodano ${toInsert.length}`,
      });
    }
  }
  return toInsert.length;
}

/** Zapisuje profil dostawcy (tworzy wpis, jeśli go jeszcze nie ma). */
export async function saveSupplierProfile(name: string, patch: Partial<SupplierProfile>): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const clean = cleanSupplierName(name);
  const existing = getSupplierEntry(clean);
  const payload: Record<string, unknown> = {
    name_key: supplierKey(clean),
    name: existing?.name ?? clean,
    source: existing?.source ?? 'manual',
    updated_at: new Date().toISOString(),
  };
  const text = (v: string | undefined) => (v ?? '').trim() || null;
  if (patch.waproCode !== undefined) payload.wapro_code = text(patch.waproCode);
  if (patch.nip !== undefined) payload.nip = text(patch.nip);
  if (patch.website !== undefined) payload.website = text(patch.website);
  if (patch.email !== undefined) payload.email = text(patch.email);
  if (patch.phone !== undefined) payload.phone = text(patch.phone);
  if (patch.contactPerson !== undefined) payload.contact_person = text(patch.contactPerson);
  if (patch.leadTimeDays !== undefined) payload.lead_time_days = patch.leadTimeDays;
  if (patch.minOrderNet !== undefined) payload.min_order_net = patch.minOrderNet;
  if (patch.notes !== undefined) payload.notes = text(patch.notes);
  const { error } = await client.from('catalog_suppliers').upsert(payload, { onConflict: 'name_key' });
  if (error) throw asError(error.message);
  await loadSupplierRegistry(true);
  logAudit({ action: 'supplier.update', entityType: 'supplier', entityId: clean, summary: `Profil dostawcy: ${Object.keys(patch).join(', ')}` });
}

/** Ukrywa dostawcę na liście (produkty zachowują wpis w polu dostawcy). */
export async function removeSupplier(name: string): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const { error } = await client
    .from('catalog_suppliers')
    .upsert({ name_key: supplierKey(name), name: cleanSupplierName(name), source: getSupplierEntry(name)?.source ?? 'manual', removed: true, updated_at: new Date().toISOString() }, { onConflict: 'name_key' });
  if (error) throw asError(error.message);
  await loadSupplierRegistry(true);
  logAudit({ action: 'supplier.remove', entityType: 'supplier', entityId: name, summary: 'Dostawca ukryty na liście' });
}
