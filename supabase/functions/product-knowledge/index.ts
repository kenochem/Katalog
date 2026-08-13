/**
 * Uzupełnianie wiedzy o produkcie przez zewnętrzne boty (service secret).
 *
 * Secret w Supabase: KNOWLEDGE_BOT_SECRET (Dashboard → Edge Functions → Secrets)
 * Deploy: npx supabase functions deploy product-knowledge --project-ref ...
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-knowledge-bot-key',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  display_name: string | null;
  description: string | null;
  ean: string | null;
  has_image: boolean;
  image_url: string | null;
  custom_image_url: string | null;
  manufacturer: string | null;
  warehouse_location: string | null;
  variants: unknown;
  product_meta: Record<string, unknown> | null;
};

function assessScore(row: ProductRow): number {
  const meta = row.product_meta && typeof row.product_meta === 'object' ? row.product_meta : {};
  const short = typeof meta.shortDescription === 'string' ? meta.shortDescription.trim() : '';
  const params = meta.parameters && typeof meta.parameters === 'object' ? meta.parameters : {};
  const desc = stripHtml(row.description || '');
  let score = 0;
  if (short.length >= 18) score += 22;
  if (desc.length >= 40) score += 22;
  if (Object.keys(params).length >= 2) score += 18;
  const variants = Array.isArray(row.variants) ? row.variants : [];
  const hasEan =
    !!row.ean?.trim() ||
    variants.some((v) => v && typeof v === 'object' && typeof (v as { ean?: string }).ean === 'string');
  if (hasEan) score += 10;
  if (row.has_image || row.image_url || row.custom_image_url) score += 10;
  const mfg = row.manufacturer?.trim().toLowerCase();
  if (mfg && mfg !== 'wapro') score += 6;
  const w = meta.weightKg;
  const unit = typeof meta.unit === 'string' ? meta.unit.trim() : '';
  if (w != null || unit) score += 6;
  if (row.warehouse_location?.trim()) score += 6;
  return Math.min(100, score);
}

function mergeMeta(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
  overwrite: boolean,
  source: string,
  touched: string[],
): Record<string, unknown> {
  const out = { ...base };

  const strField = (key: string, maxLen: number) => {
    const v = patch[key];
    if (typeof v !== 'string') return;
    const t = v.trim().slice(0, maxLen);
    if (!t) return;
    const cur = typeof out[key] === 'string' ? String(out[key]).trim() : '';
    if (!overwrite && cur) return;
    out[key] = t;
    touched.push(key);
  };

  strField('shortDescription', 2000);
  if (typeof patch.unit === 'string' && patch.unit.trim()) {
    if (overwrite || !out.unit) {
      out.unit = patch.unit.trim().slice(0, 32);
      touched.push('unit');
    }
  }
  for (const numKey of ['weightKg', 'widthCm', 'heightCm', 'depthCm', 'vatRate'] as const) {
    const v = patch[numKey];
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    if (!Number.isFinite(n)) continue;
    if (!overwrite && out[numKey] != null) continue;
    out[numKey] = n;
    touched.push(numKey);
  }

  if (patch.parameters && typeof patch.parameters === 'object' && !Array.isArray(patch.parameters)) {
    const baseParams =
      out.parameters && typeof out.parameters === 'object' && !Array.isArray(out.parameters)
        ? { ...(out.parameters as Record<string, string>) }
        : {};
    for (const [k, val] of Object.entries(patch.parameters as Record<string, unknown>)) {
      const key = k.trim();
      const s = val != null ? String(val).trim().slice(0, 500) : '';
      if (key && s) baseParams[key] = s;
    }
    if (Object.keys(baseParams).length > 0) {
      out.parameters = baseParams;
      touched.push('parameters');
    }
  }

  if (touched.length > 0) {
    out.knowledgeBotLast = {
      source: source.slice(0, 120),
      at: new Date().toISOString(),
      fields: [...new Set(touched)],
    };
  }

  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Użyj POST' }, 405);
  }

  const secret = Deno.env.get('KNOWLEDGE_BOT_SECRET')?.trim();
  if (!secret) {
    return json({ error: 'Brak KNOWLEDGE_BOT_SECRET po stronie serwera' }, 503);
  }

  const keyHeader = req.headers.get('X-Knowledge-Bot-Key')?.trim();
  const auth = req.headers.get('Authorization')?.trim();
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (keyHeader !== secret && bearer !== secret) {
    return json({ error: 'Nieprawidłowy klucz bota' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(supabaseUrl, serviceKey);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Niepoprawny JSON' }, 400);
  }

  const action = body.action === 'get' ? 'get' : 'patch';
  const sku = String(body.sku || '')
    .trim()
    .toUpperCase();
  if (!sku) {
    return json({ error: 'Wymagane pole sku' }, 400);
  }

  const { data: rows, error: findErr } = await db
    .from('products')
    .select(
      'id, sku, name, display_name, description, ean, has_image, image_url, custom_image_url, manufacturer, warehouse_location, variants, product_meta',
    )
    .eq('sku', sku)
    .limit(1);

  if (findErr) return json({ error: findErr.message }, 500);
  const row = rows?.[0] as ProductRow | undefined;
  if (!row) return json({ error: 'Nie znaleziono produktu o podanym SKU', sku }, 404);

  const meta =
    row.product_meta && typeof row.product_meta === 'object'
      ? { ...(row.product_meta as Record<string, unknown>) }
      : {};

  if (action === 'get') {
    return json({
      ok: true,
      sku: row.sku,
      id: row.id,
      displayName: row.display_name || row.name,
      descriptionPlain: stripHtml(row.description || '') || null,
      shortDescription: typeof meta.shortDescription === 'string' ? meta.shortDescription : null,
      parameters: meta.parameters ?? null,
      completenessScore: assessScore(row),
      knowledgeBotLast: meta.knowledgeBotLast ?? null,
    });
  }

  const patch =
    body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
      ? (body.patch as Record<string, unknown>)
      : {};
  const overwrite = body.overwrite === true;
  const source = String(body.source || 'external-bot').trim() || 'external-bot';
  const touched: string[] = [];

  const nextMeta = mergeMeta(meta, patch, overwrite, source, touched);

  const rowUpdate: Record<string, unknown> = { product_meta: nextMeta };

  if (typeof patch.description === 'string') {
    const desc = patch.description.trim().slice(0, 50000);
    const cur = stripHtml(row.description || '');
    if (desc && (overwrite || cur.length < 40)) {
      rowUpdate.description = desc;
      touched.push('description');
    }
  }

  if (touched.length === 0) {
    return json({
      ok: true,
      sku: row.sku,
      id: row.id,
      updated: false,
      message: 'Brak zmian (pola już uzupełnione — użyj overwrite: true)',
      completenessScore: assessScore({ ...row, product_meta: nextMeta }),
    });
  }

  const { error: updErr } = await db.from('products').update(rowUpdate).eq('id', row.id);
  if (updErr) return json({ error: updErr.message }, 500);

  const mergedRow = { ...row, ...rowUpdate, product_meta: nextMeta };

  return json({
    ok: true,
    sku: row.sku,
    id: row.id,
    updated: true,
    fields: [...new Set(touched)],
    completenessScore: assessScore(mergedRow),
    knowledgeBotLast: nextMeta.knowledgeBotLast ?? null,
  });
});
