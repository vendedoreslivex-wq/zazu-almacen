import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Edge Functions base URL. Falls back to `${VITE_SUPABASE_URL}/functions/v1`
 *  if VITE_SUPABASE_FUNCTIONS_URL is not set (e.g. forgotten in Vercel). */
export const FUNCTIONS_URL: string =
  (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined) ||
  (SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1` : '');
