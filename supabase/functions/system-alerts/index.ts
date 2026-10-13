import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

/**
 * Silnik alertow systemowych (Logi -> Status systemow).
 *
 * POST { action: 'check' } — ocenia stan systemu, tworzy / aktualizuje / zamyka alerty w tabeli
 * system_alerts i (opcjonalnie) wysyla powiadomienia na Discord. Wywolywany:
 *  - przez aplikacje (zalogowany uzytkownik, co kilka minut, gdy ktos ma otwarty katalog),
 *  - opcjonalnie przez pg_cron (klucz service_role) — wtedy dziala takze, gdy nikt nie jest w aplikacji.
 *
 * Sekret (opcjonalny): DISCORD_ALERTS_WEBHOOK — adres webhooka kanalu Discord na alerty.
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

const DISCORD_WEBHOOK = Deno.env.get('DISCORD_ALERTS_WEBHOOK') ?? '';

/** Po ilu minutach bez sygnalu agent jest uznany za nieczynny (alarm) / podejrzany (ostrzezenie). */
const AGENT_DOWN_MIN = 30;
const AGENT_WARN_MIN = 10;
const AGENT_LABEL: Record<string, string> = {
  stock: 'synchronizacji stanów i cen',
  orders: 'zamówień, rezerwacji i promocji',
};

