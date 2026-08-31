# V24 — Admin login restore

This version is based on V22 and does not include the V23 image/data-URL changes.
The admin authentication flow is restored and only adds a compatibility fallback:
if `is_admin()` RPC fails, the page checks the signed-in user's row in `public.admin_users`.
No new SQL is required for the login fix.

The box-settings save code from V22 is retained. This release does not change top-up,
reward claims, player inventory, player authentication, or other game systems.
