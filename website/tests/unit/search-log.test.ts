// deno-lint-ignore-file no-import-prefix
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// search-log.js is a classic browser script; load it as a module with exports appended.
const src = await Deno.readTextFile(
  new URL("../../public/assets/chat/search-log.js", import.meta.url),
);
const { redactQuery, searchLogRow } = await import(
  "data:text/javascript," +
    encodeURIComponent(src + "\nexport { redactQuery, searchLogRow };")
);

// The database refuses rows whose query still holds an email or phone number
// (chat_searches_no_email / chat_searches_no_phone). Use the migration's own
// patterns, so blanked text is checked against exactly what Postgres enforces.
const migration = await Deno.readTextFile(
  new URL(
    "../../../supabase/migrations/20261031120000_add_chat_searches.sql",
    import.meta.url,
  ),
);
const dbPattern = (name: string) => {
  const m = migration.match(
    new RegExp(`${name} CHECK \\(query !~ '([^']+)'\\)`),
  );
  assert(m, `${name} not found in the migration`);
  return new RegExp(m[1].replaceAll("[:space:]", "\\s"));
};
const NO_EMAIL = dbPattern("chat_searches_no_email");
const NO_PHONE = dbPattern("chat_searches_no_phone");

Deno.test("redactQuery blanks phone numbers and emails, keeps the rest", () => {
  assertEquals(
    redactQuery("call me on +91 98450 12345 about composting"),
    "call me on [number] about composting",
  );
  assertEquals(
    redactQuery("mail asha.k@example.org for lake work"),
    "mail [email] for lake work",
  );
  assertEquals(redactQuery("080-2345 6789"), "[number]");
  // Short numbers are kept: pin codes, years, ward numbers.
  assertEquals(
    redactQuery("ward 150, 560001, since 2019"),
    "ward 150, 560001, since 2019",
  );
  assertEquals(redactQuery("  waste  "), "waste");
  assertEquals(redactQuery("x".repeat(300)).length, 200);
});

Deno.test("blanked queries always pass the database's privacy checks", () => {
  for (
    const q of [
      "+91 98450 12345",
      "9845012345",
      "(080) 2345-6789",
      "a@b.co and c.d@e.org",
      "reach 98450-12345 or me@x.in",
    ]
  ) {
    const out = redactQuery(q);
    assert(!NO_EMAIL.test(out), `email left in "${out}"`);
    assert(!NO_PHONE.test(out), `number left in "${out}"`);
  }
  // And the patterns do catch the raw text.
  assert(NO_PHONE.test("9845012345"));
  assert(NO_EMAIL.test("a@b.co"));
});

Deno.test("searchLogRow records what was shown, within the table's limits", () => {
  const results = Array.from({ length: 12 }, (_, i) => ({
    slug: `c-${i}`,
    name: `Community ${i}`,
    resourceType: i % 2 ? "provider" : "community",
    contact: { email: "private@example.org" },
  }));
  const row = searchLogRow({
    query: "waste in Pune",
    results,
    city: "Pune",
    lang: "hi",
    page: "/about/",
  });
  assertEquals(row.query, "waste in Pune");
  assertEquals(row.result_count, 10);
  assertEquals(row.results.length, 10);
  assertEquals(row.results[1], {
    slug: "c-1",
    name: "Community 1",
    type: "provider",
  });
  assertEquals(row.city, "Pune");
  assertEquals(row.lang, "hi");
  assertEquals(row.page, "/about/");
  // Nothing but slug, name and type leaves the browser.
  assert(!JSON.stringify(row).includes("private@example.org"));
});

Deno.test("searchLogRow handles a search with nothing shown and no city", () => {
  const row = searchLogRow({
    query: "xylophone",
    results: [],
    city: "",
    lang: "en",
    page: "/",
  });
  assertEquals(row.results, []);
  assertEquals(row.result_count, 0);
  assertEquals(row.city, null);
});
