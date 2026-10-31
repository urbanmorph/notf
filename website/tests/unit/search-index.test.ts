// deno-lint-ignore-file no-import-prefix
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// search-index.js is a classic browser script; load it as a module with exports appended.
const src = await Deno.readTextFile(
  new URL("../../public/assets/chat/search-index.js", import.meta.url),
);
const { buildSearchIndex, searchIndex, tokenize } = await import(
  "data:text/javascript," +
    encodeURIComponent(
      src + "\nexport { buildSearchIndex, searchIndex, tokenize };",
    )
);

// Shaped like the live records: communities carry domains/themes, asks and offers;
// providers carry theme, location and offers.
const RESOURCES = [
  {
    name: "Malleshwaram Swabhimana Forum",
    neighborhood: "Malleshwaram",
    domains: ["mobility", "public-spaces"],
    offers: ["Footpath improvement advocacy experience"],
    asks: ["Street design"],
  },
  {
    name: "Rajajinagar Eco Warriors",
    domains: ["waste", "composting", "urban-farming"],
    offers: ["Apartment composting setup and training"],
    asks: ["Funding for community composting hub"],
  },
  {
    name: "Hebbal Lake Preservation Forum",
    domains: ["lake-restoration", "biodiversity", "birding"],
    offers: ["Lake ecosystem education programs"],
    asks: ["Funding for continuous lake monitoring"],
  },
  {
    name: "Vijayanagar Green Forum",
    domains: ["trees", "public-spaces"],
    offers: ["Tree census methodology and volunteer training"],
    asks: ["Volunteers for weekend plantation drives"],
  },
  {
    name: "Greenway Schools Trust",
    theme: "Education",
    offers: ["School environmental education programs for children"],
  },
  {
    name: "City Water Fund",
    theme: "Water",
    offers: ["Grants and funding for rainwater harvesting projects"],
  },
];
const index = buildSearchIndex(RESOURCES);
const top = (q: string, n = 1) =>
  searchIndex(index, q).slice(0, n).map((
    r: { resource: { name: string } },
  ) => r.resource.name);
const all = (q: string) => top(q, 99);

Deno.test("tokenize splits tags, drops filler words, and folds plurals", () => {
  assertEquals(tokenize("Lake-restoration groups near the schools"), [
    "lake",
    "restoration",
    "school",
  ]);
  assertEquals(tokenize("Composting, planting & walking"), [
    "compost",
    "plant",
    "walk",
  ]);
});

Deno.test("everyday words find the words the data uses", () => {
  assertEquals(top("people fixing footpaths for walking"), [
    "Malleshwaram Swabhimana Forum",
  ]);
  assertEquals(top("garbage segregation"), ["Rajajinagar Eco Warriors"]);
  assertEquals(top("kids"), ["Greenway Schools Trust"]);
  // Education and nature records, not waste, water funding or mobility.
  const nature = all("kids learning about nature");
  assert(nature.includes("Greenway Schools Trust"));
  for (
    const off of [
      "Rajajinagar Eco Warriors",
      "City Water Fund",
      "Malleshwaram Swabhimana Forum",
    ]
  ) assert(!nature.includes(off), off);
});

Deno.test("words in other Indian languages find the same records", () => {
  assertEquals(top("मेरे इलाके में कचरा प्रबंधन"), [
    "Rajajinagar Eco Warriors",
  ]); // Hindi: waste
  assertEquals(top("ಕೆರೆ"), ["Hebbal Lake Preservation Forum"]); // Kannada: lake
  assertEquals(top("पेड़ों"), ["Vijayanagar Green Forum"]); // Hindi, inflected: trees
  assertEquals(top("மரங்கள்"), ["Vijayanagar Green Forum"]); // Tamil: trees
});

Deno.test("small typos still match names and words", () => {
  assertEquals(top("Malleswaram"), ["Malleshwaram Swabhimana Forum"]);
  assertEquals(top("compostng"), ["Rajajinagar Eco Warriors"]);
});

Deno.test("asking for help finds who offers it, not who also needs it", () => {
  assertEquals(top("need funding for rainwater harvesting"), [
    "City Water Fund",
  ]);
  assertEquals(top("we need volunteers"), ["Vijayanagar Green Forum"]);
});

Deno.test("weak matches are dropped rather than padding the list", () => {
  assertEquals(all("tree planting"), ["Vijayanagar Green Forum"]);
  assertEquals(all("lake"), ["Hebbal Lake Preservation Forum"]);
  assertEquals(all("xylophone"), []);
  assertEquals(all("धन्यवाद"), []); // "thank you" must not match धन (money)
  assertEquals(all(""), []);
});

Deno.test("a keep filter limits results, and scores are ranked", () => {
  const results = searchIndex(
    index,
    "funding",
    (r: { theme?: string }) => !r.theme,
  );
  assert(results.length > 0);
  assert(
    results.every((r: { resource: { theme?: string } }) => !r.resource.theme),
  );
  for (let i = 1; i < results.length; i++) {
    assert(results[i - 1].score >= results[i].score);
  }
});
