// Supabase configuration for Mystery Box 3D
// For Render deployment, these placeholders are replaced at build time from:
// SUPABASE_URL and SUPABASE_ANON_KEY environment variables.
// IMPORTANT: Never put a Supabase secret/service_role key in browser code.

export const SUPABASE_URL = 'https://bcuxkbkxppsjnagdruje.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_XMY8CrLj56JogslXpGhjQQ_6IHKb0pZ';

export const SUPABASE_ENABLED =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('PASTE_YOUR') &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes('PASTE_YOUR');
