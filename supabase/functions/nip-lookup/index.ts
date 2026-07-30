import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeNip(raw: string): string {
  return raw.replace(/\D/g, '');
}

function isValidNip(nip: string): boolean {
  if (!/^\d{10}$/.test(nip)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(nip[i]), 0);
  return sum % 11 === Number(nip[9]);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Brak Authorization' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Nieautoryzowany' }, 401);

    const body = await req.json().catch(() => ({}));
    const nip = normalizeNip(String(body.nip || ''));
    if (!isValidNip(nip)) {
      return json({ error: 'Nieprawidłowy NIP' }, 400);
    }

    const date = todayIsoDate();
    const mfUrl = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${date}`;
    const mfRes = await fetch(mfUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!mfRes.ok) {
      return json(
        { error: `MF HTTP ${mfRes.status}` },
        mfRes.status === 404 ? 404 : 502,
      );
    }

    const mfJson = await mfRes.json();
    const subject = mfJson?.result?.subject;
    if (!subject) {
      return json({ error: 'Nie znaleziono firmy o tym NIP' }, 404);
    }

    const legalName = String(subject.name || '').trim();
    const working = String(subject.workingAddress || '').trim();
    const residence = String(subject.residenceAddress || '').trim();
    const address = working || residence || '';

    return json({
      nip: String(subject.nip || nip),
      legalName,
      address,
      statusVat: subject.statusVat || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd serwera';
    return json({ error: message }, 500);
  }
});
