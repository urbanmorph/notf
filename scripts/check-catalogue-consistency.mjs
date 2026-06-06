#!/usr/bin/env -S deno run --allow-net --allow-read
// Catalogue ↔ provider consistency report.
//
// Cross-checks the public catalogue (website/public/catalog/catalog-data.js)
// against the ACTIVE solution-providers in Supabase, using the same slug match
// the admin uses (catalogue-deps.js). Flags:
//   - orphans: catalogue entries whose provider isn't an active provider
//     (archived/missing) — shown in the catalogue but not the home listing.
//   - unreferenced active providers (informational).
//
// Exits non-zero if any orphan is found (so it can gate CI).
// Run:  deno run --allow-net --allow-read scripts/check-catalogue-consistency.mjs
import {
  catalogueConsistency,
  slugifyProvider,
} from "../website/public/assets/admin/catalogue-deps.js";

const SUPABASE_URL = "https://abblyaukkoxmgzwretvm.supabase.co";

// Read the public anon key from auth.js (single source, avoids drift).
const authJs = await Deno.readTextFile(
  new URL("../website/public/assets/admin/auth.js", import.meta.url),
);
const anon = authJs.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)?.[1];
if (!anon) {
  console.error("Could not read SUPABASE_ANON_KEY from auth.js");
  Deno.exit(2);
}

// Load window.CATALOG_PROJECTS from the shared catalogue data file.
globalThis.window = globalThis.window ?? {};
const dataJs = await Deno.readTextFile(
  new URL("../website/public/catalog/catalog-data.js", import.meta.url),
);
(0, eval)(dataJs);
const projects = globalThis.window.CATALOG_PROJECTS ?? [];

// Fetch active provider slugs (public RLS allows reading active rows).
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/file_metadata?file_type=eq.solution-provider&status=eq.active&select=slug`,
  { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
);
if (!res.ok) {
  console.error(`Supabase query failed: HTTP ${res.status}`);
  Deno.exit(2);
}
const activeSlugs = (await res.json()).map((r) => r.slug);

const { orphans } = catalogueConsistency(projects, activeSlugs);
const referenced = new Set(projects.map((p) => slugifyProvider(p.provider)));
const unreferenced = activeSlugs.filter((s) => !referenced.has(s));

console.log(`Catalogue projects : ${projects.length}`);
console.log(`Active providers   : ${activeSlugs.length}\n`);

if (orphans.length) {
  console.log(
    `❌ ${orphans.length} catalogue ${
      orphans.length === 1 ? "entry references" : "entries reference"
    } a provider that is NOT active (orphan — visible in catalogue, missing from home listing):`,
  );
  for (const o of orphans) {
    console.log(`   • "${o.title}" → "${o.provider}" (slug: ${o.slug})`);
  }
} else {
  console.log("✅ Every catalogue entry maps to an active provider.");
}

console.log(
  `\nℹ️  ${unreferenced.length} active provider(s) with no catalogue entry: ${
    unreferenced.join(", ") || "(none)"
  }`,
);

Deno.exit(orphans.length ? 1 : 0);
