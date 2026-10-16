import { useSyncExternalStore } from 'react';
import { STORAGE_BUCKET, supabase } from './supabase';
import { logAudit } from './auditLog';
import { fetchBlManufacturers, addBlManufacturers } from './baselinkerApi';
import { compressImageFile } from './imageCompress';
import { invalidateProductsCache } from './products';
import {
  WAPRO_MANUFACTURERS,
  isStaticManufacturer,
  setExtraManufacturers,
  setRemovedManufacturers,
} from './waproManufacturers';

/**
 * Rejestr producentów katalogu: lista z WAPRO + producenci dodani ręcznie + pobrani z BaseLinkera
 * oraz profil każdego producenta (logo, opis, kontakt). Tabela `catalog_manufacturers`
 * (migration-catalog-manufacturers.sql) — wspólna dla wszystkich użytkowników.
 */
export interface ManufacturerProfile {
  logoUrl: string;
  description: string;
  website: string;
  email: string;
  phone: string;
  notes: string;
}

export interface RegistryManufacturer extends ManufacturerProfile {
  name: string;
  source: 'manual' | 'baselinker' | 'wapro';
  blId: number | null;
  removed: boolean;
}

export const EMPTY_PROFILE: ManufacturerProfile = {
  logoUrl: '',
  description: '',
  website: '',
  email: '',
  phone: '',
  notes: '',
};

let rows: RegistryManufacturer[] = [];
let version = 0;
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  version++;
  setExtraManufacturers(rows.filter((r) => !r.removed).map((r) => r.name));
  setRemovedManufacturers(rows.filter((r) => r.removed).map((r) => r.name));
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

export const manufacturerKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

export function getManufacturerEntry(name: string): RegistryManufacturer | undefined {
  const k = manufacturerKey(name);
  return rows.find((r) => manufacturerKey(r.name) === k);
}

function missingTable(message: string): Error {
  return new Error(
    /does not exist|catalog_manufacturers|schema cache/i.test(message)
      ? 'Brak tabeli producentów w bazie — uruchom migrację migration-catalog-manufacturers.sql'
      : message,
  );
}

