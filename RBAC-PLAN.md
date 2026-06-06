# NOTF Admin RBAC — Current State & Phased Plan

Status as of 2026-06-06. This documents what role-based access control (RBAC)
exists, what is actually enforced, and a phased plan to close the gap. The
audit that produced this is summarised at the bottom.

## What's defined (schema)

`public.admin_users` already models a full hierarchy and scoping:

- `role` (`admin_role` enum, hierarchical, default `field_officer`):
  `super_admin` › `commissioner` › `zone_officer` › `department_head` › `field_officer`
- Scoping FKs: `corporation_id`, `department_id`, `zone_id`
- `is_active` flag

Current members: `sathya@urbanmorph.com` = `super_admin`;
`admin.south@southcorp.in` = `commissioner` (different corporation).

## What's actually enforced (before this change)

| Layer | Enforcement |
|-------|-------------|
| Admin UI access (`auth.js requireAuth`) | session exists only — did **not** check `admin_users` |
| Reads (RLS `Authenticated users read all files`, `USING true`) | any authenticated user reads **all** rows; no scoping |
| Writes via Edge Functions | required `user_metadata.role === 'admin'` — a value not in the enum, unset on every account → all writes 403'd |
| The 5 roles + corp/zone/dept scoping | **enforced nowhere** |

Net: roles were dormant; a `field_officer` would have had the same power as a
`super_admin`.

## Phase 0 — Membership gate (DONE in this change)

Unify the admin check on the real registry, without role granularity yet:

- `_shared/auth.ts isAuthorizedAdmin()` — authorize if active in `admin_users`
  (or legacy `user_metadata.role === 'admin'`). Wired into `update-file` +
  `delete-file`. Fixes the 403.
- `auth.js requireAuth()` — now also requires active `admin_users` membership
  (not just any session); non-admins are signed out and redirected.
- Covered by unit tests (`_shared/auth.test.ts`).

Result: only active admins can reach the console or write — but every active
admin can still do everything. Scoping/role-tiers are Phases 1–3.

## Phase 1 — Role-tier capability matrix (no data scoping)

Define what each role may do and enforce it in both the UI and the Edge Functions.

Proposed matrix (tune with stakeholders):

| Capability | super_admin | commissioner | zone_officer | department_head | field_officer |
|---|---|---|---|---|---|
| View records | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create / edit | ✅ | ✅ | ✅ | ✅ | ✅ (own submissions) |
| Approve (pending→active) | ✅ | ✅ | ✅ | ➖ | ❌ |
| Archive / deactivate | ✅ | ✅ | ✅ | ➖ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage admins | ✅ | ➖ | ❌ | ❌ | ❌ |

Implementation:
- Extend `isAuthorizedAdmin` → `getAdminContext()` returning `{ role, corporation_id, zone_id, department_id }`.
- Add a `requireCapability(ctx, action)` helper (shared) used by `update-file`
  (gate `status` transitions + edits) and `delete-file` (gate delete).
- UI: hide/disable buttons by role (read role from the loaded `admin_users` row);
  the Edge Function remains the real enforcement point.
- Tests: capability matrix table-driven tests.

## Phase 2 — Data scoping (corporation / zone / department)

Restrict which records a non-super admin can see and change.

- Decide the scoping key on `file_metadata`. Today rows have `city`/`ward` but no
  `corporation_id`/`zone_id`. Either (a) add scoping columns to `file_metadata`
  and backfill, or (b) derive scope from `city`→corporation mapping. **(a) is
  cleaner.**
- RLS: replace `Authenticated users read all files (USING true)` with a policy
  that joins `admin_users` and matches scope (super_admin bypasses). Add matching
  `WITH CHECK` for writes.
- Edge Functions: `update-file`/`delete-file` verify the target row is within the
  caller's scope before writing.
- Tests + a migration with a careful backfill; ship behind review.

## Phase 3 — Hardening & hygiene (independent quick wins)

- `admin_users` RLS `admin_users_read (USING true)` is **world-readable** (exposes
  admin names/emails/phones to anon). Tighten to "own row + super_admin".
- Audit-surfaced correctness items (separate from RBAC):
  - **Geocode tool** writes `file_metadata` directly (bypasses `update-file`) and
    only sets top-level lat/lng, not `metadata.location` → coordinates get
    reverted on the next `update-file`. Route it through `update-file` with
    `updates:{location:{latitude,longitude}}`.
  - **Excel import** writes orphan field names (`what_they_offer`/`what_they_ask_for`/
    singular `ward`) instead of `offers`/`asks`/`wards` → those columns silently
    don't import. Rename to the canonical keys.
  - Wire **optimistic locking** (`version`) so concurrent admin edits don't
    silently overwrite each other (the 409 path already exists, unused).
  - Story status `draft` and `file_type:'story'` are undocumented/unvalidated;
    validate `status`/`file_type` against allowlists in `update-file`.

## Recommended sequencing

Phase 0 (shipped) → Phase 3 geocode + excel fixes (data-integrity, low risk) →
Phase 1 (role tiers) → Phase 2 (scoping, largest). Each phase is independently
shippable and test-covered.