interface Condition {
  key: string;
  level: 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

async function discord(text: string): Promise<boolean> {
  if (!DISCORD_WEBHOOK) return false;
  try {
    const res = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text.slice(0, 1900) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// deno-lint-ignore no-explicit-any
type Admin = any;

async function evaluate(admin: Admin): Promise<Condition[]> {
  const out: Condition[] = [];
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60_000).toISOString();

  // 1) agenci milcza
  const { data: beats } = await admin.from('agent_heartbeats').select('*');
  for (const b of (beats ?? []) as Record<string, unknown>[]) {
    const agent = String(b.agent);
    if (!(agent in AGENT_LABEL)) continue;
    const last = b.last_run_at ? new Date(String(b.last_run_at)).getTime() : 0;
    if (!last) continue;
    const age = Math.round((now - last) / 60_000);
    const when = new Date(last).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
    if (age >= AGENT_DOWN_MIN) {
      out.push({
        key: `agent-${agent}-down`,
        level: 'error',
        title: `Agent ${AGENT_LABEL[agent]} nie daje znaku od ${age} min`,
        message: `Ostatni sygnał: ${when}. Sprawdź serwer WAPRO (czy działa, czy konto jest zalogowane) i zadanie w Harmonogramie zadań.`,
      });
    } else if (age >= AGENT_WARN_MIN) {
      out.push({
        key: `agent-${agent}-warn`,
        level: 'warning',
        title: `Agent ${AGENT_LABEL[agent]} milczy od ${age} min`,
        message: `Ostatni sygnał: ${when}.`,
      });
    }
  }

  // 2) bledy zgloszone przez agentow w ostatniej godzinie
  const { data: errs } = await admin
    .from('system_events')
    .select('source,message,created_at')
    .eq('level', 'error')
    .gte('created_at', hourAgo)
    .order('created_at', { ascending: false })
    .limit(200);
  const bySource = new Map<string, { n: number; msg: string }>();
  for (const e of (errs ?? []) as Record<string, unknown>[]) {
    const s = String(e.source);
    const cur = bySource.get(s);
    if (cur) cur.n++;
    else bySource.set(s, { n: 1, msg: String(e.message ?? '') });
  }
  const SRC: Record<string, string> = {
    stock: 'synchronizacji stanów i cen',
    sales: 'synchronizacji sprzedaży',
    orders: 'zamówień do WAPRO',
    reserved: 'odczytu rezerwacji',
    promotions: 'promocji',
    system: 'systemu',
  };
  for (const [s, v] of bySource) {
    out.push({
      key: `error-${s}`,
      level: 'error',
      title: `Błąd ${SRC[s] ?? s} (${v.n}× w ostatniej godzinie)`,
      message: v.msg.slice(0, 400),
    });
  }

  // 3) bledy wysylki do BaseLinkera
  const { data: bl } = await admin
    .from('baselinker_sync_log')
    .select('field,note,created_at')
    .eq('status', 'error')
    .gte('created_at', hourAgo)
    .order('created_at', { ascending: false })
    .limit(20);
  if ((bl ?? []).length) {
    out.push({
      key: 'error-baselinker',
      level: 'error',
      title: `Błąd wysyłki do BaseLinkera (${bl.length}× w ostatniej godzinie)`,
      message: String((bl[0] as Record<string, unknown>).note ?? '').slice(0, 400),
    });
  }

  // 4) zamowienia CRM -> WAPRO
  const stuckBefore = new Date(now - 15 * 60_000).toISOString();
  const { data: stuck } = await admin
    .from('wapro_order_requests')
    .select('id')
    .in('status', ['pending', 'running'])
    .lte('requested_at', stuckBefore)
    .limit(50);
  if ((stuck ?? []).length) {
    out.push({
      key: 'orders-stuck',
      level: 'error',
      title: `${stuck.length} zamówień CRM czeka na WAPRO dłużej niż 15 min`,
      message: 'Agent zamówień nie podejmuje zleceń. Sprawdź serwer WAPRO i zadanie „Kenochem-WaproOrders”.',
    });
  }
  const sixHours = new Date(now - 6 * 60 * 60_000).toISOString();
  const { data: oerr } = await admin
    .from('wapro_order_requests')
    .select('message,requested_at')
    .eq('status', 'error')
    .gte('requested_at', sixHours)
    .order('requested_at', { ascending: false })
    .limit(20);
  if ((oerr ?? []).length) {
    out.push({
      key: 'orders-error',
      level: 'warning',
      title: `Zamówienie do WAPRO zakończone błędem (${oerr.length}× w 6 h)`,
      message: String((oerr[0] as Record<string, unknown>).message ?? '').slice(0, 400),
    });
  }

  // 5) promocje: blad lub koniec wkrotce
  const { data: pc } = await admin
    .from('promo_campaigns')
    .select('id,name,status,ends_at,last_error')
    .in('status', ['scheduled', 'active']);
  for (const c of (pc ?? []) as Record<string, unknown>[]) {
    if (String(c.last_error ?? '').trim()) {
      out.push({
        key: `promo-error-${c.id}`,
        level: 'error',
        title: `Promocja „${c.name}” — błąd`,
        message: String(c.last_error).slice(0, 400),
      });
    }
    if (c.status === 'active' && c.ends_at) {
      const left = new Date(String(c.ends_at)).getTime() - now;
      if (left > 0 && left <= 24 * 60 * 60_000) {
        out.push({
          key: `promo-ending-${c.id}`,
          level: 'info',
          title: `Promocja „${c.name}” kończy się w ciągu 24 h`,
          message: `Koniec: ${new Date(String(c.ends_at)).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}. Po końcu ceny wrócą do zwykłych.`,
        });
      }
    }
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
    const bearer = authHeader.replace(/^Bearer\s+/i, '');
    const isSystem = bearer === serviceKey;
    const admin = createClient(supabaseUrl, serviceKey);

    if (!isSystem) {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const {
        data: { user },
        error,
      } = await userClient.auth.getUser();
      if (error || !user) return json({ error: 'Nieautoryzowany' }, 401);
    }

    // ochrona przed zalewem wywolan: jedno sprawdzenie na ~90 s
    const { data: guard } = await admin.from('agent_heartbeats').select('last_run_at').eq('agent', 'alerts').maybeSingle();
    if (guard?.last_run_at && Date.now() - new Date(String(guard.last_run_at)).getTime() < 90_000 && !isSystem) {
      return json({ skipped: true, reason: 'sprawdzono przed chwilą' });
    }
    const nowIso = new Date().toISOString();
    await admin
      .from('agent_heartbeats')
      .upsert({ agent: 'alerts', last_run_at: nowIso, updated_at: nowIso, last_status: 'ok', message: '' }, { onConflict: 'agent' });

    const conditions = await evaluate(admin);
    const byKey = new Map(conditions.map((c) => [c.key, c]));

    const { data: openRows } = await admin.from('system_alerts').select('*').is('resolved_at', null);
    const open = new Map<string, Record<string, unknown>>();
    for (const r of (openRows ?? []) as Record<string, unknown>[]) open.set(String(r.key), r);

    let created = 0;
    let resolved = 0;
    for (const c of conditions) {
      const row = open.get(c.key);
      if (row) {
        await admin
          .from('system_alerts')
          .update({ level: c.level, title: c.title, message: c.message, last_seen: nowIso })
          .eq('id', row.id);
      } else {
        const { data: ins } = await admin
          .from('system_alerts')
          .insert({ key: c.key, level: c.level, title: c.title, message: c.message })
          .select('id')
          .single();
        created++;
        if (c.level === 'error' && ins?.id) {
          const ok = await discord(`🔴 **${c.title}**\n${c.message}`);
          if (ok) await admin.from('system_alerts').update({ notified_at: nowIso }).eq('id', ins.id);
        }
      }
    }
    for (const [key, row] of open) {
      if (byKey.has(key)) continue;
      await admin.from('system_alerts').update({ resolved_at: nowIso }).eq('id', row.id);
      resolved++;
      if (row.notified_at) await discord(`✅ Wróciło do normy: **${row.title}**`);
    }

    // porzadki: stare zdarzenia i historia dostepnosci
    if (Math.random() < 0.05) {
      await admin.from('system_events').delete().lt('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString());
      await admin.from('agent_uptime').delete().lt('bucket', new Date(Date.now() - 35 * 86_400_000).toISOString());
      await admin.from('system_alerts').delete().lt('last_seen', new Date(Date.now() - 90 * 86_400_000).toISOString()).not('resolved_at', 'is', null);
    }

    return json({ ok: true, active: conditions.length, created, resolved, discord: Boolean(DISCORD_WEBHOOK) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
