# Contributing to NOTF

How to make changes to NOTF safely. New here? Read [`ONBOARDING.md`](ONBOARDING.md)
first, then this. For the deeper "why", see [`ARCHITECTURE.md`](ARCHITECTURE.md) and
[`CLAUDE.md`](CLAUDE.md).

---

## Ground rules

1. **Never push to `main`.** Branch → open a PR → wait for CI green → squash-merge.
   Vercel deploys automatically on merge.
2. **Data-safety first.** Before changing any admin write/delete path (the admin panel,
   `supabase/functions/`, or a migration touching `file_metadata`), read the **Data
   Safety Invariants** in [`ARCHITECTURE.md`](ARCHITECTURE.md). If a change seems to
   need weakening a safeguard, stop and ask the maintainer.
3. **i18n is mandatory.** Any user-facing text change updates **all 11** locale files
   (see §5).
4. **FontAwesome icons, never emojis** in the UI.

## Local development

```bash
cd website
npm install
npm run dev        # Vite → http://localhost:5173 (serves website/public/)
```

Reads live Supabase data via the public anon key — no secrets needed for frontend work.
Hard-refresh (Cmd/Ctrl+Shift+R) after CSS/i18n changes; the browser caches aggressively.

---

## Making changes

### A. Static pages (HTML / CSS / JS)

Pages are hand-written HTML in `website/public/`, one file per route, sharing
`assets/css/` and `assets/js/`. There is no build step — what you edit is what ships.

- Data reads go through `assets/js/data-loader.js`. Don't add ad-hoc Supabase clients.
- Any visible string needs a `data-i18n` attribute and keys in all locale files (§5).
- Follow the brand palette, typography, and component patterns in [`CLAUDE.md`](CLAUDE.md).
- Adding/removing page content changes its height → will shift Playwright baselines (§6).

### B. Catalogue projects (`/catalog/`)

The Solution Catalogue is **static data** — no database involved. Adding a project
touches three files plus images:

| File | What you add |
|------|--------------|
| `website/public/catalog/catalog-data.js` | The full project object (source of truth). |
| `website/public/catalog/index.html` | Optional filter-tag entry in `projectTags`. |
| `website/public/index.html` | Optional home-carousel entry. |
| `website/public/assets/images/catalogue/` | Project photos (downscaled). |

**1. `catalog-data.js`** — append to the `window.CATALOG_PROJECTS = [ … ]` array with
the next unused `id`:

```js
{
    id: 52,
    title: "Project Name",
    description: "One or two sentences shown on the card.",
    themes: ["Water & Ecology"],            // valid values below
    time: 4, workload: 3, budget: 3,        // effort dials, 1 (low)–5 (high)
    whatIsIt: "Full paragraph.",
    whyExists: "Full paragraph.",
    involves: ["Activity one", "Activity two"],
    whereDone: "Where it ran, with scale/reach.",
    impact: "Concrete outcomes and numbers.",
    whatsNeeded: "What a community needs to host it.",
    links: ["https://example.org/project"], // [] if none
    images: [                               // omit the key entirely if none
        { src: "/assets/images/catalogue/slug-photo1.jpg", caption: "Short caption" }
    ],
    provider: "Provider Organisation Name"
}
```

**Valid `themes`** (exact strings — they drive the page sections): `Energy & Climate`,
`Governance & Policy`, `Livelihoods & Inclusion`, `Mobility`, `Place-Based Centres`,
`Placemaking & Urban Ecology`, `Waste & Circular Economy`, `Water & Ecology`. A new
theme string creates a new section — flag it in the PR rather than inventing one.

**2. `catalog/index.html` `projectTags`** (optional) — extra filter chips, keyed by id.
Existing values: `Awareness`, `Biodiversity`, `Community`, `Education`, `Gender`,
`Governance`, `Livelihoods`, `Mobility`, `Water`.
```js
52: ['Biodiversity', 'Water'],
```

**3. `index.html` home carousel** (recommended) — a trimmed entry:
```js
{ id: 52, title: 'Project Name', themes: ['Water & Ecology'], image: '/assets/images/catalogue/slug-photo1.jpg' }
```

**Images:** put in `assets/images/catalogue/`, name `slug-descriptor.jpg` (lowercase,
hyphenated), downscale to **≈1400px longest edge, <600 KB each**, reference with
absolute `/assets/...` paths. Don't commit multi-MB originals.

**Provider caveat:** `provider` is just a label; the entry renders regardless. If the
provider isn't already a solution provider in the system, that's a separate,
**maintainer-only** database step — just note "new provider: X" in the PR description.
Don't touch Supabase for it.

### C. Edge Functions (`supabase/functions/`)

The backend. `update-file` and `delete-file` are the most safety-critical code in the
repo — they carry the invariants from the 2026-06-02 incident.

