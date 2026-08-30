-- Mystery Box 3D
-- SAFE FIX for the EXISTING authenticated topup_requests schema.
-- Based on the current table columns:
-- id bigint, user_id uuid, method text, amount numeric, wallet_link text,
-- card_code text, proof_image text, status text, admin_id uuid,
-- admin_note text, created_at timestamptz, reviewed_at timestamptz.
--
-- This migration does NOT drop tables, delete rows, or touch game systems.

-- 1) Ensure optional proof field exists. Existing proof_image is preserved.
alter table public.topup_requests
  add column if not exists proof_image text;

-- 2) Remove only CHECK constraints on topup_requests that conflict with
--    optional proof images / wallet-or-card submission.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.conrelid='public.topup_requests'::regclass
      AND c.contype='c'
      AND (
        pg_get_constraintdef(c.oid) ILIKE '%proof_image%'
        OR pg_get_constraintdef(c.oid) ILIKE '%proof_path%'
        OR pg_get_constraintdef(c.oid) ILIKE '%card_code%'
        OR pg_get_constraintdef(c.oid) ILIKE '%wallet_link%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.topup_requests DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- 3) Payment validation. Proof image is optional.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.topup_requests'::regclass
      AND conname='topup_requests_payment_check_v2'
  ) THEN
    ALTER TABLE public.topup_requests
    ADD CONSTRAINT topup_requests_payment_check_v2 CHECK (
      amount >= 10
      AND (
        (method='wallet'
          AND wallet_link IS NOT NULL
          AND wallet_link ~* '^https?://'
          AND card_code IS NULL)
        OR
        (method='card'
          AND card_code IS NOT NULL
          AND card_code ~ '^[0-9]{14}$'
          AND wallet_link IS NULL)
      )
    );
  END IF;
END $$;

-- 4) Admin check. Keep the existing admin_users table.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users a
    WHERE a.user_id=auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 5) RLS for player submissions and own history.
ALTER TABLE public.topup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topup_insert_own" ON public.topup_requests;
CREATE POLICY "topup_insert_own"
ON public.topup_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid()=user_id);

DROP POLICY IF EXISTS "topup_select_own" ON public.topup_requests;
CREATE POLICY "topup_select_own"
ON public.topup_requests
FOR SELECT TO authenticated
USING (auth.uid()=user_id OR public.is_admin());

-- 6) IMPORTANT: admin_list_topups already exists with the WRONG return type
-- in the previous migration. PostgreSQL requires DROP before changing it.
DROP FUNCTION IF EXISTS public.admin_list_topups();

CREATE FUNCTION public.admin_list_topups()
RETURNS TABLE (
  id bigint,
  user_id uuid,
  username text,
  method text,
  amount integer,
  wallet_link text,
  card_code text,
  proof_image text,
  status text,
  admin_id uuid,
  admin_note text,
  created_at timestamptz,
  reviewed_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    COALESCE(p.username,'ผู้เล่น')::text,
    t.method,
    t.amount::integer,
    t.wallet_link,
    t.card_code,
    t.proof_image,
    t.status,
    t.admin_id,
    t.admin_note,
    t.created_at,
    t.reviewed_at
  FROM public.topup_requests t
  LEFT JOIN public.profiles p ON p.id=t.user_id
  ORDER BY t.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_topups() TO authenticated;

-- 7) Same: recreate approval function with bigint ID and admin_id column.
DROP FUNCTION IF EXISTS public.admin_review_topup(uuid, boolean);
DROP FUNCTION IF EXISTS public.admin_review_topup(bigint, boolean);

CREATE FUNCTION public.admin_review_topup(
  p_topup_id bigint,
  p_approve boolean
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_amount bigint;
  v_user_id uuid;
  v_status text;
  v_new_balance bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT amount::bigint, user_id, status
  INTO v_amount, v_user_id, v_status
  FROM public.topup_requests
  WHERE id=p_topup_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'topup_not_found';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'already_reviewed';
  END IF;

  IF p_approve THEN
    UPDATE public.profiles
    SET coins=coins+v_amount, updated_at=now()
    WHERE id=v_user_id
    RETURNING coins INTO v_new_balance;

    IF v_new_balance IS NULL THEN
      RAISE EXCEPTION 'profile_not_found';
    END IF;

    UPDATE public.topup_requests
    SET status='approved',
        admin_id=auth.uid(),
        reviewed_at=now()
    WHERE id=p_topup_id;
  ELSE
    UPDATE public.topup_requests
    SET status='rejected',
        admin_id=auth.uid(),
        reviewed_at=now()
    WHERE id=p_topup_id;

    SELECT coins INTO v_new_balance
    FROM public.profiles WHERE id=v_user_id;
  END IF;

  RETURN COALESCE(v_new_balance,0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_topup(bigint, boolean) TO authenticated;

-- 8) Refresh PostgREST.
NOTIFY pgrst,'reload schema';
