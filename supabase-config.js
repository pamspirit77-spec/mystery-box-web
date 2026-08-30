// Supabase configuration for Mystery Box 3D
// For Render deployment, these placeholders are replaced at build time from:
// SUPABASE_URL and SUPABASE_ANON_KEY environment variables.
// IMPORTANT: Never put a Supabase secret/service_role key in browser code.

export const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_PROJECT_URL_HERE';
export const SUPABASE_ANON_KEY = 'PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE';

export const SUPABASE_ENABLED =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('PASTE_YOUR') &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes('PASTE_YOUR');
