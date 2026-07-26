# NOTF — Developer Onboarding

Welcome. This is the day-one guide for developers taking over NOTF. Read it once
end-to-end, then keep `ARCHITECTURE.md` and `CONTRIBUTING.md` open as you work.

---

## 0. Read this first — the one rule that matters most

NOTF had a **data-loss incident on 2026-06-02**: an admin "approve" action silently
wiped a community's metadata, and it was nearly unrecoverable (no audit trail existed
yet). Everything in the **Data Safety Invariants** section of
[`ARCHITECTURE.md`](ARCHITECTURE.md) exists because of that. Before you change *any*
code that writes to or deletes from the database (the admin panel, the edge
functions, the migrations), read that section. If a change seems to require weakening
a safeguard, **stop and ask the maintainer.**

The short version:
- Public submissions live **only** as a DB row until an admin approves them — there
  is no file backup. Losing the row loses the data.
- Admin writes/deletes go through **Edge Functions** that merge carefully and never
  overwrite populated fields with blanks.
- Every UPDATE/DELETE on `file_metadata` is captured in `file_metadata_audit`. That
  table is your undo button — don't drop it.

---

## 1. The system in one picture

```
 Visitor's browser
   │  reads data at runtime (public anon key, hardcoded in data-loader.js)
   ▼
 Static site (website/public/)  ──deployed by──▶  Vercel  ◀── auto-deploys on push to main
   │                                                          also redeployed by a DB trigger
   │  two write paths:                                        (trigger-vercel-deploy) on data change
   │
   ├─ (A) PUBLIC submissions: join form + chatbot
   │        INSERT a `pending` row directly into ─────────▶ Supabase Postgres: file_metadata
   │        file_metadata (anon client). No file written.        │
   │                                                              │
   └─ (B) ADMIN create/edit/approve/delete (admin panel)          │
            supabase.functions.invoke('update-file'|'delete-file')│
            → Edge Function (service-role, bypasses RLS) ─────────┘
                                              │
                                              └──▶ Supabase Storage bucket `notf`
                                                   (markdown/YAML, admin-curated source of truth)
```

Full detail (including *why* the two paths differ and how that caused the incident)
is in [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 2. Get it running locally (5 minutes, no secrets)

```bash
git clone git@github.com:urbanmorph/notf.git
cd notf/website
npm install
npm run dev          # Vite → http://localhost:5173, serves website/public/
```

That's it. The site reads live production data from Supabase using the **public anon
key** (already in `assets/js/data-loader.js`), so you see real content immediately.
**No `.env`, no credentials** are needed to run and develop the frontend read-only.

You only need real credentials to (a) approve/edit content via the admin panel
against prod, (b) deploy edge functions, or (c) run migrations — see
[`ACCESS.md`](ACCESS.md).

---

## 3. Where everything lives

### Frontend — `website/public/`
Plain HTML pages, one per route, plus shared `assets/`:
- `assets/js/data-loader.js` — the Supabase client + all data reads. **Start here** to
  understand how any page gets its data.
- `assets/js/utils.js` — shared helpers, incl. `buildJoinRecord` / `insertJoinRecord`
  (the public-submission path).
- `assets/js/join-form.js`, `assets/chat/onboarding-engine.js` — the two public
  submission entry points (write path A).
- `assets/i18n/` — translator + 11 locale JSON files.
- `catalog/` — the Solution Catalogue (static data in `catalog/catalog-data.js`).
- `admin/` — the admin panel (`communities`, `organizations`, `stories`, `matcher`,
  `geocode-tool`, `login`). All admin writes go through edge functions (write path B).

### Backend — `supabase/`
- `functions/update-file`, `functions/delete-file` — the guarded admin write/delete
  functions. **The most safety-critical code in the repo.**
- `functions/sync-storage-to-db`, `functions/cleanup-root-community-files` — admin
  maintenance jobs (dry-run by default).
- `functions/trigger-vercel-deploy` — called by a DB trigger to redeploy on data change.
- `functions/_shared/` — `auth.ts` (`isAuthorizedAdmin`), `cors.ts`, `file-ops.ts`
  (`mergeUpdates` — the "never wipe populated fields" logic). Unit-tested.
- `migrations/` — audit trigger + delete lockdown + schema. Apply with `supabase db push`.

### Data & ops
- `scripts/` — live one-offs (`check-catalogue-consistency.mjs`, `generate-sitemap.py`,
  `seed-bengaluru-stories.js`). `scripts/archive/` is **dead legacy** (old YAML/Excel
  pipeline) — don't use it.
- `supporting documents/` — ward-level climate data research + processing scripts.

---

## 4. How data actually flows (the two write paths)

**Path A — public submission (no auth):** a visitor fills the join form or chatbot →
`buildJoinRecord()` builds a record → `insertJoinRecord()` INSERTs a `status:'pending'`
row into `file_metadata` via the anon client. RLS allows this only for
`pending` + known `file_type` + a `submitted_via` marker. No Storage file is written.
The pending row shows up in the admin panel for review.

**Path B — admin action (auth required):** the admin panel calls
`supabase.functions.invoke('update-file' | 'delete-file')`. The function checks
`isAuthorizedAdmin()` (an active row in `admin_users`, or legacy
`user_metadata.role==='admin'`), then merges/deletes carefully using the service-role
key. Approving a pending submission = an `update-file` call that flips status to
`active` and writes the Storage file.

**Never** add direct client-side DB writes/deletes for admin actions, and **never**
re-grant `DELETE` on `file_metadata` to `anon`/`authenticated`. Both are locked down
on purpose.

---

## 5. Testing

Two suites (details and commands in [`CONTRIBUTING.md`](CONTRIBUTING.md)):

- **Deno unit tests** — edge-function logic (`_shared/auth|cors|file-ops`) + browser
  helpers (`join-insert`, `catalogue-deps`):
  ```bash
  deno test --allow-read --no-check supabase/functions website/tests/unit
  ```
- **Playwright visual + a11y** — 13 page specs × 5 viewports:
  ```bash
  cd website && npm run test:visual
  ```
  Both also run in CI (`.github/workflows/visual.yml`) on every PR to `main`.

---

## 6. Deploying

You (almost) never deploy by hand:

- **Frontend** — merge to `main`; Vercel auto-deploys. That's the whole flow.
- **Edge functions** — changes under `supabase/functions/` are **not** deployed by the
  git merge. Deploy explicitly: `supabase functions deploy <name>` (requires Supabase
  access — see `ACCESS.md`).
- **Migrations** — `supabase db push` applies new files in `supabase/migrations/`.

---

## 7. Conventions you must follow

All in [`CLAUDE.md`](CLAUDE.md); the non-negotiables:
- **FontAwesome icons, never emojis** in the UI.
- **i18n: update all 11 locale files** whenever you touch user-facing text.
- **Brand palette / typography** per the brand guidelines section.
- **Never push to `main`.** Branch → PR → CI green → squash-merge. Vercel deploys on merge.

---

## 8. First-week checklist

- [ ] Clone + `npm run dev` renders the site locally.
- [ ] Read `ARCHITECTURE.md` (esp. Data Safety Invariants) and skim `CLAUDE.md`.
- [ ] Run both test suites locally and see them green.
- [ ] Get access provisioned per `ACCESS.md` (GitHub, Supabase, Vercel).
- [ ] Make a trivial content change on a branch, open a PR, watch CI + the Vercel preview.
- [ ] Locate `file_metadata_audit` in the Supabase dashboard (your recovery tool).
