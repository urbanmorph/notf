// deno-lint-ignore-file no-import-prefix
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  catalogueConsistency,
  catalogueEntriesForProvider,
  slugifyProvider,
} from "../../public/assets/admin/catalogue-deps.js";

// The catalogue references providers by display name; the DB uses slugs.
// This is the reliability contract: every real provider's display name must
// slugify to its actual DB slug, or the dependency check would miss entries
// (the exact silent-break the warning is meant to prevent).
// The catalogue always uses the SHORT provider name (e.g. "ATREE"), which is
// what must slugify to the DB slug. (The DB's long metadata.name is never used
// for matching.)
const NAME_TO_DB_SLUG: Record<string, string> = {
  "Aravani Art Project": "aravani-art-project",
  "ATREE": "atree", // catalogue short name -> DB slug
  "B.PAC": "bpac",
  "BRM (Blue Ribbon Movement)": "brm-blue-ribbon-movement",
  "Ek Saath Foundation": "ek-saath-foundation",
  "Fields of View": "fields-of-view",
  "Janaagraha": "janaagraha",
  "Noisewatchers": "noisewatchers",
  "Praja Foundation": "praja-foundation",
  "Prakruthi Shaale": "prakruthi-shaale",
  "Saahas": "saahas",
  "Saath": "saath",
  "Sensing Local": "sensing-local",
  "Smart Refill": "smart-refill",
  "Socratus Foundation": "socratus-foundation",
  "Start Upcycling Now": "start-upcycling-now",
  "The Urban Lab": "the-urban-lab",
  "Vidhi Centre for Legal Policy": "vidhi-centre-for-legal-policy",
  "Waste Warriors": "waste-warriors",
  "WELL Labs": "well-labs",
  "WRI India": "wri-india",
};

Deno.test("slugifyProvider matches every real provider's DB slug", () => {
  for (const [name, slug] of Object.entries(NAME_TO_DB_SLUG)) {
    assertEquals(
      slugifyProvider(name),
      slug,
      `"${name}" should slugify to "${slug}"`,
    );
  }
});

Deno.test("slugifyProvider handles edge cases", () => {
  assertEquals(slugifyProvider(""), "");
  assertEquals(slugifyProvider(null), "");
  assertEquals(slugifyProvider(undefined), "");
  assertEquals(slugifyProvider("  Spaced   Out  "), "spaced-out");
  assertEquals(slugifyProvider("A & B / C"), "a-b-c");
});

const SAMPLE = [
  { id: 1, title: "PLUME", provider: "ATREE" },
  { id: 2, title: "RRR Maadi", provider: "Saahas" },
  { id: 3, title: "Cutlery Bank", provider: "Saahas" },
  { id: 4, title: "City Action Plans", provider: "Janaagraha" },
];

Deno.test("catalogueEntriesForProvider finds entries by slug (incl. ATREE name mismatch)", () => {
  assertEquals(catalogueEntriesForProvider(SAMPLE, "atree"), [{
    id: 1,
    title: "PLUME",
  }]);
  assertEquals(catalogueEntriesForProvider(SAMPLE, "saahas"), [
    { id: 2, title: "RRR Maadi" },
    { id: 3, title: "Cutlery Bank" },
  ]);
});

Deno.test("catalogueEntriesForProvider returns [] for a provider with no entries", () => {
  assertEquals(catalogueEntriesForProvider(SAMPLE, "socratus-foundation"), []);
  assertEquals(catalogueEntriesForProvider(SAMPLE, ""), []);
  assertEquals(catalogueEntriesForProvider(SAMPLE, undefined), []);
});

Deno.test("catalogueConsistency flags catalogue entries whose provider isn't active (orphans)", () => {
  // Janaagraha archived (not in active set) -> its catalogue entry is an orphan
  const { orphans } = catalogueConsistency(SAMPLE, ["atree", "saahas"]);
  assertEquals(orphans, [
    {
      id: 4,
      title: "City Action Plans",
      provider: "Janaagraha",
      slug: "janaagraha",
    },
  ]);
});

Deno.test("catalogueConsistency: no orphans when all providers active", () => {
  const { orphans } = catalogueConsistency(SAMPLE, [
    "atree",
    "saahas",
    "janaagraha",
  ]);
  assertEquals(orphans, []);
});