- Shared logic lives in `_shared/`: `auth.ts` (`isAuthorizedAdmin`), `cors.ts`
  (`getCorsHeaders` — `ALLOWED_ORIGINS` **must** include `https://www.notf.in`),
  `file-ops.ts` (`mergeUpdates` — skips `null`/`undefined`/empty-string/empty-array so
  blank fields never erase data).
- Add/adjust unit tests under `_shared/*.test.ts` for any logic change (§5).
- **Deploy is not automatic** — git merge ships the frontend, not functions:
  ```bash
  supabase functions deploy update-file   # requires Supabase access (see ACCESS.md)
  ```
- Preserve every invariant in `ARCHITECTURE.md` §"Data Safety Invariants". Fix
  data-integrity issues in the merge layer (one place, protects all callers), not with
  client-side patches.

### D. Database migrations (`supabase/migrations/`)

- Name files `YYYYMMDDHHMMSS_description.sql` (matches existing).
- Apply with `supabase db push`.
- **Never** drop `file_metadata_audit` / its trigger, and **never** re-grant `DELETE`
  on `file_metadata` to `anon`/`authenticated`. Those are the incident safeguards.

---

## 5. Internationalization (i18n) — mandatory

11 languages: `en, hi, kn, mr, ta, te, gu, bn, ml, or, ur`, in
`website/public/assets/i18n/locales/`.

Whenever you add or change user-facing text:
1. Add the key to `en.json` first.
2. Add `data-i18n="section.key"` (or `-placeholder` / `-aria` / `-title`) on the element.
3. Add the translated key to **all 10 other files** (a small Python loop works well —
   see the i18n section of [`CLAUDE.md`](CLAUDE.md)).
4. Verify: `python3 -m json.tool <file>.json` for each, then switch languages in the UI
   (globe icon), and check RTL for Urdu.

Missing a language breaks that locale's page. Don't skip it.

---

## 6. Testing

### Deno unit tests (edge-function + browser helpers)
```bash
deno test --allow-read --no-check supabase/functions website/tests/unit
```
Covers `_shared/auth|cors|file-ops` and `join-insert` / `catalogue-deps`. `--no-check`
sidesteps a known type-inference quirk in `catalogue-deps.test.ts` (runtime is green;
fixing the type is a minor follow-up).

### Playwright visual + a11y

Screenshots are **pinned to the official Playwright Docker image**, so they render
identically in CI and on any machine — no more "green on my Mac, red in CI". Data is
served from a **fixed fixture** (`tests/visual/fixtures.ts`), so live Supabase content
can't drift the layout. Baselines are a single **platform-independent** set
(`tests/visual/*-snapshots/page-<viewport>.png`).

Run the suite through the same pinned image:
```bash
docker run --rm -v "$PWD":/work -w /work/website \
  mcr.microsoft.com/playwright:v1.59.1-noble \
  sh -c "npm ci && npx playwright test"
```
`cd website && npm run test:visual` also works for quick iteration, but pixel-exact
comparison is only valid **inside the image** — a bare local run must not be used to
update baselines.

**Regenerate baselines only inside the pinned image** (a bare local
`--update-snapshots` bakes in your machine's rendering and will break CI):
- **Locally:** add `--update-snapshots` to the `docker run` command above, then commit
  the changed `*-snapshots/*.png`.
- **Via CI:** Actions → **Visual Regression** → **Run workflow** with
  `update_snapshots = true` → download the `snapshots` artifact → unzip over
  `website/tests/visual/` → commit.

Only regenerate when you *intend* the visuals to change. Keep the image tag and
`@playwright/test` in `package.json` in lockstep.

---

## 7. PR → CI → deploy flow

```bash
git checkout -b <type>/<short-description>
# ...make changes, run tests locally...
git add -A
git commit -m "feat: <what changed>"
git push origin <type>/<short-description>
gh pr create --fill        # or open in the GitHub UI
```

- CI (`.github/workflows/visual.yml`) runs the Playwright suite on the PR.
- A maintainer reviews. Merge with **squash**; delete the branch.
- **Vercel auto-deploys `main`.** Edge-function and migration changes still need their
  explicit `supabase` deploy/push step (§C/§D) — the merge alone does not ship them.

### Commit types
`feat` · `fix` · `docs` · `style` · `refactor` · `perf` · `test` · `chore`.
End co-authored commits with the `Co-Authored-By:` trailer per `CLAUDE.md`.

---

## Pre-PR checklist

- [ ] Branched off `main`; **not** committing to `main` directly.
- [ ] Deno + Playwright suites run locally (or you know why a baseline shifted).
- [ ] User-facing text: all 11 locale files updated; JSON valid.
- [ ] Icons are FontAwesome, not emojis.
- [ ] Touched an admin write/delete path? Re-verified the `ARCHITECTURE.md` invariants;
      added/updated `_shared` unit tests; planned the `supabase functions deploy`.
- [ ] Touched a migration? Audit trigger + delete lockdown still intact.
- [ ] No secrets, `.env`, or credentials in the diff.
- [ ] PR description notes any new catalogue provider or required post-merge deploy step.
