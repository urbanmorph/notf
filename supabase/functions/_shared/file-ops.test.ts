import {
  assertEquals,
  assertNotStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  generateMarkdownFile,
  mergeUpdates,
  parseMarkdownFile,
} from "./file-ops.ts";

// ---------------------------------------------------------------------------
// mergeUpdates — data-safety invariants (the 2026-06-02 wipe regression guard)
// ---------------------------------------------------------------------------

Deno.test("mergeUpdates: status-only update never wipes existing metadata", () => {
  const current = {
    name: "Malleshwaram Forum",
    themes: ["Waste & Circular Economy"],
    description: "24 years of work",
    contact: { person: "Rekha Chari", phone: "9844086982" },
  };
  const merged = mergeUpdates(current, { status: "active" });
  assertEquals(merged.name, "Malleshwaram Forum");
  assertEquals(merged.themes, ["Waste & Circular Economy"]);
  assertEquals(merged.description, "24 years of work");
  assertEquals(merged.contact, { person: "Rekha Chari", phone: "9844086982" });
  assertEquals(merged.status, "active");
});

Deno.test("mergeUpdates: empty array does NOT clobber a populated array", () => {
  const current = { themes: ["A", "B"], offers: ["x"] };
  const merged = mergeUpdates(current, { themes: [], offers: [] });
  assertEquals(merged.themes, ["A", "B"]);
  assertEquals(merged.offers, ["x"]);
});

Deno.test("mergeUpdates: null and undefined are ignored", () => {
  const current = { name: "Keep", city: "Bengaluru" };
  const merged = mergeUpdates(current, { name: null, city: undefined });
  assertEquals(merged.name, "Keep");
  assertEquals(merged.city, "Bengaluru");
});

Deno.test("mergeUpdates: a non-empty array DOES replace the existing array", () => {
  const current = { themes: ["Old"] };
  const merged = mergeUpdates(current, { themes: ["New1", "New2"] });
  assertEquals(merged.themes, ["New1", "New2"]);
});

Deno.test("mergeUpdates: objects deep-merge one level", () => {
  const current = { contact: { person: "A", phone: "1" } };
  const merged = mergeUpdates(current, { contact: { phone: "2", email: "e" } });
  assertEquals(merged.contact, { person: "A", phone: "2", email: "e" });
});

Deno.test("mergeUpdates: new primitive fields are added", () => {
  const merged = mergeUpdates({ a: 1 }, { b: 2, status: "active" });
  assertEquals(merged, { a: 1, b: 2, status: "active" });
});

Deno.test("mergeUpdates: does not mutate the input `current`", () => {
  const current = { themes: ["A"], contact: { person: "X" } };
  const merged = mergeUpdates(current, {
    themes: ["B"],
    contact: { phone: "9" },
  });
  assertNotStrictEquals(merged, current);
  assertEquals(current.themes, ["A"]); // unchanged
  assertEquals(current.contact, { person: "X" }); // unchanged
});

Deno.test("mergeUpdates: explicit false / 0 overwrite (they are real values)", () => {
  const merged = mergeUpdates(
    { active: true, count: 5 },
    { active: false, count: 0 },
  );
  assertEquals(merged.active, false);
  assertEquals(merged.count, 0);
});

// REGRESSION GUARD (audit finding, HIGH): a blank text field arrives as '' from
// the admin form's .trim() and must NOT erase populated data — same wipe class
// as the empty-array case.
Deno.test("mergeUpdates: empty string does NOT clobber a populated field", () => {
  const current = {
    description: "24 years of community work",
    website: "https://example.org",
    contact: { person: "Rekha Chari", phone: "9844086982" },
  };
  const merged = mergeUpdates(current, {
    description: "",
    website: "",
    contact: { phone: "" },
  });
  assertEquals(merged.description, "24 years of community work");
  assertEquals(merged.website, "https://example.org");
  // deep-merged object: blank phone must not wipe the real phone
  assertEquals(merged.contact, { person: "Rekha Chari", phone: "9844086982" });
});

Deno.test("mergeUpdates: a non-empty string DOES replace the existing value", () => {
  const merged = mergeUpdates({ note: "old" }, { note: "new" });
  assertEquals(merged.note, "new");
});

// ---------------------------------------------------------------------------
// markdown frontmatter round-trip
// ---------------------------------------------------------------------------

Deno.test("parse/generate markdown frontmatter round-trips", () => {
  const original = generateMarkdownFile(
    { name: "Test", themes: ["A", "B"] },
    "\nBody text here.\n",
  );
  const { frontmatter, body } = parseMarkdownFile(original);
  assertEquals(frontmatter.name, "Test");
  assertEquals(frontmatter.themes, ["A", "B"]);
  assertEquals(body.trim(), "Body text here.");
});

Deno.test("parseMarkdownFile: content without frontmatter returns empty frontmatter", () => {
  const { frontmatter, body } = parseMarkdownFile("just a body, no fence");
  assertEquals(frontmatter, {});
  assertEquals(body, "just a body, no fence");
});
