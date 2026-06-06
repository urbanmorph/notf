// Shared admin authorization for the data-writing Edge Functions.
//
// Background: the admin UI authorizes via the `admin_users` table (the real
// admin registry, also used by the file_metadata RLS policies and the audit
// table). The Edge Functions historically required `user_metadata.role ===
// 'admin'` — a value that is NOT in the admin_role enum and was never set on
// any account, so every admin write returned 403. This unifies the two: an
// active row in `admin_users` is authoritative; the legacy metadata flag is
// still honoured so nothing that previously worked breaks.
//
// NOTE: this is a *membership* gate (is the caller an active admin at all),
// not role-tier or corporation/zone scoping. Granular RBAC is a planned
// follow-up (see RBAC-PLAN.md); when added, extend this module.

export interface MinimalUser {
  id: string;
  user_metadata?: { role?: string } | null;
}

// Anything with a Supabase-style `.from(table)` query builder. Kept
// deliberately loose (`from` returns any) so BOTH the real SupabaseClient
// (whose deep generics otherwise trigger "excessively deep" type errors) and a
// lightweight test mock satisfy it.
export interface AdminQueryClient {
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
}

/**
 * Returns true if `user` is an authorized admin.
 *
 * Authorization is granted when EITHER:
 *  1. the user carries the legacy `user_metadata.role === 'admin'` flag, OR
 *  2. there is an active row in `admin_users` for the user's id.
 *
 * Any query error is treated as "not authorized" (fail closed).
 */
export async function isAuthorizedAdmin(
  adminClient: AdminQueryClient,
  user: MinimalUser | null | undefined,
): Promise<boolean> {
  if (!user || !user.id) return false;

  // Legacy fast-path: explicit admin role in the JWT metadata.
  if (user.user_metadata?.role === "admin") return true;

  // Primary path: active membership in the admin_users registry.
  try {
    const { data, error } = await adminClient
      .from("admin_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) return false;
    return data != null;
  } catch (_e) {
    return false;
  }
}
