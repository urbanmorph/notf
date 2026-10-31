// deno-lint-ignore-file no-import-prefix
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { type Key, pathToRegexp } from "https://esm.sh/path-to-regexp@6.2.1";

// Site-shape contract after the climate pages (2026-10) and then the /cities/
// section were retired, and the site-wide /map/ and /search/ pages were hidden
// pending the chapters phase. City views now live on /communities/ and /catalog/.

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

Deno.test("the /cities/ section is gone, but the ward boundary files stay", async () => {
  assert(
    !(await exists(new URL("cities/", PUBLIC))),
    "cities/ should be deleted",
  );
  assert(!(await exists(new URL("assets/js/pages/city-hub.js", PUBLIC))));
  assert(!(await exists(new URL("assets/css/pages/city-hub.css", PUBLIC))));
  // Kept for a later ward map, and used today by the chatbot's ward lookup.
  const index = JSON.parse(
    await Deno.readTextFile(
      new URL("assets/data/boundaries/index.json", PUBLIC),
    ),
  );
  assert(Object.keys(index).length > 0);
  for await (
    const e of walk(new URL("assets/data/boundaries/", PUBLIC), {
      exts: [".geojson"],
    })
  ) {
    assert((await Deno.stat(e.path)).size > 0, `${e.path} is empty`);
  }
});

