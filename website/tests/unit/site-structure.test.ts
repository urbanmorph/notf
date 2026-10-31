// deno-lint-ignore-file no-import-prefix
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

// Site-shape contract after the climate pages were retired (2026-10) and the
// site-wide /map/ and /search/ pages were hidden pending the chapters phase.

const PUBLIC = new URL("../../public/", import.meta.url);
const ROOT = new URL("../../../", import.meta.url);
const LOCALES = [
  "en",
  "hi",
  "kn",
  "mr",
  "ta",
  "te",
  "gu",
  "bn",
  "ml",
  "or",
  "ur",
];

const exists = async (url: URL) => {
  try {
    await Deno.stat(url);
    return true;
  } catch {
    return false;
  }
};

async function publicSources(): Promise<Array<{ path: string; text: string }>> {
  const out = [];
  for await (
    const e of walk(PUBLIC, {
      exts: [".html", ".js", ".json", ".xml"],
      includeDirs: false,
    })
  ) {
    out.push({ path: e.path, text: await Deno.readTextFile(e.path) });
  }
  return out;
}

Deno.test("the climate pages and their assets are gone", async () => {
  for (
    const p of [
      "cities/bengaluru/climate/",
      "cities/mumbai/climate/",
      "assets/js/climate/",
      "assets/data/climate/",
    ]
  ) {
    assert(!(await exists(new URL(p, PUBLIC))), `${p} should be deleted`);
  }
});

Deno.test("nothing in the site links to or loads the retired climate pages", async () => {
  const offenders = (await publicSources())
    .filter(({ text }) => /\/climate\/|assets\/(js|data)\/climate/.test(text))
    .map(({ path }) => path);
  assertEquals(offenders, []);
});

Deno.test("the sitemap lists only pages that exist, without the hidden /map/ and /search/", async () => {
  const xml = await Deno.readTextFile(new URL("sitemap.xml", PUBLIC));
  const paths = [...xml.matchAll(/<loc>https:\/\/notf\.in(\/[^<]*)<\/loc>/g)]
    .map((m) => m[1]);
  assert(paths.length > 0);
  assert(!paths.includes("/map/"), "/map/ is hidden");
  assert(!paths.includes("/search/"), "/search/ is hidden");
  for (const p of paths) {
    assert(
      await exists(new URL(`.${p}index.html`, PUBLIC)),
      `sitemap lists missing page ${p}`,
    );
  }
});

Deno.test("the hidden /map/ and /search/ pages ask search engines not to index them", async () => {
  for (const p of ["map/index.html", "search/index.html"]) {
    const html = await Deno.readTextFile(new URL(p, PUBLIC));
    assert(
      /<meta name="robots" content="noindex/.test(html),
      `${p} needs a noindex robots meta`,
    );
  }
});

Deno.test("old climate URLs redirect permanently: air quality to OAQ, the rest to the city page", async () => {
  const cfg = JSON.parse(await Deno.readTextFile(new URL("vercel.json", ROOT)));
  const redirects: Array<
    { source: string; destination: string; permanent: boolean }
  > = cfg.redirects ?? [];
  const find = (source: string) => redirects.find((r) => r.source === source);
  assertEquals(
    find("/cities/:city/climate/air-quality/:path*")?.destination,
    "https://oaq.notf.in",
  );
  assertEquals(
    find("/cities/:city/climate/:path*")?.destination,
    "/cities/:city/",
  );
  for (const r of redirects) {
    assert(r.permanent, `${r.source} should be permanent`);
  }
  // Vercel uses the first match, so the air-quality rule must come first.
  const idx = (s: string) => redirects.findIndex((r) => r.source === s);
  assert(
    idx("/cities/:city/climate/air-quality/:path*") <
      idx("/cities/:city/climate/:path*"),
  );
});

Deno.test("every i18n key used on the home page and header exists in all 11 locales", async () => {
  const sources = [
    await Deno.readTextFile(new URL("index.html", PUBLIC)),
    await Deno.readTextFile(new URL("assets/js/components/header.js", PUBLIC)),
  ].join("\n");
  const keys = new Set(
    [...sources.matchAll(
      /data-i18n(?:-aria|-title|-placeholder)?="([a-zA-Z0-9_.]+)"/g,
    )].map((m) => m[1]),
  );
  const missing: string[] = [];
  for (const lang of LOCALES) {
    const data = JSON.parse(
      await Deno.readTextFile(
        new URL(`assets/i18n/locales/${lang}.json`, PUBLIC),
      ),
    );
    for (const k of keys) {
      const v = k.split(".").reduce(
        (o: Record<string, unknown> | undefined, part) => o?.[part] as never,
        data,
      );
      if (typeof v !== "string" || !v.trim()) missing.push(`${lang}:${k}`);
    }
  }
  assertEquals(missing, []);
});

Deno.test("no locale keeps climate-dashboard strings", async () => {
  for (const lang of LOCALES) {
    const data = JSON.parse(
      await Deno.readTextFile(
        new URL(`assets/i18n/locales/${lang}.json`, PUBLIC),
      ),
    );
    const leftovers = [
      data.homepage?.climateStats && "homepage.climateStats",
      data.mumbai_climate && "mumbai_climate",
      data.climate && "climate",
      data.mumbai?.climate && "mumbai.climate",
      data.cityHub?.features?.climate && "cityHub.features.climate",
      data.cityHub?.nav?.climate && "cityHub.nav.climate",
      data.citySelector?.climateDashboard && "citySelector.climateDashboard",
    ].filter(Boolean);
    assertEquals(leftovers, [], `${lang}.json`);
  }
});
