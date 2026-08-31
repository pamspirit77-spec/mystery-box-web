# V26 — Box Settings Save Fix

This version is based on the V24 build because V24 is the known working admin-login baseline.

Only the box/reward settings save path was changed:
- Uses the existing `admin_save_box_settings` RPC name.
- The RPC checks `admin_users` directly and does not depend on `is_admin()`.
- Drop rates may be changed without requiring the total to equal exactly 100%; the game uses weighted probabilities.
- Reward add/remove/name/rarity/drop-rate/image fields are saved.
- Reward images continue to use the existing `box-reward-images` Storage bucket, with policies checking `admin_users` directly.
- After saving all five boxes, the page reads the values back from `box_settings`; only then does it reload.
- Admin login code is restored exactly from V24.

Run `BOX_SETTINGS_SAVE_V26.sql` once in Supabase SQL Editor, then deploy this ZIP.
