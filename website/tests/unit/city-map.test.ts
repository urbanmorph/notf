// deno-lint-ignore-file no-import-prefix
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// city-map.js and map-projection.js are classic browser scripts. Load them as one
// module (projection first, as the pages do) with exports appended, so the pure
// helpers can be tested. DOM wiring only runs when `document` exists.
const read = (p: string) =>
  Deno.readTextFile(new URL(`../../public/assets/js/${p}`, import.meta.url));
const src = (await read("map-projection.js")) + "\n" +
  (await read("city-map.js"));
const mod = await import(
  "data:text/javascript," +
    encodeURIComponent(
      src +
        "\nexport { CITY_POINTS, normaliseCity, countByCity, bubbleRadius, placeLabels, projectPoint };",
    )
);
const { CITY_POINTS, normaliseCity, countByCity, bubbleRadius, placeLabels } =
  mod;

Deno.test("normaliseCity tidies the city names communities type in", () => {
  assertEquals(normaliseCity("Bengaluru"), "Bengaluru");
  assertEquals(normaliseCity(" bengaluru "), "Bengaluru");
  assertEquals(normaliseCity("Bangalore"), "Bengaluru");
  assertEquals(normaliseCity("Karnataka, Bengaluru"), "Bengaluru");
  assertEquals(normaliseCity("Bombay"), "Mumbai");
  assertEquals(normaliseCity("pune"), "Pune");
  assertEquals(normaliseCity("Some New Town"), "Some New Town");
  assertEquals(normaliseCity(""), "");
  assertEquals(normaliseCity(null), "");
});

Deno.test("countByCity counts each item once per city, busiest first, then by name", () => {
  const items = [
    { cities: ["Mumbai", "Bengaluru"] },
    { cities: ["Bengaluru", "bangalore"] }, // same city twice: counted once
    { cities: ["Chennai"] },
    { cities: ["Mumbai"] },
    { cities: [] },
  ];
  const rows = countByCity(items, (i: { cities: string[] }) => i.cities);
  assertEquals(
    rows.map((r: { city: string; count: number }) => [r.city, r.count]),
    [["Bengaluru", 2], ["Mumbai", 2], ["Chennai", 1]],
  );
  assertEquals(rows[0].point, CITY_POINTS.Bengaluru);
});

Deno.test("countByCity keeps cities it can't place, with no point", () => {
  const rows = countByCity([{ c: "Atlantis" }], (i: { c: string }) => [i.c]);
  assertEquals(rows, [{ city: "Atlantis", count: 1, point: null }]);
});

Deno.test("bubbleRadius grows with the count, by area, within bounds", () => {
  assertEquals(bubbleRadius(1, 1), bubbleRadius(40, 40));
  assert(bubbleRadius(1, 40) < bubbleRadius(10, 40));
  assert(bubbleRadius(10, 40) < bubbleRadius(40, 40));
  assert(bubbleRadius(1, 40) >= 5);
  assert(bubbleRadius(40, 40) <= 28);
});

Deno.test("placeLabels labels the biggest bubbles and skips labels that would overlap", () => {
  const placed = placeLabels([
    { city: "Mumbai", x: 100, y: 100, r: 20 },
    { city: "Thane", x: 105, y: 95, r: 8 }, // on top of Mumbai's label
    { city: "Kochi", x: 100, y: 400, r: 6 },
  ]);
  assertEquals(placed.map((l: { city: string }) => l.city), [
    "Mumbai",
    "Kochi",
  ]);
});

Deno.test("every catalogue project lists its cities, and every city can be placed on the map", async () => {
  const dataJs = await Deno.readTextFile(
    new URL("../../public/catalog/catalog-data.js", import.meta.url),
  );
  const g = globalThis as unknown as { window?: Record<string, unknown> };
  g.window = g.window ?? {};
  (0, eval)(dataJs);
  const projects = g.window.CATALOG_PROJECTS as Array<
    { id: number; cities?: string[] }
  >;
  const problems: string[] = [];
  for (const p of projects) {
    if (!Array.isArray(p.cities)) {
      problems.push(`#${p.id} has no cities list`);
      continue;
    }
    if (new Set(p.cities).size !== p.cities.length) {
      problems.push(`#${p.id} repeats a city`);
    }
    for (const c of p.cities) {
      if (normaliseCity(c) !== c) {
        problems.push(`#${p.id} "${c}" isn't the canonical name`);
      }
      if (!CITY_POINTS[c]) problems.push(`#${p.id} "${c}" has no map point`);
    }
  }
  assertEquals(problems, []);
});

Deno.test("every city point sits inside the India outline's box", async () => {
  const outlineJs = await read("india-outline.js");
  const g = globalThis as unknown as { window?: Record<string, unknown> };
  g.window = g.window ?? {};
  (0, eval)(outlineJs);
  const { bbox, width } = g.window.INDIA_OUTLINE as {
    bbox: number[];
    width: number;
  };
  const off = Object.entries(CITY_POINTS as Record<string, [number, number]>)
    .filter(([, [lat, lon]]) =>
      mod.projectPoint(lon, lat, bbox, width) === null
    )
    .map(([c]) => c);
  assertEquals(off, []);
});
