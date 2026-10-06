import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

/**
 * Proxy do API BaseLinker (token tylko po stronie serwera) + silnik synchronizacji katalog → BaseLinker.
 *
 * Sekrety (npx supabase secrets set ...):
 *   BASELINKER_TOKEN, BASELINKER_INVENTORY_ID,
 *   BASELINKER_WAREHOUSE_ID (np. bl_12345), BASELINKER_PRICE_GROUP_ID (opcjonalnie; mozna tez w ustawieniach)
 *
 * Akcje (POST JSON { action, ... }):
 *   product       {sku}                       — dane produktu z BL (kazdy zalogowany)
 *   config                                    — konfiguracja, ustawienia, listy magazynow/grup cen (admin)
 *   settings-set  {settings}                  — zapis ustawien synchronizacji (admin)
 *   compare                                   — porownanie stanow i cen katalog vs BL (admin)
 *   push          {skus, fields?}             — wyslanie stanow i/lub cen (admin lub agent WAPRO / service_role,
 *                                               agent tylko dla pol z wlaczonym automatem)
 *   history                                   — ostatnie wysylki (admin)
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const BL_URL = 'https://api.baselinker.com/connector.php';
const TOKEN = Deno.env.get('BASELINKER_TOKEN') ?? '';
const INVENTORY_ID = Number(Deno.env.get('BASELINKER_INVENTORY_ID') ?? 0);
const ENV_WAREHOUSE = Deno.env.get('BASELINKER_WAREHOUSE_ID') ?? '';
const ENV_PRICE_GROUP = Deno.env.get('BASELINKER_PRICE_GROUP_ID') ?? '';

type Field = 'stock' | 'price';

interface SyncSettings {
  stockAuto: boolean;
  priceAuto: boolean;
  priceGroupId: string;
  skipManualStock: boolean;
  maxAutoChanges: number;
  excludePrefixes: string[];
  excludeSkus: string[];
  priceTolerance: number;
}

const DEFAULT_SETTINGS: SyncSettings = {
  stockAuto: false,
  priceAuto: false,
  priceGroupId: '',
  skipManualStock: true,
  maxAutoChanges: 400,
  excludePrefixes: [],
  excludeSkus: [],
  priceTolerance: 0.01,
};

async function bl(method: string, parameters: Record<string, unknown>) {
  if (!TOKEN) throw new Error('Brak sekretu BASELINKER_TOKEN w Supabase (npx supabase secrets set).');
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(BL_URL, {
      method: 'POST',
      headers: { 'X-BLToken': TOKEN },
      body: new URLSearchParams({ method, parameters: JSON.stringify(parameters) }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.status === 'SUCCESS') return data;
    const msg = String(data.error_message ?? `HTTP ${res.status}`);
    if (/limit|too many|exceeded/i.test(msg) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }
    throw new Error(`BaseLinker ${method}: ${msg}`);
  }
  throw new Error(`BaseLinker ${method}: nieudane`);
}

function normSku(raw: string): string {
  const compact = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = compact.match(/^([A-Z]+)0*([0-9]+)$/);
  return m ? `${m[1]}${Number(m[2])}` : compact;
}

async function resolveWarehouse(): Promise<string> {
  if (ENV_WAREHOUSE) return ENV_WAREHOUSE;
  const data = await bl('getInventoryWarehouses', {});
  const list = (data.warehouses ?? []) as { warehouse_type: string; warehouse_id: number }[];
  const own = list.filter((w) => w.warehouse_type === 'bl');
  if (own.length === 1) return `bl_${own[0].warehouse_id}`;
  throw new Error(
    'Ustaw sekret BASELINKER_WAREHOUSE_ID (np. bl_12345) — w BaseLinkerze jest kilka magazynow.',
  );
}

function stockOf(stock: unknown, warehouse: string): number {
  if (!stock || typeof stock !== 'object') return 0;
  const n = Number((stock as Record<string, unknown>)[warehouse]);
  return Number.isFinite(n) ? n : 0;
}

interface BlListItem {
  id: number;
  sku: string;
  ean: string;
  name: string;
  stock: Record<string, number>;
  prices: Record<string, number>;
}

async function listAllBlProducts(): Promise<BlListItem[]> {
  const out: BlListItem[] = [];
  for (let page = 1; page <= 40; page++) {
    const data = await bl('getInventoryProductsList', { inventory_id: INVENTORY_ID, page });
    const products = (data.products ?? {}) as Record<string, Record<string, unknown>>;
    const ids = Object.keys(products);
    if (!ids.length) break;
    for (const id of ids) {
      const p = products[id];
      out.push({
        id: Number(p.id ?? id),
        sku: String(p.sku ?? ''),
        ean: String(p.ean ?? ''),
        name: String(p.name ?? ''),
        stock: (p.stock ?? {}) as Record<string, number>,
        prices: (p.prices ?? {}) as Record<string, number>,
      });
    }
    if (ids.length < 1000) break;
  }
  return out;
}

// deno-lint-ignore no-explicit-any
type Admin = any;

async function loadSettings(admin: Admin): Promise<SyncSettings> {
  const { data } = await admin.from('app_settings').select('data').eq('id', 'default').maybeSingle();
  const d = (data?.data ?? {}) as Record<string, unknown>;
  const saved = (d.baselinkerSync ?? {}) as Partial<SyncSettings>;
  const merged: SyncSettings = { ...DEFAULT_SETTINGS, ...saved };
  // zgodnosc wsteczna z pojedynczym przelacznikiem
  if (d.baselinkerSync === undefined && d.baselinkerAutoStock === true) merged.stockAuto = true;
  merged.excludePrefixes = (merged.excludePrefixes ?? []).map((s) => String(s).toUpperCase().trim()).filter(Boolean);
  merged.excludeSkus = (merged.excludeSkus ?? []).map((s) => String(s).toUpperCase().trim()).filter(Boolean);
  return merged;
}

function isExcluded(sku: string, s: SyncSettings): boolean {
  const u = sku.toUpperCase();
  return s.excludeSkus.includes(u) || s.excludePrefixes.some((p) => u.startsWith(p));
}

interface OurProduct {
  sku: string;
  name: string;
  stock: number;
  stockManual: boolean;
  priceGross: number | null;
}

function ourGrossPrice(r: Record<string, unknown>): number | null {
  const gross = Number(r.price_sale_gross);
  if (Number.isFinite(gross) && gross > 0) return Math.round(gross * 100) / 100;
  const net = Number(r.price_sale_net);
  if (Number.isFinite(net) && net > 0) {
    const vatRaw = Number(r.vat);
    const vat = Number.isFinite(vatRaw) && vatRaw >= 0 ? vatRaw : 23;
    return Math.round(net * (1 + vat / 100) * 100) / 100;
  }
  return null;
}

const OUR_COLUMNS =
  'sku,stock,display_name,name,stock_manual,price_sale_net,price_sale_gross,vat:product_meta->>vatRate';

function mapOur(r: Record<string, unknown>): OurProduct {
  return {
    sku: String(r.sku ?? '').toUpperCase(),
    name: String(r.display_name || r.name || ''),
    stock: Number(r.stock ?? 0),
    stockManual: r.stock_manual === true,
    priceGross: ourGrossPrice(r),
  };
}

async function loadOurAll(admin: Admin): Promise<OurProduct[]> {
  const out: OurProduct[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('products').select(OUR_COLUMNS).order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) out.push(mapOur(r));
    if (!data || data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Brak Authorization' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const bearer = authHeader.replace(/^Bearer\s+/i, '');
    const isSystem = bearer === serviceKey;

    let userId: string | null = null;
    let userLabel = 'agent WAPRO';
    let isAdmin = false;
    if (!isSystem) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user },
        error,
      } = await userClient.auth.getUser();
      if (error || !user) return json({ error: 'Nieautoryzowany' }, 401);
      userId = user.id;
      const { data: prof } = await admin
        .from('profiles')
        .select('role,active,display_name,email')
        .eq('id', user.id)
        .maybeSingle();
      if (!prof || prof.active === false) return json({ error: 'Konto nieaktywne' }, 403);
      isAdmin = prof.role === 'admin';
      userLabel = String(prof.display_name || prof.email || '');
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    const needAdmin = () => {
      if (!isSystem && !isAdmin) throw Object.assign(new Error('Tylko administrator'), { status: 403 });
    };
    if (!INVENTORY_ID && action !== 'settings-set' && action !== 'history') {
      return json({ error: 'Brak sekretu BASELINKER_INVENTORY_ID w Supabase.' }, 500);
    }

    const priceGroupFor = (s: SyncSettings, fallback?: string) =>
      s.priceGroupId || ENV_PRICE_GROUP || fallback || '';

    // ---- product -------------------------------------------------------------------------
    if (action === 'product') {
      if (isSystem) return json({ error: 'Niedostepne dla service_role' }, 400);
      const sku = String(body.sku ?? '').trim();
      if (!sku) return json({ error: 'Brak sku' }, 400);
      const warehouse = await resolveWarehouse();
      const settings = await loadSettings(admin);

      const candidates = [...new Set([sku, sku.toUpperCase(), normSku(sku)])];
      let found: Record<string, unknown> | null = null;
      for (const c of candidates) {
        const list = await bl('getInventoryProductsList', { inventory_id: INVENTORY_ID, filter_sku: c });
        const arr = Object.values((list.products ?? {}) as Record<string, Record<string, unknown>>);
        found = arr.find((p) => normSku(String(p.sku ?? '')) === normSku(sku)) ?? null;
        if (found) break;
      }
      if (!found) return json({ found: false, sku, warehouse });

      const id = Number(found.id);
      const full = await bl('getInventoryProductsData', { inventory_id: INVENTORY_ID, products: [id] });
      const p = ((full.products ?? {}) as Record<string, Record<string, unknown>>)[String(id)] ?? found;
      const prices = (p.prices ?? {}) as Record<string, number>;
      const groupId = priceGroupFor(settings, Object.keys(prices)[0]);
      const imagesMap = (p.images ?? {}) as Record<string, string>;
      const images = Object.values(imagesMap).filter((u) => typeof u === 'string' && u).slice(0, 8);
      const text = (p.text_fields ?? {}) as Record<string, unknown>;
      const description = String(text.description ?? '');
      return json({
        found: true,
        id,
        sku: String(p.sku ?? sku),
        ean: String(p.ean ?? ''),
        name: String(text.name ?? p.name ?? found.name ?? ''),
        stock: stockOf(p.stock, warehouse),
        stockByWarehouse: p.stock ?? {},
        warehouse,
        priceGross: groupId && prices[groupId] != null ? Number(prices[groupId]) : null,
        priceGroupId: groupId || null,
        prices,
        taxRate: p.tax_rate ?? null,
        weight: p.weight ?? null,
        categoryId: p.category_id ?? null,
        images,
        imageCount: Object.keys(imagesMap).length,
        descriptionLength: description.replace(/<[^>]*>/g, '').trim().length,
        isBundle: Boolean(p.is_bundle),
        inventoryId: INVENTORY_ID,
      });
    }

    // ---- config --------------------------------------------------------------------------
    if (action === 'config') {
      needAdmin();
      const settings = await loadSettings(admin);
      const configured = {
        token: Boolean(TOKEN),
        inventoryId: INVENTORY_ID || null,
        warehouseId: ENV_WAREHOUSE || null,
        priceGroupId: ENV_PRICE_GROUP || null,
      };
      if (!TOKEN) return json({ configured, settings });
      const [inventories, warehouses, priceGroups] = await Promise.all([
        bl('getInventories', {}).then((d) => d.inventories ?? []).catch((e) => ({ error: String(e) })),
        bl('getInventoryWarehouses', {}).then((d) => d.warehouses ?? []).catch((e) => ({ error: String(e) })),
        bl('getInventoryPriceGroups', {}).then((d) => d.price_groups ?? []).catch((e) => ({ error: String(e) })),
      ]);
      let resolvedWarehouse: string | null = null;
      try {
        resolvedWarehouse = await resolveWarehouse();
      } catch {
        /* pokazemy w UI brak */
      }
      return json({ configured, resolvedWarehouse, settings, inventories, warehouses, priceGroups });
    }

    // ---- settings-set --------------------------------------------------------------------
    if (action === 'settings-set') {
      needAdmin();
      const incoming = (body.settings ?? {}) as Partial<SyncSettings>;
      const clean: SyncSettings = {
        stockAuto: Boolean(incoming.stockAuto),
        priceAuto: Boolean(incoming.priceAuto),
        priceGroupId: String(incoming.priceGroupId ?? '').trim(),
        skipManualStock: incoming.skipManualStock !== false,
        maxAutoChanges: Math.min(5000, Math.max(1, Math.round(Number(incoming.maxAutoChanges) || 400))),
        excludePrefixes: (incoming.excludePrefixes ?? []).map((s) => String(s).toUpperCase().trim()).filter(Boolean),
        excludeSkus: (incoming.excludeSkus ?? []).map((s) => String(s).toUpperCase().trim()).filter(Boolean),
        priceTolerance: Math.max(0, Number(incoming.priceTolerance) || 0.01),
      };
      const { data: row } = await admin.from('app_settings').select('data').eq('id', 'default').maybeSingle();
      const data = { ...((row?.data as Record<string, unknown>) ?? {}), baselinkerSync: clean };
      delete (data as Record<string, unknown>).baselinkerAutoStock;
      const { error } = await admin
        .from('app_settings')
        .upsert({ id: 'default', data, updated_at: new Date().toISOString(), updated_by: userId });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, settings: clean });
    }

    // ---- history -------------------------------------------------------------------------
    if (action === 'history') {
      needAdmin();
      const { data, error } = await admin
        .from('baselinker_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) return json({ error: error.message }, 500);
      return json({ rows: data ?? [] });
    }

    // ---- compare -------------------------------------------------------------------------
    if (action === 'compare') {
      needAdmin();
      const warehouse = await resolveWarehouse();
      const settings = await loadSettings(admin);
      const blProducts = await listAllBlProducts();
      const firstPrices = blProducts.find((p) => Object.keys(p.prices).length)?.prices ?? {};
      const groupId = priceGroupFor(settings, Object.keys(firstPrices)[0]);

      const blBySku = new Map<string, BlListItem>();
      const blByNorm = new Map<string, BlListItem>();
      for (const p of blProducts) {
        if (!p.sku) continue;
        blBySku.set(p.sku.toUpperCase(), p);
        if (!blByNorm.has(normSku(p.sku))) blByNorm.set(normSku(p.sku), p);
      }

      const ours = await loadOurAll(admin);
      const seen = new Set<string>();
      const ourNorm = new Set<string>();
      const stockDiffs: Record<string, unknown>[] = [];
      const priceDiffs: Record<string, unknown>[] = [];
      const missingInBl: Record<string, unknown>[] = [];
      const links: Record<string, unknown>[] = [];
      let matched = 0;
      let excluded = 0;

      for (const o of ours) {
        if (!o.sku || seen.has(o.sku)) continue;
        seen.add(o.sku);
        ourNorm.add(normSku(o.sku));
        const b = blBySku.get(o.sku) ?? blByNorm.get(normSku(o.sku));
        if (!b) {
          if (o.stock > 0) missingInBl.push({ sku: o.sku, name: o.name, ours: o.stock });
          continue;
        }
        matched++;
        const blStock = stockOf(b.stock, warehouse);
        const blPrice = groupId && b.prices[groupId] != null ? Number(b.prices[groupId]) : null;
        links.push({
          sku: o.sku,
          bl_product_id: b.id,
          bl_sku: b.sku,
          bl_name: b.name,
          bl_stock: blStock,
          bl_price_gross: blPrice,
          checked_at: new Date().toISOString(),
        });
        if (isExcluded(o.sku, settings)) {
          excluded++;
          continue;
        }
        const want = Math.max(0, Math.floor(o.stock));
        if (blStock !== want) {
          stockDiffs.push({ sku: o.sku, name: o.name, ours: want, bl: blStock, blId: b.id, manual: o.stockManual });
        }
        if (o.priceGross != null && blPrice != null && Math.abs(o.priceGross - blPrice) > settings.priceTolerance) {
          priceDiffs.push({ sku: o.sku, name: o.name, ours: o.priceGross, bl: blPrice, blId: b.id });
        } else if (o.priceGross != null && blPrice == null) {
          priceDiffs.push({ sku: o.sku, name: o.name, ours: o.priceGross, bl: null, blId: b.id });
        }
      }

      const onlyInBl = blProducts.filter(
        (b) => b.sku && !seen.has(b.sku.toUpperCase()) && !ourNorm.has(normSku(b.sku)),
      );

      for (let i = 0; i < links.length; i += 500) {
        await admin.from('baselinker_links').upsert(links.slice(i, i + 500), { onConflict: 'sku' });
      }

      return json({
        warehouse,
        priceGroupId: groupId || null,
        totals: {
          ours: seen.size,
          bl: blProducts.length,
          matched,
          excluded,
          stockDiffs: stockDiffs.length,
          priceDiffs: priceDiffs.length,
          missingInBl: missingInBl.length,
          onlyInBl: onlyInBl.length,
        },
        stockDiffs: stockDiffs.slice(0, 3000),
        priceDiffs: priceDiffs.slice(0, 3000),
        missingInBl: missingInBl.slice(0, 500),
        onlyInBl: onlyInBl
          .slice(0, 500)
          .map((b) => ({ sku: b.sku, name: b.name, bl: stockOf(b.stock, warehouse), blId: b.id })),
      });
    }

    // ---- push ----------------------------------------------------------------------------
    if (action === 'push') {
      needAdmin();
      const settings = await loadSettings(admin);
      const skus = Array.isArray(body.skus)
        ? [...new Set((body.skus as unknown[]).map((s) => String(s).toUpperCase()).filter(Boolean))]
        : [];
      if (!skus.length) return json({ error: 'Brak listy sku do wyslania' }, 400);

      let fields: Field[] = (Array.isArray(body.fields) ? body.fields : ['stock', 'price']).filter(
        (f: unknown): f is Field => f === 'stock' || f === 'price',
      );
      const trigger = isSystem ? 'auto' : 'manual';

      if (isSystem) {
        fields = fields.filter((f) => (f === 'stock' ? settings.stockAuto : settings.priceAuto));
        if (!fields.length) {
          return json({ skipped: true, reason: 'Automatyczna synchronizacja do BaseLinker jest wylaczona' });
        }
        if (skus.length > settings.maxAutoChanges) {
          await admin.from('baselinker_sync_log').insert({
            trigger,
            user_label: userLabel,
            field: fields.join('+'),
            requested: skus.length,
            updated: 0,
            status: 'blocked',
            note: `Przekroczono limit automatu (${settings.maxAutoChanges}) — wyslij recznie w Administracja → BaseLinker`,
          });
          return json({
            skipped: true,
            reason: `Zmienionych SKU (${skus.length}) wiecej niz limit automatu (${settings.maxAutoChanges})`,
          });
        }
      }
      if (!fields.length) return json({ error: 'Brak pol do wyslania' }, 400);

      const warehouse = fields.includes('stock') ? await resolveWarehouse() : '';
      let groupId = '';
      if (fields.includes('price')) {
        groupId = priceGroupFor(settings);
        if (!groupId) {
          const first = await bl('getInventoryPriceGroups', {});
          const groups = (first.price_groups ?? []) as { price_group_id: number }[];
          if (groups.length === 1) groupId = String(groups[0].price_group_id);
          else throw new Error('Wybierz grupe cenowa w ustawieniach synchronizacji (zakladka BaseLinker).');
        }
      }

      const links = new Map<string, number>();
      const our = new Map<string, OurProduct>();
      for (let i = 0; i < skus.length; i += 200) {
        const part = skus.slice(i, i + 200);
        const [{ data: lk }, { data: pr }] = await Promise.all([
          admin.from('baselinker_links').select('sku,bl_product_id').in('sku', part),
          admin.from('products').select(OUR_COLUMNS).in('sku', part),
        ]);
        for (const r of lk ?? []) links.set(String(r.sku).toUpperCase(), Number(r.bl_product_id));
        for (const r of pr ?? []) {
          const m = mapOur(r);
          if (!our.has(m.sku)) our.set(m.sku, m);
        }
      }

      const results: Record<string, unknown> = {};
      const noLink: string[] = [];
      const nowIso = new Date().toISOString();

      for (const field of fields) {
        const payload: [string, number, string][] = [];
        let skipped = 0;
        for (const sku of skus) {
          const blId = links.get(sku);
          const o = our.get(sku);
          if (!blId || !o) {
            if (field === fields[0]) noLink.push(sku);
            continue;
          }
          if (isSystem && isExcluded(sku, settings)) {
            skipped++;
            continue;
          }
          if (field === 'stock') {
            if (isSystem && settings.skipManualStock && o.stockManual) {
              skipped++;
              continue;
            }
            payload.push([String(blId), Math.max(0, Math.floor(o.stock)), sku]);
          } else {
            if (o.priceGross == null) {
              skipped++;
              continue;
            }
            payload.push([String(blId), o.priceGross, sku]);
          }
        }

        let updated = 0;
        const warnings: Record<string, unknown> = {};
        let failure = '';
        try {
          for (let i = 0; i < payload.length; i += 500) {
            const chunk = payload.slice(i, i + 500);
            const products: Record<string, Record<string, number>> = {};
            for (const [id, val] of chunk) products[id] = { [field === 'stock' ? warehouse : groupId]: val };
            const res = await bl(field === 'stock' ? 'updateInventoryProductsStock' : 'updateInventoryProductsPrices', {
              inventory_id: INVENTORY_ID,
              products,
            });
            updated += Number(res.counter ?? chunk.length);
            Object.assign(warnings, res.warnings ?? {});
          }
        } catch (e) {
          failure = e instanceof Error ? e.message : String(e);
        }

        if (!failure) {
          const upd = payload.map(([id, val, sku]) => ({
            sku,
            bl_product_id: Number(id),
            ...(field === 'stock' ? { bl_stock: val } : { bl_price_gross: val }),
            checked_at: nowIso,
          }));
          for (let i = 0; i < upd.length; i += 500) {
            await admin.from('baselinker_links').upsert(upd.slice(i, i + 500), { onConflict: 'sku' });
          }
        }

        await admin.from('baselinker_sync_log').insert({
          trigger,
          user_label: userLabel,
          field,
          requested: skus.length,
          updated,
          skipped,
          status: failure ? 'error' : Object.keys(warnings).length ? 'warning' : 'ok',
          note: failure || (Object.keys(warnings).length ? `Ostrzezenia BL: ${Object.keys(warnings).length}` : ''),
          sample: payload.slice(0, 20).map(([id, val, sku]) => ({ sku, blId: id, value: val })),
        });
        results[field] = { updated, skipped, warnings, error: failure || undefined };
      }

      if (userId) {
        await admin.from('audit_log').insert({
          user_id: userId,
          user_label: userLabel,
          user_role: 'admin',
          app: 'baselinker',
          action: 'baselinker.push',
          entity_type: 'baselinker',
          entity_id: fields.join('+'),
          summary: `Wyslano do BaseLinker (${fields.join(', ')}): ${skus.length} SKU`,
        });
      }

      return json({ fields, requested: skus.length, results, noLink: noLink.slice(0, 200), noLinkCount: noLink.length });
    }

    return json({ error: `Nieznana akcja: ${action}` }, 400);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Blad serwera';
    return json({ error: message }, status);
  }
});
