import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { userId, password, email, username, role, active } = await req.json() as {
      userId: string;
      password?: string;
      email?: string;
      username?: string;
      role?: string;
      active?: boolean;
    };

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Update Supabase Auth (password and/or email)
    const authUpdates: { password?: string; email?: string } = {};
    if (password) authUpdates.password = password;
    if (email) authUpdates.email = email;

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
      if (authError) throw authError;
    }

    // Update profiles table (bypasses RLS using service role)
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
