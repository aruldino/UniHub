-- Social Hub: allow directory-style profile reads for active users, and a reliable
-- SECURITY DEFINER RPC to add group members (avoids RLS edge cases on INSERT).

-- 1) Peers visible for UniHub Social (name / email / avatar for active accounts)
DROP POLICY IF EXISTS "p_select_directory_peers" ON public.profiles;
CREATE POLICY "p_select_directory_peers" ON public.profiles
FOR SELECT TO authenticated
USING (COALESCE(is_active, true) AND deleted_at IS NULL);

-- 2) Add member — only app admins or group admins (membership checked with RLS bypass)
CREATE OR REPLACE FUNCTION public.add_group_member(p_group_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = caller AND role = 'admin') THEN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (p_group_id, p_user_id, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = caller AND role = 'admin'
  ) THEN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (p_group_id, p_user_id, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;
    RETURN;
  END IF;

  RAISE EXCEPTION 'You do not have permission to add members to this group';
END;
$$;

REVOKE ALL ON FUNCTION public.add_group_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_group_member(uuid, uuid) TO authenticated;
