-- admin_users was readable by everyone, signed in or not (policy admin_users_read:
-- USING (true) for PUBLIC), so the public anon key in the website's source could
-- list every admin's name, email, role and phone.
--
-- Now a signed-in user reads only their own row, and active super admins read
-- all rows. Every other policy in this project that consults admin_users looks
-- up the caller's own row (user_id = auth.uid()), so they keep working, as does
-- the NOTF admin's membership check (auth.js isActiveAdmin).

-- Super admins may list all admins. A SECURITY DEFINER function reads the table
-- without going through its policies, so the policy below does not recurse.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

DROP POLICY IF EXISTS admin_users_read ON public.admin_users;

DROP POLICY IF EXISTS "Admins read their own row" ON public.admin_users;
CREATE POLICY "Admins read their own row" ON public.admin_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Super admins read all admin rows" ON public.admin_users;
CREATE POLICY "Super admins read all admin rows" ON public.admin_users
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Visitors who are not signed in have no business with this table at all.
REVOKE ALL ON public.admin_users FROM anon;
