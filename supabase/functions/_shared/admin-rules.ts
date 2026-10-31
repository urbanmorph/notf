// Rules for managing NOTF admins and viewers from the admin panel (the
// manage-admins Edge Function). Kept pure so they are unit-tested.
//
// - Invites create admins or viewers only. Super admins are added with
//   scripts/add-super-admin.sh and cannot be changed from the panel.
// - Nobody changes their own access (no self-promotion, no locking yourself out).

const NOTF_ROLES = ["admin", "viewer"] as const;
type Role = typeof NOTF_ROLES[number];
const isRole = (v: unknown): v is Role =>
  typeof v === "string" && (NOTF_ROLES as readonly string[]).includes(v);

const SUPER_ADMIN_NOTE =
  "Super admins are managed with scripts/add-super-admin.sh, not from the admin panel.";

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validate and tidy an invite: {email, name, notf_role: 'admin' | 'viewer'}. */
export function checkInvite(
  input: Record<string, unknown>,
): Checked<{ email: string; name: string; notf_role: Role }> {
  const email = String(input.email ?? "").trim().toLowerCase();
  const name = String(input.name ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!name) return { ok: false, error: "Enter their name." };
  if (!isRole(input.notf_role)) {
    return { ok: false, error: "Choose admin or viewer." };
  }
  return { ok: true, value: { email, name, notf_role: input.notf_role } };
}

/**
 * Why `caller` may not make `change` to `target`, or null if allowed.
 * `change` sets notf_role ('admin' | 'viewer' | null to remove NOTF access)
 * and/or is_active (boolean).
 */
export function checkChange(
  caller: { user_id: string },
  target: { user_id: string | null; role?: string | null },
  change: Record<string, unknown>,
): string | null {
  if (target.role === "super_admin") return SUPER_ADMIN_NOTE;
  if (target.user_id === caller.user_id) {
    return "You can't change your own access. Ask another admin.";
  }
  const hasRole = "notf_role" in change;
  const hasActive = "is_active" in change;
  if (!hasRole && !hasActive) return "Nothing to change.";
  if (hasRole && change.notf_role !== null && !isRole(change.notf_role)) {
    return "Choose admin or viewer.";
  }
  if (hasActive && typeof change.is_active !== "boolean") {
    return "is_active must be true or false.";
  }
  return null;
}
