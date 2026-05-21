import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { recipients, subject, html } = await req.json() as {
      recipients: { name: string; email: string }[];
      subject: string;
      html: string;
    };

    const gmailUser = Deno.env.get('GMAIL_USER')!;
    const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')!;

    const client = new SmtpClient();
    await client.connectTLS({ hostname: 'smtp.gmail.com', port: 465, username: gmailUser, password: gmailPass });

    for (const r of recipients) {
      await client.send({
        from: `LogixZazu <${gmailUser}>`,
        to: r.email,
        subject,
        content: 'Ver versión HTML.',
        html,
      });
    }

    await client.close();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