Deno.test("nothing in the site links to the retired /cities/ pages", async () => {
  const offenders = (await publicSources())
    .filter(({ path }) => !path.includes("/i18n/locales/"))
    .filter(({ text }) => /["'`(]\/cities\//.test(text))
    .map(({ path }) => path);
  assertEquals(offenders, []);
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

Deno.test("every page with the chatbot loads the community data it searches", async () => {
  const missing = (await publicSources())
    .filter(({ path }) => path.endsWith(".html"))
    .filter(({ text }) =>
      text.includes("/assets/js/components/chatbot-loader.js")
    )
    .filter(({ text }) => !text.includes('src="/assets/js/data-loader.js"'))
    .map(({ path }) => path);
  assertEquals(missing, []);
});

Deno.test("the search log only lets visitors add rows, admins read, and expires", async () => {
  const sql = await Deno.readTextFile(
    new URL(
      "supabase/migrations/20261031120000_add_chat_searches.sql",
      ROOT,
    ),
  );
  assert(/ENABLE ROW LEVEL SECURITY/.test(sql));
  assert(
    /REVOKE ALL ON public\.chat_searches FROM anon, authenticated/.test(sql),
  );
  // anon may only INSERT; nobody may UPDATE or DELETE through the API.
  const grants = [...sql.matchAll(/GRANT (\w+)[^;]* TO ([^;]+);/g)].map((
    m,
  ) => `${m[1]} ${m[2]}`);
  assertEquals(grants, ["INSERT anon, authenticated", "SELECT authenticated"]);
  assert(
    /FOR SELECT TO authenticated\s+USING \(EXISTS \(SELECT 1 FROM public\.admin_users/
      .test(sql),
  );
  assert(/interval '90 days'/.test(sql));
  // No visitor identifiers among the table's columns.
  const columns = sql.slice(
    sql.indexOf("CREATE TABLE"),
    sql.indexOf("CREATE INDEX"),
  )
    .replace(/--.*$/gm, "");
  assert(
    !/\b(ip|ip_address|user_agent|visitor_id|session_id)\b/i.test(columns),
  );
});

Deno.test("admin_users is no longer readable by everyone: own row, or all for super admins", async () => {
  const sql = await Deno.readTextFile(
    new URL(
      "supabase/migrations/20261031150000_lock_down_admin_users_read.sql",
      ROOT,
    ),
  );
  assert(
    /DROP POLICY IF EXISTS admin_users_read ON public\.admin_users/.test(sql),
  );
  assert(/REVOKE ALL ON public\.admin_users FROM anon/.test(sql));
  // Every SELECT policy is for signed-in users only, and none is open (USING true).
  const selects = [...sql.matchAll(/CREATE POLICY [^;]*?FOR SELECT[^;]*;/g)]
    .map((m) => m[0]);
  assertEquals(selects.length, 2);
  for (const p of selects) {
    assert(/TO authenticated/.test(p), p);
    assert(!/USING \(true\)/i.test(p), p);
  }
  assert(selects.some((p) => /USING \(user_id = auth\.uid\(\)\)/.test(p)));
  // The super-admin check reads admin_users without recursing into its own policy.
  assert(
    /FUNCTION public\.is_super_admin\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/
      .test(sql),
  );
  assert(
    /REVOKE ALL ON FUNCTION public\.is_super_admin\(\) FROM PUBLIC, anon/.test(
      sql,
    ),
  );
});

// Vercel matches redirect sources with path-to-regexp 6, so test with it rather
// than an approximation (two hand-rolled matchers each let a broken rule ship).
function resolveRedirect(
  redirects: Array<{ source: string; destination: string }>,
  path: string,
): string | null {
  for (const r of redirects) {
    const keys: Key[] = [];
    const m = pathToRegexp(r.source, keys).exec(path);
    if (!m) continue;
    const params = Object.fromEntries(
      keys.map((k, i) => [k.name, m[i + 1] ?? ""]),
    );
    return r.destination.replace(/:(\w+)/g, (_, k) => params[k] ?? "");
  }
  return null;
}

Deno.test("retired URLs redirect permanently, with or without a trailing slash", async () => {
  const cfg = JSON.parse(await Deno.readTextFile(new URL("vercel.json", ROOT)));
  const redirects: Array<
    { source: string; destination: string; permanent: boolean }
  > = cfg.redirects ?? [];
  for (const r of redirects) {
    assert(r.permanent, `${r.source} should be permanent`);
  }
  // Every old link ended in "/", which `:path*` alone does not match on Vercel.
  const cases: Array<[string, string]> = [
    ["/cities/bengaluru/climate/air-quality/", "https://oaq.notf.in"],
    ["/cities/bengaluru/climate/air-quality", "https://oaq.notf.in"],
    // City views now live on /communities/ as a city filter, in one hop.
    ["/cities/bengaluru/climate/", "/communities/?city=bengaluru"],
    [
      "/cities/bengaluru/climate/energy/wards/a-adugodi/",
      "/communities/?city=bengaluru",
    ],
    ["/cities/mumbai/climate/waste/leaderboard/", "/communities/?city=mumbai"],
    ["/cities/bengaluru/communities/", "/communities/?city=bengaluru"],
    ["/cities/bengaluru/communities", "/communities/?city=bengaluru"],
    ["/cities/bengaluru/", "/communities/?city=bengaluru"],
    ["/cities/pune", "/communities/?city=pune"],
    ["/cities/mumbai/map/", "/communities/?city=mumbai"],
    ["/cities/bengaluru/stories/", "/stories/"],
    ["/cities/chennai/stories", "/stories/"],
    ["/cities/bengaluru/solution-providers/", "/solution-providers/"],
    ["/cities/", "/communities/"],
    ["/cities", "/communities/"],
  ];
  for (const [from, to] of cases) {
    assertEquals(resolveRedirect(redirects, from), to, from);
  }
  // Pages that still exist must not be caught.
  for (
    const path of [
      "/communities/",
      "/catalog/",
      "/stories/",
      "/citizens/",
    ]
  ) {
    assertEquals(resolveRedirect(redirects, path), null, path);
  }
});

Deno.test("every i18n key used on the home, communities and catalogue pages, header and chatbot exists in all 11 locales", async () => {
  const sources = (await Promise.all(
    [
      "index.html",
      "communities/index.html",
      "catalog/index.html",
      "assets/js/components/header.js",
      "assets/js/components/chatbot-loader.js",
      "assets/chat/unified-chatbot.js",
    ].map((p) => Deno.readTextFile(new URL(p, PUBLIC))),
  )).join("\n");
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

Deno.test("no locale keeps strings for the retired climate and /cities/ pages", async () => {
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
      // /cities/ section
      data.cityHub && "cityHub",
      data.citySelector && "citySelector",
      data.citiesPage && "citiesPage",
      data.nav?.cities && "nav.cities",
      data.statsNav?.citiesTitle && "statsNav.citiesTitle",
    ].filter(Boolean);
    assertEquals(leftovers, [], `${lang}.json`);
  }
});
