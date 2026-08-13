import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const MAX_BYTES = 15 * 1024 * 1024;

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) {
    return true;
  }
  if (h === '127.0.0.1' || h.startsWith('127.')) return true;
  if (h === '::1' || h === '[::1]') return true;
  if (h.includes(':')) return false;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Brak Authorization', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response('Nieautoryzowany', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = await req.json().catch(() => ({}));
    const url = String(body.url || '').trim();
    if (!url) {
      return new Response('Brak url', { status: 400, headers: corsHeaders });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response('Nieprawidłowy url', {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (parsed.protocol !== 'https:') {
      return new Response('Dozwolone tylko HTTPS', {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (isPrivateOrLocalHost(parsed.hostname)) {
      return new Response('Zabroniony host', {
        status: 403,
        headers: corsHeaders,
      });
    }

    const upstream = await fetch(url, {
      redirect: 'follow',
      headers: { Accept: 'image/*,*/*;q=0.8' },
    });

    if (!upstream.ok) {
      return new Response(`Źródło HTTP ${upstream.status}`, {
        status: 502,
        headers: corsHeaders,
      });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      return new Response('Odpowiedź nie jest obrazem', {
        status: 415,
        headers: corsHeaders,
      });
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return new Response('Obraz za duży', {
        status: 413,
        headers: corsHeaders,
      });
    }

    return new Response(buf, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (e) {
    console.error('image-proxy', e);
    return new Response('Błąd proxy', {
      status: 500,
      headers: corsHeaders,
    });
  }
});
