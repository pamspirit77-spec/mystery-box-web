# Render Static Site settings

Repository: mystery-box-web
Branch: main
Root Directory: leave empty
Build Command:

printf "export const SUPABASE_URL = '%s';\nexport const SUPABASE_ANON_KEY = '%s';\nexport const SUPABASE_ENABLED = true;\n" "$SUPABASE_URL" "$SUPABASE_ANON_KEY" > supabase-config.js

Publish Directory: .

Environment Variables:
SUPABASE_URL = your Supabase Project URL
SUPABASE_ANON_KEY = your Supabase Publishable key

Never put a Supabase Secret/Service Role key in the browser or GitHub.
