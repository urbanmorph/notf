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
// NOTF access is decided by admin_users.notf_role (admin_users is shared with
// the notf-cms city app, whose `role` column is a city hierarchy): 'admin' may
// read and write, 'viewer' may only read, NULL means no NOTF access. See
// RBAC-PLAN.md and supabase/migrations/20261031170000_notf_admin_viewer_roles.sql.

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

export type NotfRole = "admin" | "viewer";

/**
 * The caller's NOTF role from an active admin_users row: "admin", "viewer", or
 * null (no row, inactive, no NOTF role, or any query error: fail closed).
 */
export async function getNotfRole(
  adminClient: AdminQueryClient,
  user: MinimalUser | null | undefined,
): Promise<NotfRole | null> {
  if (!user || !user.id) return null;
  try {
    const { data, error } = await adminClient
      .from("admin_users")
      .select("notf_role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data) return null;
    return data.notf_role === "admin" || data.notf_role === "viewer"
      ? data.notf_role
      : null;
  } catch (_e) {
    return null;
  }
}

/**
 * Returns true if `user` may change NOTF data: the legacy
 * `user_metadata.role === 'admin'` flag, or an active admin_users row with
 * notf_role 'admin'. Viewers and city-app-only accounts are refused.
 */
export async function isAuthorizedAdmin(
  adminClient: AdminQueryClient,
  user: MinimalUser | null | undefined,
): Promise<boolean> {
  if (!user || !user.id) return false;
  // Legacy fast-path: explicit admin role in the JWT metadata.
  if (user.user_metadata?.role === "admin") return true;
  return (await getNotfRole(adminClient, user)) === "admin";
}
