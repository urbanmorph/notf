-- Defense-in-depth: deletion of community/provider data must go ONLY through the
-- admin-gated, audited delete-file Edge Function (service role). No client role
-- should be able to DELETE directly, even if a permissive RLS policy is ever
-- added by mistake. INSERT stays granted (the public join form inserts pending
-- records via the anon client) and UPDATE remains RLS-gated to admins.
--
-- SAFEGUARD: do not re-grant DELETE on file_metadata to anon/authenticated.
-- See CLAUDE.md "Data Safety".

REVOKE DELETE ON public.file_metadata FROM anon, authenticated;
