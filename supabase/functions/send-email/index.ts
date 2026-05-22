import nodemailer from 'npm:nodemailer@6.9.13';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Auth: require valid Supabase JWT ────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.slice(7);
    const { data: { user: caller }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Caller must be active in profiles
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('active')
      .eq('id', caller.id)
      .single();
    if (!callerProfile?.active) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { recipients, subject, html, attachments } = await req.json() as {
      recipients: { name: string; email: string }[];
      subject: string;
      html: string;
      attachments?: { filename: string; content: string; cid: string }[];
    };

    // Basic input validation
    if (!Array.isArray(recipients) || recipients.length === 0 || recipients.length > 20) {
      return new Response(JSON.stringify({ error: 'Invalid recipients (max 20)' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (typeof subject !== 'string' || subject.length === 0 || subject.length > 200) {
      return new Response(JSON.stringify({ error: 'Invalid subject' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (typeof html !== 'string' || html.length === 0 || html.length > 500_000) {
      return new Response(JSON.stringify({ error: 'Invalid html payload' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const r of recipients) {
      if (!r || typeof r.email !== 'string' || !emailRegex.test(r.email)) {
        return new Response(JSON.stringify({ error: `Invalid recipient email: ${r?.email ?? ''}` }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    if (attachments !== undefined) {
      if (!Array.isArray(attachments) || attachments.length > 10) {
        return new Response(JSON.stringify({ error: 'Invalid attachments (max 10)' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      for (const a of attachments) {
        if (!a || typeof a.filename !== 'string' || typeof a.content !== 'string' || typeof a.cid !== 'string') {
          return new Response(JSON.stringify({ error: 'Invalid attachment shape' }), {
            status: 400,
            headers: { ...CORS, 'Content-Type': 'application/json' },
          });
        }
        if (a.content.length > 2_000_000) {
          return new Response(JSON.stringify({ error: 'Attachment too large (max ~1.5MB)' }), {
            status: 400,
            headers: { ...CORS, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const gmailUser = Deno.env.get('GMAIL_USER')!;
    const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')!;

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: gmailUser, pass: gmailPass },
    });

    const mailAttachments = (attachments ?? []).map((a) => ({
      filename: a.filename,
      content: a.content,
      encoding: 'base64' as const,
      cid: a.cid,
    }));

    for (const r of recipients) {
      await transporter.sendMail({
        from: `LogixZazu <${gmailUser}>`,
        to: r.email,
        subject,
        html,
        attachments: mailAttachments.length > 0 ? mailAttachments : undefined,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-email error:', err);
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
