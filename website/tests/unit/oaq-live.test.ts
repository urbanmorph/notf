// deno-lint-ignore-file no-import-prefix
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// oaq-live.js is a classic browser script (no ESM exports) that uses projectPoint
// from map-projection.js. Load both as one module, with exports appended, so the
// pure helpers can be unit-tested in Deno. DOM wiring only runs when `document` exists.
const read = (p: string) =>
  Deno.readTextFile(new URL(`../../public/assets/js/${p}`, import.meta.url));
const src = (await read("map-projection.js")) + "\n" +
  (await read("oaq-live.js"));
const mod = await import(
  "data:text/javascript," +
    encodeURIComponent(
      src + "\nexport { aqiBand, projectPoint, summariseStations };",
    )
);
const { aqiBand, projectPoint, summariseStations } = mod;

Deno.test("aqiBand follows the CPCB AQI bands, inclusive upper bounds", () => {
  const key = (aqi: number) => aqiBand(aqi).key;
  assertEquals(key(0), "good");
  assertEquals(key(50), "good");
  assertEquals(key(51), "satisfactory");
  assertEquals(key(100), "satisfactory");
  assertEquals(key(101), "moderate");
  assertEquals(key(200), "moderate");
  assertEquals(key(201), "poor");
  assertEquals(key(300), "poor");
  assertEquals(key(301), "very-poor");
  assertEquals(key(400), "very-poor");
  assertEquals(key(401), "severe");
  assertEquals(key(999), "severe");
});

const station = (provider: string, city: string, aqi: number | null) => ({
  provider,
  city,
  aqi,
});

Deno.test("summariseStations counts stations, cities and networks", () => {
  const s = summariseStations([
    station("cpcb", "Bengaluru", 100),
    station("airview", "Bengaluru", 120),
    station("cpcb", "Delhi", 300),
    station("aurassure", "", 40), // no city: counted as a station, not a city
  ], []);
  assertEquals(s.stations, 4);
  assertEquals(s.cities, 2);
  assertEquals(s.networks, 3);
});

Deno.test("summariseStations gives each requested city its median AQI, in the requested order", () => {
  const s = summariseStations([
    station("cpcb", "Delhi", 300),
    station("cpcb", "Bengaluru", 100),
    station("cpcb", "Bengaluru", 120),
    station("cpcb", "Bengaluru", 500),
    station("cpcb", "Mumbai", 40),
    station("cpcb", "Mumbai", 61), // even count: mean of the middle two, rounded
  ], ["Bengaluru", "Mumbai", "Delhi"]);
  assertEquals(
    s.now.map((c: { city: string; aqi: number }) => [c.city, c.aqi]),
    [
      ["Bengaluru", 120],
      ["Mumbai", 51],
      ["Delhi", 300],
    ],
  );
  assertEquals(s.now[1].band.key, "satisfactory");
});

Deno.test("summariseStations skips cities with no reporting station and stations without an AQI", () => {
  const s = summariseStations([
    station("cpcb", "Pune", null),
    station("cpcb", "Chennai", 55),
  ], ["Pune", "Chennai", "Kochi"]);
  assertEquals(s.now.map((c: { city: string }) => c.city), ["Chennai"]);
});

// Same equirectangular projection as scripts/build-oaq-outline.py, so live sensors
// land on the inline Bengaluru outline.
Deno.test("projectPoint maps the bbox corners to the SVG corners and drops points outside", () => {
  const bbox = [77.4, 12.8, 77.8, 13.2];
  const width = 600;
  const kx = Math.cos(((12.8 + 13.2) / 2) * Math.PI / 180);
  const height = width / kx; // lon and lat spans are equal here
  const round = (
    p: { x: number; y: number },
  ) => [Math.round(p.x), Math.round(p.y)];
  assertEquals(round(projectPoint(77.4, 13.2, bbox, width)), [0, 0]);
  assertEquals(round(projectPoint(77.8, 12.8, bbox, width)), [
    600,
    Math.round(height),
  ]);
  assertEquals(projectPoint(77.9, 13.0, bbox, width), null);
  assertEquals(projectPoint(77.5, 12.7, bbox, width), null);
  assertEquals(projectPoint(null, null, bbox, width), null);
});