export function loadManufacturerRegistry(force = false): Promise<void> {
  const client = supabase;
  if (!client) return Promise.resolve();
  if (loaded && !force) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await client.from('catalog_manufacturers').select('*').order('name');
      if (error) throw error;
      rows = (data ?? []).map((r) => ({
        name: String(r.name),
        source: r.source === 'baselinker' ? 'baselinker' : r.source === 'wapro' ? 'wapro' : 'manual',
        blId: r.bl_manufacturer_id != null ? Number(r.bl_manufacturer_id) : null,
        removed: r.removed === true,
        logoUrl: String(r.logo_url ?? ''),
        description: String(r.description ?? ''),
        website: String(r.website ?? ''),
        email: String(r.email ?? ''),
        phone: String(r.phone ?? ''),
        notes: String(r.notes ?? ''),
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
  const known = new Map(rows.map((r) => [manufacturerKey(r.name), r]));
  const wapro = new Set(WAPRO_MANUFACTURERS.map((n) => manufacturerKey(n)));
  const toInsert: { name_key: string; name: string; source: string; bl_manufacturer_id: number | null; removed?: boolean }[] = [];
  const toUpdate: { key: string; blId?: number; restore?: boolean }[] = [];
  for (const n of names) {
    const name = cleanManufacturerName(n.name);
    if (!name) continue;
    const key = manufacturerKey(name);
    const existing = known.get(key);
    if (existing) {
      if (existing.removed && source === 'manual') toUpdate.push({ key, restore: true });
      else if (n.blId != null && existing.blId !== n.blId) toUpdate.push({ key, blId: n.blId });
      continue;
    }
    // producent z listy WAPRO: do rejestru trafia tylko po to, by zapamiętać jego id z BaseLinkera
    if (wapro.has(key) && !(source === 'baselinker' && n.blId != null)) continue;
    toInsert.push({ name_key: key, name, source: wapro.has(key) ? 'wapro' : source, bl_manufacturer_id: n.blId ?? null });
    known.set(key, {
      ...EMPTY_PROFILE,
      name,
      source,
      blId: n.blId ?? null,
      removed: false,
    });
  }
  if (toInsert.length) {
    const { error } = await client.from('catalog_manufacturers').upsert(toInsert, { onConflict: 'name_key' });
    if (error) throw missingTable(error.message);
  }
  for (const u of toUpdate) {
    const patch: Record<string, unknown> = {};
    if (u.blId != null) patch.bl_manufacturer_id = u.blId;
    if (u.restore) patch.removed = false;
    await client.from('catalog_manufacturers').update(patch).eq('name_key', u.key);
  }
  if (toInsert.length || toUpdate.length) {
    await loadManufacturerRegistry(true);
    if (toInsert.length) {
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
  }
  return toInsert.length;
}

/** Zapisuje profil producenta (tworzy wpis w rejestrze, jeśli go jeszcze nie ma — np. dla marki z WAPRO). */
export async function saveManufacturerProfile(name: string, patch: Partial<ManufacturerProfile>): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const clean = cleanManufacturerName(name);
  const key = manufacturerKey(clean);
  const existing = getManufacturerEntry(clean);
  const payload: Record<string, unknown> = { name_key: key, updated_at: new Date().toISOString() };
  if (!existing) {
    payload.name = clean;
    payload.source = isStaticManufacturer(clean) ? 'wapro' : 'manual';
  }
  if (patch.logoUrl !== undefined) payload.logo_url = patch.logoUrl || null;
  if (patch.description !== undefined) payload.description = patch.description || null;
  if (patch.website !== undefined) payload.website = patch.website || null;
  if (patch.email !== undefined) payload.email = patch.email || null;
  if (patch.phone !== undefined) payload.phone = patch.phone || null;
  if (patch.notes !== undefined) payload.notes = patch.notes || null;
  const { error } = await client.from('catalog_manufacturers').upsert(payload, { onConflict: 'name_key' });
  if (error) throw missingTable(error.message);
  await loadManufacturerRegistry(true);
  logAudit({
    action: 'manufacturer.update',
    entityType: 'manufacturer',
    entityId: clean,
    summary: `Profil producenta: ${Object.keys(patch).join(', ')}`,
  });
}

/** Wgrywa logo producenta do magazynu zdjęć i zapisuje jego adres w profilu. */
export async function uploadManufacturerLogo(name: string, file: File): Promise<string> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const compressed = await compressImageFile(file);
  const wasCompressed = compressed !== (file as Blob);
  const type = wasCompressed ? compressed.type || 'image/jpeg' : file.type || 'image/png';
  const ext = type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : type === 'image/svg+xml' ? 'svg' : 'jpg';
  const slug = manufacturerKey(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'producent';
  const path = `manufacturers/${slug}-${Date.now()}.${ext}`;
  const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, compressed, { upsert: true, contentType: type });
  if (error) throw error;
  const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  await saveManufacturerProfile(name, { logoUrl: data.publicUrl });
  return data.publicUrl;
}

/**
 * Zmienia nazwę producenta we wszystkich jego produktach i w rejestrze (profil przechodzi na nową nazwę).
 * Marka z listy WAPRO zostaje ukryta na liście wyboru, żeby nie wracała pod starą nazwą.
 */
export async function renameManufacturer(oldName: string, newNameRaw: string): Promise<{ updated: number }> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const newName = cleanManufacturerName(newNameRaw);
  const oldKey = manufacturerKey(oldName);
  const newKey = manufacturerKey(newName);
  if (!newName) throw new Error('Podaj nową nazwę');
  if (newName === oldName) return { updated: 0 };
  if (newKey !== oldKey && (getManufacturerEntry(newName) && !getManufacturerEntry(newName)?.removed || isStaticManufacturer(newName))) {
    throw new Error(`Producent „${newName}” już istnieje — wybierz inną nazwę`);
  }
  const old = getManufacturerEntry(oldName);

  // produkty ze starą nazwą (wielkość liter bez znaczenia)
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from('products')
      .select('id,manufacturer')
      .ilike('manufacturer', oldName.replace(/[\\%_]/g, (c) => `\\${c}`))
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) ids.push(String(r.id));
    if (!data || data.length < 1000) break;
  }
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await client.from('products').update({ manufacturer: newName }).in('id', ids.slice(i, i + 200));
    if (error) throw error;
  }

  // rejestr: nowy wpis z profilem starego, stary wycofany / usunięty
  const profile = old ?? { ...EMPTY_PROFILE, source: 'manual' as const, blId: null };
  const { error: insErr } = await client.from('catalog_manufacturers').upsert(
    {
      name_key: newKey,
      name: newName,
      source: profile.source === 'wapro' ? 'manual' : profile.source,
      bl_manufacturer_id: newKey === oldKey ? (old?.blId ?? null) : null,
      removed: false,
      logo_url: profile.logoUrl || null,
      description: profile.description || null,
      website: profile.website || null,
      email: profile.email || null,
      phone: profile.phone || null,
      notes: profile.notes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'name_key' },
  );
  if (insErr) throw missingTable(insErr.message);
  if (newKey !== oldKey) {
    if (isStaticManufacturer(oldName)) {
      await client
        .from('catalog_manufacturers')
        .upsert({ name_key: oldKey, name: oldName, source: 'wapro', removed: true }, { onConflict: 'name_key' });
    } else {
      await client.from('catalog_manufacturers').delete().eq('name_key', oldKey);
    }
  }
  invalidateProductsCache();
  await loadManufacturerRegistry(true);
  logAudit({
    action: 'manufacturer.rename',
    entityType: 'manufacturer',
    entityId: newName,
    summary: `Producent „${oldName}” → „${newName}” (${ids.length} produktów)`,
  });
  return { updated: ids.length };
}

/** Usuwa producenta z listy wyboru (tylko gdy nie ma przypisanych produktów — sprawdza wywołujący). */
export async function removeManufacturer(name: string): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const key = manufacturerKey(name);
  if (isStaticManufacturer(name)) {
    const { error } = await client
      .from('catalog_manufacturers')
      .upsert({ name_key: key, name, source: 'wapro', removed: true }, { onConflict: 'name_key' });
    if (error) throw missingTable(error.message);
  } else {
    const { error } = await client.from('catalog_manufacturers').delete().eq('name_key', key);
    if (error) throw missingTable(error.message);
  }
  await loadManufacturerRegistry(true);
  logAudit({ action: 'manufacturer.remove', entityType: 'manufacturer', entityId: name, summary: `Usunięto producenta „${name}” z listy` });
}

/** Pobiera producentów z BaseLinkera do wspólnego rejestru. */
export async function importManufacturersFromBaselinker(): Promise<{ total: number; added: number; names: Set<string> }> {
  const list = await fetchBlManufacturers();
  const added = await registerManufacturers(
    list.map((m) => ({ name: m.name, blId: m.id })),
    'baselinker',
  );
  return { total: list.length, added, names: new Set(list.map((m) => manufacturerKey(m.name))) };
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
