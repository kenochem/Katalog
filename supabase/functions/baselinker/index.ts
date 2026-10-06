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
  /** Stan >= tej wartosci uznajemy za "wlasny" (np. 999999) i pomijamy w synchronizacji grupowej; 0 = wylaczone. */
  skipStockAbove: number;
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
  skipStockAbove: 99999,
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

function skipStockFor(o: { stock: number; skipStock: boolean }, s: SyncSettings): boolean {
  return o.skipStock || (s.skipStockAbove > 0 && o.stock >= s.skipStockAbove);
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
  skipStock: boolean;
  skipPrice: boolean;
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
  'sku,stock,display_name,name,stock_manual,price_sale_net,price_sale_gross,vat:product_meta->>vatRate,skip_stock:product_meta->>baselinkerSkipStock,skip_price:product_meta->>baselinkerSkipPrice';

function mapOur(r: Record<string, unknown>): OurProduct {
  return {
    sku: String(r.sku ?? '').toUpperCase(),
    name: String(r.display_name || r.name || ''),
    stock: Number(r.stock ?? 0),
    stockManual: r.stock_manual === true,
    skipStock: r.skip_stock === 'true',
    skipPrice: r.skip_price === 'true',
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


// ---------------------------------------------------------------------------------------------
// Import produktu z katalogu do BaseLinkera (addInventoryProduct)
// ---------------------------------------------------------------------------------------------

const IMPORT_COLUMNS =
  'sku,ean,name,display_name,description,category,manufacturer,stock,stock_manual,price_purchase_net,price_sale_net,price_sale_gross,tags,warehouse_location,image_url,custom_image_url,extra_images,product_meta';

const INTERNAL_TAGS = new Set(['wapro-import', 'do-uzupelnienia', 'sonax']);

interface ImportCtx {
  warehouse: string;
  priceGroupId: string;
  categories: Map<string, number[]>;
  manufacturers: Map<string, number>;
  settings: SyncSettings;
}

function leafName(path: string): string {
  const parts = String(path || '').split(/[>/|]/).map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

async function loadImportCtx(settings: SyncSettings): Promise<ImportCtx> {
  const warehouse = await resolveWarehouse();
  let priceGroupId = priceGroupFor(settings);
  if (!priceGroupId) {
    const groups = ((await bl('getInventoryPriceGroups', {})).price_groups ?? []) as { price_group_id: number }[];
    if (groups.length === 1) priceGroupId = String(groups[0].price_group_id);
    else throw new Error('Wybierz grupe cenowa w ustawieniach synchronizacji (zakladka BaseLinker).');
  }

  const categories = new Map<string, number[]>();
  try {
    const cats = ((await bl('getInventoryCategories', { inventory_id: INVENTORY_ID })).categories ?? []) as {
      category_id: number;
      name: string;
    }[];
    for (const c of cats) {
      const k = String(c.name).trim().toLowerCase();
      categories.set(k, [...(categories.get(k) ?? []), Number(c.category_id)]);
    }
  } catch {
    /* brak kategorii — ostrzezenie przy produkcie */
  }

  const manufacturers = new Map<string, number>();
  try {
    const raw = (await bl('getInventoryManufacturers', {})).manufacturers ?? [];
    const list = Array.isArray(raw)
      ? raw
      : Object.entries(raw as Record<string, unknown>).map(([id, v]) =>
          typeof v === 'string' ? { manufacturer_id: id, name: v } : { manufacturer_id: id, ...(v as object) },
        );
    for (const m of list as { manufacturer_id: number | string; name: string }[]) {
      manufacturers.set(String(m.name).trim().toLowerCase(), Number(m.manufacturer_id));
    }
  } catch {
    /* brak producentow — ostrzezenie przy produkcie */
  }

  return { warehouse, priceGroupId, categories, manufacturers, settings };
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Buduje ladunek addInventoryProduct z wiersza produktu + liste ostrzezen/blokad. */
function buildImport(row: Record<string, unknown>, ctx: ImportCtx) {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const meta = (row.product_meta ?? {}) as Record<string, unknown>;
  const sku = String(row.sku ?? '').trim();
  const name = String(row.display_name || row.name || '').trim();
  if (!sku) blockers.push('brak SKU');
  if (!name) blockers.push('brak nazwy');

  const vatRaw = Number(meta.vatRate);
  const vat = Number.isFinite(vatRaw) && vatRaw >= 0 ? vatRaw : 23;
  const gross = Number(row.price_sale_gross);
  const net = Number(row.price_sale_net);
  let priceGross: number | null = null;
  if (Number.isFinite(gross) && gross > 0) priceGross = Math.round(gross * 100) / 100;
  else if (Number.isFinite(net) && net > 0) priceGross = Math.round(net * (1 + vat / 100) * 100) / 100;
  if (priceGross == null) warnings.push('brak ceny sprzedazy');

  const purchase = Number(row.price_purchase_net);
  const hasPurchase = Number.isFinite(purchase) && purchase > 0;
  if (!hasPurchase) warnings.push('brak ceny zakupu');

  // zdjecia
  const urls: string[] = [];
  const push = (u: unknown) => {
    const t = typeof u === 'string' ? u.trim() : '';
    if (/^https?:\/\//i.test(t) && t.length <= 995 && !urls.includes(t)) urls.push(t);
  };
  push(row.custom_image_url);
  push(row.image_url);
  if (Array.isArray(row.extra_images)) for (const u of row.extra_images) push(u);
  if (!urls.length) warnings.push('brak zdjec');

  const ean = String(row.ean ?? '').trim();
  if (!ean) warnings.push('brak EAN');

  const weight = Number(meta.weightKg);
  if (!(Number.isFinite(weight) && weight > 0)) warnings.push('brak wagi');

  const descRaw = String(row.description ?? '').trim();
  if (!descRaw) warnings.push('brak opisu');
  const description = !descRaw ? '' : /<[a-z][\s\S]*>/i.test(descRaw) ? descRaw : escapeHtml(descRaw).replace(/\r?\n/g, '<br>');

  // kategoria
  const catNames = [leafName(String(meta.shopCategoryPath ?? '')), String(row.category ?? '').trim()].filter(Boolean);
  let categoryId: number | null = null;
  for (const n of catNames) {
    const ids = ctx.categories.get(n.toLowerCase());
    if (ids?.length) {
      categoryId = ids[0];
      break;
    }
  }
  if (categoryId == null) warnings.push(`brak kategorii w BaseLinkerze (${catNames[0] ?? 'nie przypisano'})`);

  // producent
  const manName = String(row.manufacturer ?? '').trim();
  const manufacturerId = manName ? ctx.manufacturers.get(manName.toLowerCase()) ?? null : null;
  if (manufacturerId == null) warnings.push(`brak producenta w BaseLinkerze (${manName || 'nie przypisano'})`);

  // stan (stan wlasny typu 999999 nie jest przenoszony)
  const stockRaw = Math.max(0, Math.floor(Number(row.stock ?? 0)));
  const ownStock =
    meta.baselinkerSkipStock === true || (ctx.settings.skipStockAbove > 0 && stockRaw >= ctx.settings.skipStockAbove);
  if (ownStock) warnings.push('stan wlasny — w BaseLinkerze ustawiono 0');
  const stock = ownStock ? 0 : stockRaw;

  const payload: Record<string, unknown> = {
    inventory_id: INVENTORY_ID,
    sku,
    tax_rate: vat,
    prices: priceGross != null ? { [ctx.priceGroupId]: priceGross } : {},
    stock: { [ctx.warehouse]: stock },
    text_fields: {
      name,
      ...(description ? { description } : {}),
      ...(meta.shortDescription ? { description_extra1: String(meta.shortDescription) } : {}),
      ...(meta.parameters && typeof meta.parameters === 'object' && Object.keys(meta.parameters as object).length
        ? { features: meta.parameters }
        : {}),
    },
  };
  if (ean) payload.ean = ean;
  if (hasPurchase) payload.average_cost = Math.round(purchase * 100) / 100;
  if (Number.isFinite(weight) && weight > 0) payload.weight = weight;
  for (const [k, mk] of [['height', 'heightCm'], ['width', 'widthCm'], ['length', 'depthCm']] as const) {
    const v = Number(meta[mk]);
    if (Number.isFinite(v) && v > 0) payload[k] = v;
  }
  if (categoryId != null) payload.category_id = categoryId;
  if (manufacturerId != null) payload.manufacturer_id = manufacturerId;
  const tags = (Array.isArray(row.tags) ? row.tags : [])
    .map((t) => String(t).trim())
    .filter((t) => t && !INTERNAL_TAGS.has(t.toLowerCase()));
  if (tags.length) payload.tags = tags;
  const loc = String(row.warehouse_location ?? '').trim();
  if (loc) payload.locations = { [ctx.warehouse]: loc };
  if (urls.length) {
    const images: Record<string, string> = {};
    urls.slice(0, 16).forEach((u, i) => (images[String(i)] = `url:${u}`));
    payload.images = images;
  }

  return { sku, name, payload, warnings, blockers, priceGross, stock };
}

/** Zbior SKU istniejacych w katalogu BL (do blokady importu). */
async function existingBlSkus(): Promise<{ exact: Set<string>; norm: Set<string> }> {
  const all = await listAllBlProducts();
  const exact = new Set<string>();
  const norm = new Set<string>();
  for (const p of all) {
    if (!p.sku) continue;
    exact.add(p.sku.toUpperCase());
    norm.add(normSku(p.sku));
  }
  return { exact, norm };
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
        skipStockAbove: settings.skipStockAbove,
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
        skipStockAbove: Math.max(0, Math.round(Number(incoming.skipStockAbove) || 0)),
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
      let skippedStock = 0;
      let skippedPrice = 0;

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
          if (skipStockFor(o, settings)) skippedStock++;
          else stockDiffs.push({ sku: o.sku, name: o.name, ours: want, bl: blStock, blId: b.id, manual: o.stockManual });
        }
        const priceDiffers =
          o.priceGross != null &&
          (blPrice == null || Math.abs(o.priceGross - blPrice) > settings.priceTolerance);
        if (priceDiffers) {
          if (o.skipPrice) skippedPrice++;
          else priceDiffs.push({ sku: o.sku, name: o.name, ours: o.priceGross, bl: blPrice, blId: b.id });
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
          skippedStock,
          skippedPrice,
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
            if (isSystem && ((settings.skipManualStock && o.stockManual) || skipStockFor(o, settings))) {
              skipped++;
              continue;
            }
            payload.push([String(blId), Math.max(0, Math.floor(o.stock)), sku]);
          } else {
            if (o.priceGross == null || (isSystem && o.skipPrice)) {
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


    // ---- import-candidates ---------------------------------------------------------------
    if (action === 'import-candidates') {
      needAdmin();
      const settings = await loadSettings(admin);
      const ctx = await loadImportCtx(settings);
      const { exact, norm } = await existingBlSkus();

      const withDesc = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data } = await admin.from('products').select('sku').neq('description', '').not('description', 'is', null).range(from, from + 999);
        for (const r of data ?? []) withDesc.add(String(r.sku).toUpperCase());
        if (!data || data.length < 1000) break;
      }

      const rows: Record<string, unknown>[] = [];
      const seen = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await admin
          .from('products')
          .select(IMPORT_COLUMNS.replace('description,', ''))
          .order('id')
          .range(from, from + 999);
        if (error) return json({ error: error.message }, 500);
        for (const r of data ?? []) {
          const sku = String(r.sku ?? '').toUpperCase();
          if (!sku || seen.has(sku) || exact.has(sku) || norm.has(normSku(sku))) continue;
          seen.add(sku);
          const meta = (r.product_meta ?? {}) as Record<string, unknown>;
          if (meta.catalogHidden === true) continue;
          // opis ocenia osobny zbior (bez pobierania tresci)
          const built = buildImport({ ...r, description: withDesc.has(sku) ? 'x' : '' }, ctx);
          rows.push({
            sku,
            name: built.name,
            stock: built.stock,
            price: built.priceGross,
            images: built.payload.images ? Object.keys(built.payload.images as object).length : 0,
            warnings: built.warnings,
            blockers: built.blockers,
          });
        }
        if (!data || data.length < 1000) break;
      }
      rows.sort((a, b) => (a.warnings as string[]).length - (b.warnings as string[]).length);
      return json({
        total: rows.length,
        complete: rows.filter((r) => !(r.warnings as string[]).length && !(r.blockers as string[]).length).length,
        rows: rows.slice(0, 1500),
        categoriesKnown: ctx.categories.size,
        manufacturersKnown: ctx.manufacturers.size,
      });
    }

    // ---- import --------------------------------------------------------------------------
    if (action === 'import') {
      needAdmin();
      if (isSystem) return json({ error: 'Import tylko recznie' }, 400);
      const settings = await loadSettings(admin);
      const skus = Array.isArray(body.skus)
        ? [...new Set((body.skus as unknown[]).map((x) => String(x).toUpperCase().trim()).filter(Boolean))]
        : [];
      if (!skus.length) return json({ error: 'Brak listy sku' }, 400);
      if (skus.length > 40) return json({ error: 'Maksymalnie 40 produktow na jedno wywolanie' }, 400);

      const ctx = await loadImportCtx(settings);
      const { exact, norm } = await existingBlSkus(); // swieze sprawdzenie tuz przed zapisem

      const { data: rows, error } = await admin.from('products').select(IMPORT_COLUMNS).in('sku', skus);
      if (error) return json({ error: error.message }, 500);
      const bySku = new Map<string, Record<string, unknown>>();
      for (const r of rows ?? []) {
        const k = String(r.sku).toUpperCase();
        if (!bySku.has(k)) bySku.set(k, r);
      }

      const results: Record<string, unknown>[] = [];
      const links: Record<string, unknown>[] = [];
      for (const sku of skus) {
        const row = bySku.get(sku);
        if (!row) {
          results.push({ sku, status: 'error', message: 'Nie znaleziono produktu w katalogu' });
          continue;
        }
        if (exact.has(sku) || norm.has(normSku(sku))) {
          results.push({ sku, status: 'blocked', message: 'SKU juz istnieje w katalogu BaseLinkera — import zablokowany' });
          continue;
        }
        const built = buildImport(row, ctx);
        if (built.blockers.length) {
          results.push({ sku, status: 'error', message: built.blockers.join(', ') });
          continue;
        }
        try {
          const res = await bl('addInventoryProduct', built.payload);
          const blId = Number(res.product_id);
          results.push({
            sku,
            status: 'created',
            blId,
            warnings: built.warnings,
            blWarnings: res.warnings ?? {},
          });
          exact.add(sku);
          norm.add(normSku(sku));
          links.push({
            sku,
            bl_product_id: blId,
            bl_sku: sku,
            bl_name: built.name,
            bl_stock: built.stock,
            bl_price_gross: built.priceGross,
            checked_at: new Date().toISOString(),
          });
          await new Promise((r) => setTimeout(r, 700)); // limit 100 zapytan/min
        } catch (e) {
          results.push({ sku, status: 'error', message: e instanceof Error ? e.message : String(e) });
        }
      }
      if (links.length) await admin.from('baselinker_links').upsert(links, { onConflict: 'sku' });

      const created = results.filter((r) => r.status === 'created').length;
      await admin.from('baselinker_sync_log').insert({
        trigger: 'manual',
        user_label: userLabel,
        field: 'import',
        requested: skus.length,
        updated: created,
        skipped: results.filter((r) => r.status === 'blocked').length,
        status: results.some((r) => r.status === 'error') ? 'warning' : 'ok',
        note: `Import produktow do BaseLinker: utworzono ${created} z ${skus.length}`,
        sample: results.slice(0, 20),
      });
      if (userId) {
        await admin.from('audit_log').insert({
          user_id: userId,
          user_label: userLabel,
          user_role: 'admin',
          app: 'baselinker',
          action: 'baselinker.import',
          entity_type: 'baselinker',
          entity_id: String(INVENTORY_ID),
          summary: `Import do BaseLinker: utworzono ${created} z ${skus.length} produktow`,
        });
      }
      return json({ results });
    }

    return json({ error: `Nieznana akcja: ${action}` }, 400);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Blad serwera';
    return json({ error: message }, status);
  }
});
