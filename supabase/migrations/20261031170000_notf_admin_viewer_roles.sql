-- NOTF admin access: admin (read + write + invite) and viewer (read only).
--
-- admin_users is shared with the notf-cms city app, whose `role` column
-- (super_admin, commissioner, ...) describes a city corporation's hierarchy. NOTF
-- access is decided separately by the new `notf_role` column:
--   'admin'  : read and change NOTF records, invite admins and viewers
--   'viewer' : read NOTF records in the admin
--   NULL     : no NOTF access (e.g. city-app-only accounts)
-- Super admins (role = 'super_admin') are added only with
-- scripts/add-super-admin.sh and cannot be changed from the admin panel.
--
-- Also: admins can no longer edit their own role/active flag (self-promotion),
-- the audit trail records which admin made a change, and the dormant notf-cms
-- complaint/discussion tables stop accepting anonymous inserts.

-- 1. The NOTF role, with today's NOTF super admins as NOTF admins.
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS notf_role text
  CHECK (notf_role IN ('admin', 'viewer'));
UPDATE public.admin_users SET notf_role = 'admin'
  WHERE role = 'super_admin' AND notf_role IS NULL;

-- The caller's NOTF role, if their admin_users row is active. SECURITY DEFINER so
-- policies can use it without reading admin_users through its own policies.
CREATE OR REPLACE FUNCTION public.notf_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT notf_role FROM public.admin_users
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.notf_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notf_role() TO authenticated;

-- 2. NOTF records: admins write; admins and viewers read everything (pending
-- included). Visitors keep reading active records and submitting pending ones.
DROP POLICY IF EXISTS "Admin users can manage files" ON public.file_metadata;
CREATE POLICY "NOTF admins can manage files" ON public.file_metadata
  FOR ALL TO authenticated
  USING (public.notf_role() = 'admin')
  WITH CHECK (public.notf_role() = 'admin');

-- Was USING (true): any signed-in account, admin or not, could read pending
-- submissions and their contact details.
DROP POLICY IF EXISTS "Authenticated users read all files" ON public.file_metadata;
CREATE POLICY "NOTF admins and viewers read all files" ON public.file_metadata
  FOR SELECT TO authenticated
  USING (public.notf_role() IN ('admin', 'viewer'));

-- Audit trail and deployment log: NOTF admins.
DROP POLICY IF EXISTS "Admins can read file_metadata_audit" ON public.file_metadata_audit;
CREATE POLICY "Admins can read file_metadata_audit" ON public.file_metadata_audit
  FOR SELECT TO authenticated
  USING (public.notf_role() = 'admin');

DROP POLICY IF EXISTS "Admin users insert deployment logs" ON public.deployment_log;
CREATE POLICY "Admin users insert deployment logs" ON public.deployment_log
  FOR INSERT TO authenticated
  WITH CHECK (public.notf_role() = 'admin');

-- Chatbot search log: NOTF admins and viewers.
DROP POLICY IF EXISTS "Admins can read searches" ON public.chat_searches;
CREATE POLICY "Admins can read searches" ON public.chat_searches
  FOR SELECT TO authenticated
  USING (public.notf_role() IN ('admin', 'viewer'));

-- 3. No self-promotion: people may edit their own name and phone only.
-- Roles and the active flag change through the manage-admins Edge Function.
DROP POLICY IF EXISTS admin_users_update_own ON public.admin_users;
REVOKE UPDATE ON public.admin_users FROM authenticated;
GRANT UPDATE (name, phone) ON public.admin_users TO authenticated;
CREATE POLICY "Admins update their own name and phone" ON public.admin_users
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Audit actor: Edge Functions write with the service role (auth.uid() is
-- null there) and set file_metadata.updated_by to the signed-in admin, so fall
-- back to it. delete-file stamps updated_by just before deleting.
CREATE OR REPLACE FUNCTION public.log_file_metadata_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.file_metadata_audit (action, file_path, slug, actor, old_row, new_row)
  VALUES (
    TG_OP,
    OLD.file_path,
    OLD.slug,
    COALESCE(auth.uid(), CASE WHEN TG_OP = 'UPDATE' THEN NEW.updated_by ELSE OLD.updated_by END),
    to_jsonb(OLD),
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- 5. notf-cms is not in use: stop anonymous inserts into its public tables.
-- Existing rows stay. To reopen, recreate these policies (definitions below).
--   complaints            "public_insert_complaints"  WITH CHECK (corporation_id IS NOT NULL)
--   complaint_attachments "Allow public insert on complaint_attachments"
--                         WITH CHECK (EXISTS (SELECT 1 FROM complaints c WHERE c.id = complaint_id))
--   discussion_comments   "insert_comments"           WITH CHECK (true)
--   discussion_likes      "insert_likes"              WITH CHECK (true)
DROP POLICY IF EXISTS public_insert_complaints ON public.complaints;
DROP POLICY IF EXISTS "Allow public insert on complaint_attachments" ON public.complaint_attachments;
DROP POLICY IF EXISTS insert_comments ON public.discussion_comments;
DROP POLICY IF EXISTS insert_likes ON public.discussion_likes;
