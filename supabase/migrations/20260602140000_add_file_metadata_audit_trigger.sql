-- Append-only audit trail for file_metadata. Captures a full before-image
-- (old_row) of every UPDATE and DELETE, plus the after-image (new_row) for
-- updates, automatically and regardless of which code path makes the change.
-- This is the recovery mechanism that was missing when an approval-wipe bug
-- destroyed community metadata on 2026-06-02 (only 2 of 3 records were
-- recoverable, from a daily backup). With this in place, any future change to
-- file_metadata is recoverable from file_metadata_audit.old_row.
--
-- SAFEGUARD: do not drop this table or trigger. See CLAUDE.md "Data Safety".

CREATE TABLE IF NOT EXISTS public.file_metadata_audit (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audited_at  timestamptz NOT NULL DEFAULT now(),
  action      text NOT NULL,           -- 'UPDATE' | 'DELETE'
  file_path   text,
  slug        text,
  actor       uuid,                    -- auth.uid() when available (null for service-role writes)
  old_row     jsonb NOT NULL,          -- full row image BEFORE the change
  new_row     jsonb                    -- full row image AFTER the change (UPDATE only)
);

CREATE INDEX IF NOT EXISTS file_metadata_audit_file_path_idx ON public.file_metadata_audit (file_path);
CREATE INDEX IF NOT EXISTS file_metadata_audit_audited_at_idx ON public.file_metadata_audit (audited_at DESC);

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
    auth.uid(),
    to_jsonb(OLD),
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS file_metadata_audit_trg ON public.file_metadata;
CREATE TRIGGER file_metadata_audit_trg
  BEFORE UPDATE OR DELETE ON public.file_metadata
  FOR EACH ROW EXECUTE FUNCTION public.log_file_metadata_change();

-- Lock the audit table down: append-only (no client writes), admin-readable.
ALTER TABLE public.file_metadata_audit ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.file_metadata_audit FROM anon, authenticated;

DROP POLICY IF EXISTS "Admins can read file_metadata_audit" ON public.file_metadata_audit;
CREATE POLICY "Admins can read file_metadata_audit"
  ON public.file_metadata_audit
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users
                 WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true));
