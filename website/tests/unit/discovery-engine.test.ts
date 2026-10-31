// deno-lint-ignore-file no-import-prefix
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// discovery-engine.js is a classic browser script that uses city-map.js (city
// helpers) and search-index.js (ranking). Load all three as one module, with
// exports appended.
const read = (p: string) =>
  Deno.readTextFile(new URL(`../../public/assets/${p}`, import.meta.url));
const src = (await Promise.all(
  ["js/city-map.js", "chat/search-index.js", "chat/discovery-engine.js"].map(
    read,
  ),
)).join("\n");
const { DiscoveryEngine } = await import(
  "data:text/javascript," +
    encodeURIComponent(src + "\nexport { DiscoveryEngine };")
);

const engine = new DiscoveryEngine(
  [
    { name: "Koramangala RWA", city: "Bengaluru", themes: ["waste", "water"] },
    { name: "Biome", city: "bangalore", themes: ["water"] },
    { name: "Shavira Residency", city: "Pune", themes: ["water"] },
  ],
  [{
    name: "Waste Warriors",
    location: "Bengaluru, Karnataka",
    domains: ["waste"],
  }],
);
const names = (rs: Array<{ name: string }>) => rs.map((r) => r.name).sort();

Deno.test("a city in the question keeps every result in that city", async () => {
  assertEquals(names(await engine.search("Pune")), ["Shavira Residency"]);
  assertEquals(names(await engine.search("water in Bangalore")), [
    "Biome",
    "Koramangala RWA",
  ]);
  assertEquals(
    names(await engine.search("communities working on waste in Bengaluru")),
    [
      "Koramangala RWA",
    ],
  );
});

Deno.test("a city with nobody registered gives no results, not other cities", async () => {
  assertEquals(await engine.search("communities in Mumbai"), []);
  assertEquals(await engine.search("water in Mumbai"), []);
});

Deno.test("without a city, search still covers every city", async () => {
  assertEquals(names(await engine.search("water")), [
    "Biome",
    "Koramangala RWA",
    "Shavira Residency",
  ]);
});

Deno.test("resourcesIn counts communities and providers in a city", () => {
  assertEquals(engine.resourcesIn("Bengaluru").length, 3);
  assertEquals(engine.resourcesIn("Mumbai").length, 0);
});
