import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

/**
 * Proxy do API BaseLinker (token tylko po stronie serwera).
 *
 * Sekrety (npx supabase secrets set ...):
 *   BASELINKER_TOKEN, BASELINKER_INVENTORY_ID,
 *   BASELINKER_WAREHOUSE_ID (np. bl_12345 — opcjonalnie, gdy jest tylko jeden magazyn bl_*),
 *   BASELINKER_PRICE_GROUP_ID (opcjonalnie — grupa cenowa brutto do porownania)
 *
 * Akcje (POST JSON { action, ... }):
 *   product  {sku}              — dane produktu z BL (kazdy zalogowany)
 *   config                      — konfiguracja + listy magazynow/grup cen (admin)
 *   compare                     — porownanie stanow katalog vs BL (admin)
 *   push     {skus?}            — wyslanie stanow do BL (admin lub agent WAPRO z service_role;
 *                                 agent tylko gdy wlaczono automatyczny sync)
 *   set-auto {enabled}          — wlacz/wylacz automatyczne wysylanie stanow po syncu WAPRO (admin)
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
    // limit zapytan (100/min) — odczekaj i ponow
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
    'Ustaw sekret BASELINKER_WAREHOUSE_ID (np. bl_12345) — w BaseLinkerze jest kilka magazynow. Lista w zakladce Admin → BaseLinker.',
  );
}

function stockOf(stock: unknown, warehouse: string): number {
  if (!stock || typeof stock !== 'object') return 0;
  const v = (stock as Record<string, unknown>)[warehouse];
  const n = Number(v);
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
        .select('role,active')
        .eq('id', user.id)
        .maybeSingle();
      if (!prof || prof.active === false) return json({ error: 'Konto nieaktywne' }, 403);
      isAdmin = prof.role === 'admin';
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    const needAdmin = () => {
      if (!isSystem && !isAdmin) throw Object.assign(new Error('Tylko administrator'), { status: 403 });
    };
    if (!INVENTORY_ID && action !== 'set-auto') {
      return json({ error: 'Brak sekretu BASELINKER_INVENTORY_ID w Supabase.' }, 500);
    }

    // ---- product -------------------------------------------------------------------------
    if (action === 'product') {
      if (isSystem) return json({ error: 'Niedostepne dla service_role' }, 400);
      const sku = String(body.sku ?? '').trim();
      if (!sku) return json({ error: 'Brak sku' }, 400);
      const warehouse = await resolveWarehouse();

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
      const groupId = ENV_PRICE_GROUP || Object.keys(prices)[0] || '';
      const images = Object.values((p.images ?? {}) as Record<string, string>)
        .filter((u) => typeof u === 'string' && u)
        .slice(0, 8);
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
        tags: p.tags ?? [],
        images,
        imageCount: Object.keys((p.images ?? {}) as Record<string, string>).length,
        descriptionLength: description.replace(/<[^>]*>/g, '').trim().length,
        isBundle: Boolean(p.is_bundle),
        parentId: p.parent_id ?? null,
        inventoryId: INVENTORY_ID,
      });
    }

    // ---- config --------------------------------------------------------------------------
    if (action === 'config') {
      needAdmin();
      const configured = {
        token: Boolean(TOKEN),
        inventoryId: INVENTORY_ID || null,
        warehouseId: ENV_WAREHOUSE || null,
        priceGroupId: ENV_PRICE_GROUP || null,
      };
      const { data: settings } = await admin.from('app_settings').select('data').eq('id', 'default').maybeSingle();
      const auto = Boolean((settings?.data as Record<string, unknown> | null)?.baselinkerAutoStock);
      if (!TOKEN) return json({ configured, autoStock: auto });
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
      return json({ configured, resolvedWarehouse, autoStock: auto, inventories, warehouses, priceGroups });
    }

    // ---- set-auto ------------------------------------------------------------------------
    if (action === 'set-auto') {
      needAdmin();
      const enabled = Boolean(body.enabled);
      const { data: row } = await admin.from('app_settings').select('data').eq('id', 'default').maybeSingle();
      const data = { ...((row?.data as Record<string, unknown>) ?? {}), baselinkerAutoStock: enabled };
      const { error } = await admin
        .from('app_settings')
        .upsert({ id: 'default', data, updated_at: new Date().toISOString(), updated_by: userId });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, autoStock: enabled });
    }

    // ---- compare -------------------------------------------------------------------------
    if (action === 'compare') {
      needAdmin();
      const warehouse = await resolveWarehouse();
      const blProducts = await listAllBlProducts();
      const blBySku = new Map<string, (typeof blProducts)[number]>();
      const blByNorm = new Map<string, (typeof blProducts)[number]>();
      for (const p of blProducts) {
        if (!p.sku) continue;
        blBySku.set(p.sku.toUpperCase(), p);
        if (!blByNorm.has(normSku(p.sku))) blByNorm.set(normSku(p.sku), p);
      }

      const ours: { sku: string; stock: number; name: string }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await admin
          .from('products')
          .select('sku,stock,display_name,name,catalog')
          .order('id')
          .range(from, from + 999);
        if (error) return json({ error: error.message }, 500);
        for (const r of data ?? []) {
          ours.push({
            sku: String(r.sku ?? '').toUpperCase(),
            stock: Number(r.stock ?? 0),
            name: String(r.display_name || r.name || ''),
          });
        }
        if (!data || data.length < 1000) break;
      }

      const seen = new Set<string>();
      const diffs: { sku: string; name: string; ours: number; bl: number; blId: number }[] = [];
      const missingInBl: { sku: string; name: string; ours: number }[] = [];
      const links: Record<string, unknown>[] = [];
      let matched = 0;
      for (const o of ours) {
        if (!o.sku || seen.has(o.sku)) continue;
        seen.add(o.sku);
        const b = blBySku.get(o.sku) ?? blByNorm.get(normSku(o.sku));
        if (!b) {
          if (o.stock > 0) missingInBl.push({ sku: o.sku, name: o.name, ours: o.stock });
          continue;
        }
        matched++;
        const blStock = stockOf(b.stock, warehouse);
        const want = Math.max(0, Math.floor(o.stock));
        links.push({
          sku: o.sku,
          bl_product_id: b.id,
          bl_sku: b.sku,
          bl_name: b.name,
          bl_stock: blStock,
          checked_at: new Date().toISOString(),
        });
        if (blStock !== want) diffs.push({ sku: o.sku, name: o.name, ours: want, bl: blStock, blId: b.id });
      }
      const ourSet = new Set(ours.map((o) => o.sku));
      const onlyInBl = blProducts
        .filter((b) => b.sku && !ourSet.has(b.sku.toUpperCase()) && !seen.has(b.sku.toUpperCase()))
        .filter((b) => {
          const n = normSku(b.sku);
          return !ours.some((o) => normSku(o.sku) === n);
        });

      for (let i = 0; i < links.length; i += 500) {
        await admin.from('baselinker_links').upsert(links.slice(i, i + 500), { onConflict: 'sku' });
      }

      return json({
        warehouse,
        totals: {
          ours: seen.size,
          bl: blProducts.length,
          matched,
          diffs: diffs.length,
          missingInBl: missingInBl.length,
          onlyInBl: onlyInBl.length,
        },
        diffs: diffs.slice(0, 3000),
        missingInBl: missingInBl.slice(0, 500),
        onlyInBl: onlyInBl.slice(0, 500).map((b) => ({ sku: b.sku, name: b.name, bl: stockOf(b.stock, warehouse), blId: b.id })),
      });
    }

    // ---- push ----------------------------------------------------------------------------
    if (action === 'push') {
      needAdmin();
      if (isSystem) {
        const { data: settings } = await admin.from('app_settings').select('data').eq('id', 'default').maybeSingle();
        if (!(settings?.data as Record<string, unknown> | null)?.baselinkerAutoStock) {
          return json({ skipped: true, reason: 'Automatyczny sync stanow do BaseLinker jest wylaczony' });
        }
      }
      const warehouse = await resolveWarehouse();
      const skus = Array.isArray(body.skus)
        ? [...new Set((body.skus as unknown[]).map((s) => String(s).toUpperCase()).filter(Boolean))]
        : [];
      if (!skus.length) return json({ error: 'Brak listy sku do wyslania' }, 400);

      const links = new Map<string, number>();
      const stockBySku = new Map<string, number>();
      for (let i = 0; i < skus.length; i += 200) {
        const part = skus.slice(i, i + 200);
        const [{ data: lk }, { data: pr }] = await Promise.all([
          admin.from('baselinker_links').select('sku,bl_product_id').in('sku', part),
          admin.from('products').select('sku,stock').in('sku', part),
        ]);
        for (const r of lk ?? []) links.set(String(r.sku).toUpperCase(), Number(r.bl_product_id));
        for (const r of pr ?? []) {
          const k = String(r.sku).toUpperCase();
          if (!stockBySku.has(k)) stockBySku.set(k, Number(r.stock ?? 0));
        }
      }

      const payload: [string, number][] = [];
      const noLink: string[] = [];
      for (const sku of skus) {
        const blId = links.get(sku);
        const st = stockBySku.get(sku);
        if (!blId || st == null) {
          noLink.push(sku);
          continue;
        }
        payload.push([String(blId), Math.max(0, Math.floor(st))]);
      }

      let updated = 0;
      const warnings: Record<string, unknown> = {};
      for (let i = 0; i < payload.length; i += 500) {
        const chunk = payload.slice(i, i + 500);
        const products: Record<string, Record<string, number>> = {};
        for (const [id, qty] of chunk) products[id] = { [warehouse]: qty };
        const res = await bl('updateInventoryProductsStock', { inventory_id: INVENTORY_ID, products });
        updated += Number(res.counter ?? chunk.length);
        Object.assign(warnings, res.warnings ?? {});
      }

      const nowIso = new Date().toISOString();
      const skuByBlId = new Map<string, string>();
      for (const [sku, id] of links.entries()) skuByBlId.set(String(id), sku);
      const upd: Record<string, unknown>[] = [];
      for (const [id, qty] of payload) {
        const sku = skuByBlId.get(id);
        if (sku) upd.push({ sku, bl_product_id: Number(id), bl_stock: qty, checked_at: nowIso });
      }
      for (let i = 0; i < upd.length; i += 500) {
        await admin.from('baselinker_links').upsert(upd.slice(i, i + 500), { onConflict: 'sku' });
      }

      if (userId) {
        const { data: prof } = await admin.from('profiles').select('display_name,email,role').eq('id', userId).maybeSingle();
        await admin.from('audit_log').insert({
          user_id: userId,
          user_label: String(prof?.display_name || prof?.email || ''),
          user_role: String(prof?.role || ''),
          app: 'baselinker',
          action: 'baselinker.push',
          entity_type: 'baselinker',
          entity_id: warehouse,
          summary: `Wyslano stany do BaseLinker: ${updated} produktow`,
        });
      }

      return json({ updated, requested: skus.length, noLink: noLink.slice(0, 200), noLinkCount: noLink.length, warnings });
    }

    return json({ error: `Nieznana akcja: ${action}` }, 400);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Blad serwera';
    return json({ error: message }, status);
  }
});
