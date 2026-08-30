// Supabase configuration for Mystery Box 3D
// 1) Open Supabase -> Project Settings -> API
// 2) Copy Project URL and the Publishable/anon key here.
// IMPORTANT: Never put the service_role/secret key in this file or in browser code.

export const SUPABASE_URL = 'PASTE_YOUR_SUPABASE_PROJECT_URL_HERE';
export const SUPABASE_ANON_KEY = 'PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE';

export const SUPABASE_ENABLED =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('PASTE_YOUR') &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes('PASTE_YOUR');
