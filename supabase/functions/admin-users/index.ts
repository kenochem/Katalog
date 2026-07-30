import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type AccountRole = 'admin' | 'operator' | 'magazynier' | 'handlowiec';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isRole(v: unknown): v is AccountRole {
  return (
    v === 'admin' ||
    v === 'operator' ||
    v === 'magazynier' ||
    v === 'handlowiec'
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Brak Authorization' }, 401);

    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return json({ error: 'Brak tokenu' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser(jwt);
    if (userErr || !user) return json({ error: 'Nieautoryzowany' }, 401);

    const { data: caller, error: profileErr } = await admin
      .from('profiles')
      .select('id, role, active')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr || !caller || caller.role !== 'admin' || !caller.active) {
      return json({ error: 'Tylko aktywny admin' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === 'list') {
      const { data, error } = await admin
        .from('profiles')
        .select('id, email, display_name, role, active, created_at')
        .order('created_at', { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ users: data });
    }

    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const display_name = String(body.display_name || '').trim() || email.split('@')[0];
      const role = body.role;
      if (!email || password.length < 8) {
        return json({ error: 'Email i hasło (min. 8) wymagane' }, 400);
      }
      if (!isRole(role)) return json({ error: 'Nieprawidłowa rola' }, 400);

      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name, role },
        });
      if (createErr) return json({ error: createErr.message }, 400);

      // Trigger tworzy profil; upewnij się o roli/nazwie
      if (created.user) {
        await admin.from('profiles').upsert({
          id: created.user.id,
          email,
          display_name,
          role,
          active: true,
        });
      }
      return json({ user: created.user });
    }

    if (action === 'update') {
      const id = String(body.id || '');
      if (!id) return json({ error: 'Brak id' }, 400);
      const patch: Record<string, unknown> = {};
      if (isRole(body.role)) patch.role = body.role;
      if (typeof body.active === 'boolean') patch.active = body.active;
      if (typeof body.display_name === 'string' && body.display_name.trim()) {
        patch.display_name = body.display_name.trim();
      }
      if (!Object.keys(patch).length) {
        return json({ error: 'Brak pól do aktualizacji' }, 400);
      }
      const { data, error } = await admin
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select('id, email, display_name, role, active')
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ user: data });
    }

    if (action === 'resetPassword') {
      const id = String(body.id || '');
      const password = String(body.password || '');
      if (!id || password.length < 8) {
        return json({ error: 'id + nowe hasło (min. 8)' }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Nieznana akcja' }, 400);
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Błąd serwera' },
      500,
    );
  }
});
