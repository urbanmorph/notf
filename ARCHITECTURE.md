# NOTF Architecture — Data Flow & Safeguards

This document describes how NOTF community / solution-provider / story data flows
through the system, and the safeguards that protect it from loss. It is referenced
by `CLAUDE.md`. **Read the "Data Safety Invariants" section before changing any
admin write or delete path.**

## Components

- **Static site** — hand-written HTML in `website/public/`, served by Vercel. No
  build step. Reads data from Supabase at runtime via the public anon key.
- **Supabase project `notf-cms`** (`abblyaukkoxmgzwretvm`):
  - **Storage** bucket `notf` — markdown/YAML files, treated as source of truth for
    admin-curated content.
  - **Postgres** table `file_metadata` — the query/index cache for the site, plus
    the *only* home of public-submission metadata until approval (see below).
  - **Edge Functions** — `update-file`, `delete-file`, `sync-storage-to-db`,
    `cleanup-root-community-files`, `trigger-vercel-deploy`.
- **Vercel** — auto-deploys the static site on push to `main`; also redeployed by a
  DB trigger (`trigger_deployment_on_*` → `trigger-vercel-deploy`) when
  `file_metadata` changes.

## The two write paths (and why they differ)

1. **Public submission (join form `join-form.js`, chatbot `onboarding-engine.js`):**
   builds a record with `buildJoinRecord` (`utils.js`) and INSERTs it **directly into
   `file_metadata`** with `status: 'pending'`, using the anon client. It does **not**
   write a Storage file. So a pending submission's rich metadata exists **only** in
   the DB row.

2. **Admin create/edit/approve/delete (admin panel):** goes through Edge Functions
   via `supabase.functions.invoke('update-file' | 'delete-file', …)`. These use the
   **service-role** key (which bypasses RLS) and enforce admin auth in code.

The mismatch between these two paths caused the 2026-06-02 incident: an admin
approval sent `{status:'active'}` to `update-file`, which (being storage-first) tried
to merge against a Storage file that never existed for a DB-first record, collapsing
the metadata to almost nothing and overwriting the DB row. See the safeguards below.

## Storage path conventions

- Public submissions: `communities/<slug>.md` or `solution-providers/<slug>.md`
  (no city subfolder).
- Admin-created: `communities/<city>/<slug>.md`.
- Both are valid. `cleanup-root-community-files` must therefore never blindly delete
  root-level files — it only removes ones with no matching `file_metadata` row.

## Data Safety Invariants (DO NOT REGRESS)

These are also summarised in `CLAUDE.md`. Any change touching admin write/delete must
preserve all of them; if a change seems to require weakening one, stop and confirm
with the maintainer.

1. **`update-file` never wipes on partial update.** When the Storage file is missing,
   seed `currentData` from the existing DB row's `metadata` before merging.
   `mergeUpdates` ignores `null`/`undefined` and empty arrays. (Health `4.2+`.)
2. **`delete-file` is admin-only and verified.** Requires `user_metadata.role ===
   'admin'`; resolves the row by `file_path` (404/409 on miss/type-mismatch); deletes
   by immutable `id`; returns the before-image. (Health `2.0+`.)
3. **`sync-storage-to-db` is admin-only and dry-run by default.**
4. **`cleanup-root-community-files` is admin-only and skips referenced files.**
5. **Audit trail.** `file_metadata_audit` + trigger `file_metadata_audit_trg` record a
   before-image of every UPDATE/DELETE on `file_metadata`. Recovery query:
   `SELECT audited_at, action, old_row FROM file_metadata_audit WHERE file_path = '…' ORDER BY audited_at DESC;`
6. **Direct DELETE is revoked** from `anon`/`authenticated` on `file_metadata`;
   deletion only via the service-role Edge Function.

## Recovery playbook

- **Something was wiped/deleted recently:** query `file_metadata_audit` for the
  `file_path`; the most recent `old_row` before the bad change is the pre-incident
  state. Re-apply it via the admin Edit form or `update-file`.
- **Audit predates the loss / table didn't exist yet:** restore the most recent
  daily backup via Supabase Dashboard → Database → Backups → **Restore to new
  project** (never in-place), extract the rows, patch prod. Daily backups are taken
  ~02:00 UTC and do **not** include Storage objects.
- **PITR** is not enabled (paid add-on). Consider enabling for sub-daily recovery.

## Known follow-ups (not yet done)

- Soft-delete (`deleted_at` tombstone) instead of hard delete — needs frontend read
  filters.
- Collision-safe slugs for public submissions (currently name-derived).
- Type-to-confirm UX on admin delete buttons.
- `discussion_likes` DELETE policy is `true` (anonymous likes, no `user_id`) —
  accepted low-risk.
