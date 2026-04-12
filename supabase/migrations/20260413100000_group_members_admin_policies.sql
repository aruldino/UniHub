-- WhatsApp-style group management: admins add/remove members and change roles;
-- creators can bootstrap their first membership row; members can leave.

CREATE OR REPLACE FUNCTION public.su_is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.su_check_group_member(_group_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.su_check_group_admin(_group_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = auth.uid() AND role = 'admin'
  );
END;
$$;

DROP POLICY IF EXISTS "gm_final" ON public.group_members;
DROP POLICY IF EXISTS "gm_select" ON public.group_members;
DROP POLICY IF EXISTS "gm_insert" ON public.group_members;
DROP POLICY IF EXISTS "gm_delete" ON public.group_members;
DROP POLICY IF EXISTS "gm_update" ON public.group_members;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_select" ON public.group_members FOR SELECT TO authenticated
USING (public.su_check_group_member(group_id) OR public.su_is_admin());

-- Creator adds self to a new group, or group admin adds any user, or app admin
CREATE POLICY "gm_insert" ON public.group_members FOR INSERT TO authenticated
WITH CHECK (
  public.su_is_admin()
  OR (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  )
  OR public.su_check_group_admin(group_id)
);

CREATE POLICY "gm_update" ON public.group_members FOR UPDATE TO authenticated
USING (public.su_check_group_admin(group_id) OR public.su_is_admin())
WITH CHECK (public.su_check_group_admin(group_id) OR public.su_is_admin());

CREATE POLICY "gm_delete" ON public.group_members FOR DELETE TO authenticated
USING (
  public.su_is_admin()
  OR user_id = auth.uid()
  OR public.su_check_group_admin(group_id)
);
