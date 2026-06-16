import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify caller is ADMIN_GENERAL
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.slice(7);
    const { data: { user: caller }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (callerProfile?.role !== 'ADMIN_GENERAL') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as {
      action?: 'create' | 'update' | 'delete';
      userId?: string;
      password?: string;
      email?: string;
      username?: string;
      role?: string;
      active?: boolean;
      emailPersonal?: string;
    };

    const action = body.action ?? 'update';

    // ── CREATE ─────────────────────────────────────────────────────────────
    if (action === 'create') {
      const { email, password, username, role, active = true, emailPersonal } = body;
      if (!email || !password || !username || !role) {
        return new Response(JSON.stringify({ error: 'Missing required fields (email, password, username, role)' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, role, email_personal: emailPersonal },
      });
      if (createErr) throw createErr;

      // The on_auth_user_created trigger inserts into profiles. Ensure values are correct.
      if (created.user) {
        await supabaseAdmin
          .from('profiles')
          .update({ username, role, active, email, email_personal: emailPersonal ?? null })
          .eq('id', created.user.id);
      }

      return new Response(JSON.stringify({ ok: true, userId: created.user?.id }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── DELETE ─────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const { userId } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId is required for delete' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteErr) throw deleteErr;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── UPDATE ─────────────────────────────────────────────────────────────
    const { userId, password, email, username, role, active } = body;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required for update' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const authUpdates: { password?: string; email?: string } = {};
    if (password) authUpdates.password = password;
    if (email) authUpdates.email = email;

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
      if (authError) throw authError;
    }

    const profileUpdates: Record<string, unknown> = {};
    if (username !== undefined) profileUpdates.username = username;
    if (role !== undefined) profileUpdates.role = role;
    if (active !== undefined) profileUpdates.active = active;
    if (email !== undefined) profileUpdates.email = email;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);
      if (profileError) throw profileError;
    }

    // If the user is being deactivated, revoke every active session so
    // they can't keep using the app until their JWT expires.
    if (active === false) {
      await supabaseAdmin.auth.admin.signOut(userId, 'global').catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('update-user-auth error:', err);
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
