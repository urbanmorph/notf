// deno-lint-ignore-file no-import-prefix no-explicit-any
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// utils.js is a classic browser script (no ESM exports). Load it as a module by
// appending exports, so the pure helpers can be unit-tested in Deno. It has no
// top-level browser API use, so it evaluates cleanly.
const src = await Deno.readTextFile(
  new URL("../../public/assets/js/utils.js", import.meta.url),
);
const mod = await import(
  "data:text/javascript," +
    encodeURIComponent(
      src +
        "\nexport { insertJoinRecord, isUniqueViolation, slugVariant };",
    )
);
const { insertJoinRecord, isUniqueViolation, slugVariant } = mod;

// Mock supabase whose .from(t).insert(record) returns the next scripted result
// and records every attempted insert.
function mockSupabase(results: Array<{ data: unknown; error: unknown }>) {
  let i = 0;
  const inserted: any[] = [];
  return {
    inserted,
    from() {
      return {
        insert(record: any) {
          inserted.push(record);
          const r = results[Math.min(i, results.length - 1)];
          i++;
          return Promise.resolve(r);
        },
      };
    },
  };
}

const baseRecord = {
  slug: "green-warriors",
  file_type: "community",
  file_path: "communities/green-warriors.md",
  status: "pending",
  metadata: { name: "Green Warriors" },
};

Deno.test("isUniqueViolation: detects 23505 / duplicate key / unique constraint", () => {
  assertEquals(isUniqueViolation({ code: "23505" }), true);
  assertEquals(isUniqueViolation({ message: "duplicate key value violates ..." }), true);
  assertEquals(isUniqueViolation({ message: "unique constraint failed" }), true);
  assertEquals(isUniqueViolation({ code: "23503" }), false);
  assertEquals(isUniqueViolation(null), false);
});

Deno.test("slugVariant: base for attempt 0, suffixed after", () => {
  assertEquals(slugVariant("x", 0), "x");
  assertEquals(slugVariant("x", 1), "x-2");
  assertEquals(slugVariant("x", 2), "x-3");
});

Deno.test("insertJoinRecord: succeeds first try, no retry, keeps base slug", async () => {
  const sb = mockSupabase([{ data: null, error: null }]);
  const res = await insertJoinRecord(sb, baseRecord);
  assertEquals(res.error, null);
  assertEquals(res.slug, "green-warriors");
  assertEquals(sb.inserted.length, 1);
  assertEquals(sb.inserted[0].file_path, "communities/green-warriors.md");
});

Deno.test("insertJoinRecord: retries with a suffixed slug on unique violation", async () => {
  const sb = mockSupabase([
    { data: null, error: { code: "23505" } }, // base collides
    { data: null, error: null }, // -2 succeeds
  ]);
  const res = await insertJoinRecord(sb, baseRecord);
  assertEquals(res.error, null);
  assertEquals(res.slug, "green-warriors-2");
  assertEquals(sb.inserted.length, 2);
  assertEquals(sb.inserted[1].slug, "green-warriors-2");
  assertEquals(sb.inserted[1].file_path, "communities/green-warriors-2.md");
});

Deno.test("insertJoinRecord: a non-collision error is surfaced immediately (no retry)", async () => {
  const sb = mockSupabase([{ data: null, error: { code: "23503", message: "fk violation" } }]);
  const res = await insertJoinRecord(sb, baseRecord);
  assertEquals((res.error as any).code, "23503");
  assertEquals(sb.inserted.length, 1);
});

Deno.test("insertJoinRecord: gives up with an error after maxAttempts collisions", async () => {
  const sb = mockSupabase([{ data: null, error: { code: "23505" } }]); // always collides
  const res = await insertJoinRecord(sb, baseRecord, 3);
  assertEquals(res.error !== null, true);
  assertEquals(sb.inserted.length, 3);
});

Deno.test("insertJoinRecord: solution-provider path uses the right directory", async () => {
  const sp = { ...baseRecord, file_type: "solution-provider", file_path: "solution-providers/x.md", slug: "x" };
  const sb = mockSupabase([{ data: null, error: { code: "23505" } }, { data: null, error: null }]);
  const res = await insertJoinRecord(sb, sp);
  assertEquals(res.slug, "x-2");
  assertEquals(sb.inserted[1].file_path, "solution-providers/x-2.md");
});
