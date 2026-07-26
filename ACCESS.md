# NOTF — Access & Credentials Handover

This is the checklist for giving a developer the access they need to **maintain** NOTF
(not just contribute a catalogue entry). The guiding principle:

> **Grant named, per-person access. Never share tokens, passwords, or service keys.**
> Every person authenticates as themselves so access can be audited and revoked
> individually.

**This file contains no secrets** — only *what* access is needed and *how* to grant it.
Actual keys live in a password manager and in the Supabase/Vercel dashboards.

Legend: **[Owner]** = an action only the current owner/admin (Sathya) can do ·
**[Dev]** = the new developer does it themselves once invited.

---

## What a maintainer needs, and what they do NOT

| Task | Access needed? |
|------|----------------|
| Edit static pages / catalogue, run frontend locally, run tests | ❌ None — clone is enough (anon key is public + in-repo) |
| Open PRs | ⚠️ GitHub write **or** a fork |
| Merge PRs, manage branches | ✅ GitHub write |
| Approve/edit/delete content via the admin panel (prod) | ✅ An `admin_users` row (see §2) |
| Deploy edge functions, run migrations, read/repair the DB | ✅ Supabase project membership |
| View deploys/logs, manage env vars, roll back | ✅ Vercel project membership |
| Run the backfill/sync scripts in `scripts/` | ✅ The service-role key (a shared secret — see §4) |

The team member's Claude agent earlier asked for **Vercel credentials** — for
day-to-day frontend work that is **not needed** (deploys are automatic on merge).
Vercel access is only for the maintenance tasks in the last three rows.

---

## 1. GitHub — `urbanmorph/notf`

- **[Owner]** Invite each dev as a **collaborator** (or add to the `urbanmorph` org
  with a team). Grant **Write** for normal maintainers; reserve **Admin** for whoever
  manages branch protection, secrets, and settings.
- **[Dev]** Add an SSH key to your GitHub account; `git clone git@github.com:urbanmorph/notf.git`.
  If using the `gh` CLI: `gh auth login`.
- Keep the **branch → PR → CI green → squash-merge** workflow. Consider enabling
  branch protection on `main` (require the `Visual Regression` check to pass) if not
  already on.

## 2. Supabase — project `abblyaukkoxmgzwretvm` (org "Urban Morph")

Two distinct kinds of access — don't confuse them:

**(a) Project/dashboard membership** (to deploy functions, run migrations, inspect data)
- **[Owner]** Supabase Dashboard → Organization → **Members** → invite each dev with an
  appropriate role (Developer/Admin). This is per-person; no key sharing.
- **[Dev]** Install the CLI, then:
  ```bash
  supabase login                                   # your own account
  supabase link --project-ref abblyaukkoxmgzwretvm
  supabase functions deploy update-file            # example
  supabase db push                                 # apply migrations
  ```

**(b) Admin-panel authorization** (to use the in-app admin at `/admin/`)
- Being a Supabase *project* member does **not** make you an app admin. The app checks
  the **`admin_users`** table.
- **[Owner]** Add the person: insert an active row into `admin_users` (their auth
  `user_id`, a role, `is_active = true`). This is the single gate used by the edge
  functions (`isAuthorizedAdmin`), the RLS policies, and the admin UI's `requireAuth`.
- Roles today are a *membership* gate; fine-grained role scoping is the
  [`RBAC-PLAN.md`](RBAC-PLAN.md) work.

## 3. Vercel — the NOTF project

- **[Owner]** Add each dev to the **Vercel team/project** (Vercel dashboard → Team →
  Members). This gives them deploys, build logs, runtime logs, env vars, and rollback —
  all under their own login.
- **[Dev]** `npm i -g vercel && vercel login`, then `vercel link` in the repo if you
  need CLI access. Day-to-day you won't: deploys happen automatically on merge to `main`.
- **Do not** create or share a `VERCEL_TOKEN` for people to put in `.env`. Named
  membership replaces it and is auditable.

## 4. Shared secrets (can't be per-person — handle with care)

Two credentials are inherently project-wide. Treat them as sensitive and rotate at
handover:

| Secret | Where it lives | Used by |
|--------|----------------|---------|
| **Supabase service-role key** | `scripts/.env` locally (gitignored); Supabase Dashboard → Project Settings → API | The `scripts/` backfill/sync tools, and the edge functions (which read it from Supabase's own function env, not from this file) |
| **Vercel deploy hook / token** | Supabase Dashboard → Edge Functions → **Secrets** (used by `trigger-vercel-deploy`) | The DB-trigger auto-redeploy on data change |

- **[Owner]** At handover, **rotate both**, then hand the new values to the lead
  maintainer through a **password manager** (1Password/Bitwarden shared vault) — never
  email/Slack/commit.
- Keep the service-role key **maintainer-held**. Prefer running `scripts/` yourself or
  limiting the key to the smallest trusted group. It bypasses all Row-Level Security.
- `scripts/.env` is already in `.gitignore` — confirm it never gets committed.

## 5. Ancillary accounts (as needed)

- **DNS / domain** `notf.in` — registrar access (owner-held; grant only if the dev
  manages DNS).
- **Mailboxes** `admin@notf.in`, `nudge-unit@notf.in` — for admin notifications /
  contact.
- **`notf-cms` complaint API** — endpoint used by the chatbot complaint flow; share its
  base URL / any key if the dev works on that path (Nominatim geocoding is keyless).

---

## Handover checklist (per developer)

- [ ] **[Owner]** GitHub collaborator (Write/Admin) added.
- [ ] **[Owner]** Supabase org member invited.
- [ ] **[Owner]** `admin_users` row created (only if they need the admin panel).
- [ ] **[Owner]** Vercel team member added.
- [ ] **[Dev]** `supabase login && supabase link` works; can list functions.
- [ ] **[Dev]** `vercel login` works (if CLI access needed).
- [ ] **[Owner]** Shared secrets rotated and delivered via password manager (to lead only).
- [ ] **[Owner]** When someone leaves: revoke GitHub, Supabase, Vercel; deactivate their
      `admin_users` row (`is_active = false`); rotate shared secrets if they held them.
