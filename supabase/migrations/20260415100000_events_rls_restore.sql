-- Restore RLS policies on public.events after is_admin() CASCADE drops (20260225320000).
-- Without these, RLS stays ON but no policies allow INSERT → 403 / "violates row-level security".

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Events_Global_Visibility" ON public.events;
DROP POLICY IF EXISTS "Events_Admin_Management" ON public.events;
DROP POLICY IF EXISTS "Anyone can view published events" ON public.events;
DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
DROP POLICY IF EXISTS "Users view events" ON public.events;
DROP POLICY IF EXISTS "Admin manage events" ON public.events;

-- Published events readable by everyone using the API (anon + authenticated).
CREATE POLICY "events_select_anon_published" ON public.events
  FOR SELECT TO anon
  USING (COALESCE(is_published, true));

CREATE POLICY "events_select_auth_published_or_admin" ON public.events
  FOR SELECT TO authenticated
  USING (COALESCE(is_published, true) OR public.su_is_admin());

-- Only admins may create / change / remove events (su_is_admin matches other admin gates).
CREATE POLICY "events_insert_admin" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (public.su_is_admin());

CREATE POLICY "events_update_admin" ON public.events
  FOR UPDATE TO authenticated
  USING (public.su_is_admin())
  WITH CHECK (public.su_is_admin());

CREATE POLICY "events_delete_admin" ON public.events
  FOR DELETE TO authenticated
  USING (public.su_is_admin());
