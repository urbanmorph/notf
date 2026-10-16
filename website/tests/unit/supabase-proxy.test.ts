// deno-lint-ignore-file no-import-prefix no-explicit-any
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Guards the same-origin Supabase proxy (/api/supabase/*). The browser must only
// ever talk to our own origin, which forwards to the project host: Vercel via a
// rewrite in production, Vite via server.proxy in dev. These tests pin all three
// pieces (data-loader.js, vercel.json, vite.config.js) to the same project host
// so they cannot drift apart.

// data-loader.js is a classic browser script that touches `window` and
// `document` at top level. Evaluate it with minimal stand-ins and hand back the
// bindings under test.
const loaderSrc = await Deno.readTextFile(
  new URL("../../public/assets/js/data-loader.js", import.meta.url),
);

function loadDataLoader(win: any) {
  const doc = { querySelector: () => null };
  return new Function(
    "window",
    "document",
    loaderSrc +
      "\nreturn { resolveSupabaseUrl, SUPABASE_URL, SUPABASE_PROJECT_URL, getSupabaseClient };",
  )(win, doc);
}

const PROJECT_URL = "https://abblyaukkoxmgzwretvm.supabase.co";

Deno.test("resolveSupabaseUrl: browser origin routes through /api/supabase", () => {
  const { resolveSupabaseUrl } = loadDataLoader({});
  assertEquals(
    resolveSupabaseUrl({ location: { origin: "https://www.notf.in" } }),
    "https://www.notf.in/api/supabase",
  );
  assertEquals(
    resolveSupabaseUrl({ location: { origin: "http://localhost:5173" } }),
    "http://localhost:5173/api/supabase",
  );
});

Deno.test("resolveSupabaseUrl: falls back to the project host without a usable origin", () => {
  const { resolveSupabaseUrl } = loadDataLoader({});
  assertEquals(resolveSupabaseUrl(undefined), PROJECT_URL);
  assertEquals(resolveSupabaseUrl({}), PROJECT_URL);
  assertEquals(resolveSupabaseUrl({ location: {} }), PROJECT_URL);
  // file:// pages report the opaque origin as the string "null".
  assertEquals(resolveSupabaseUrl({ location: { origin: "null" } }), PROJECT_URL);
});

Deno.test("data-loader: SUPABASE_URL and the client use the same-origin proxy", () => {
  const created: string[] = [];
  const win = {
    location: { origin: "https://www.notf.in" },
    supabase: {
      createClient(url: string) {
        created.push(url);
        return {};
      },
    },
  };
  const { SUPABASE_URL, SUPABASE_PROJECT_URL, getSupabaseClient } = loadDataLoader(win);
  assertEquals(SUPABASE_PROJECT_URL, PROJECT_URL);
  assertEquals(SUPABASE_URL, "https://www.notf.in/api/supabase");
  getSupabaseClient();
  assertEquals(created, ["https://www.notf.in/api/supabase"]);
  // The browser never targets the third-party host directly.
  assertEquals(created.some((u) => u.includes("supabase.co")), false);
});

// Minimal Vercel `:path*` matcher, enough to prove the rewrite maps the paths
// the Supabase SDK builds onto the project host.
function applyRewrite(rule: { source: string; destination: string }, path: string) {
  const prefix = rule.source.replace("/:path*", "");
  if (path !== prefix && !path.startsWith(prefix + "/")) return null;
  return rule.destination.replace(":path*", path.slice(prefix.length + 1));
}

Deno.test("vercel.json: /api/supabase/:path* rewrites to the data-loader project host", async () => {
  const cfg = JSON.parse(
    await Deno.readTextFile(new URL("../../../vercel.json", import.meta.url)),
  );
  const rule = (cfg.rewrites ?? []).find((r: any) => r.source === "/api/supabase/:path*");
  assertEquals(!!rule, true, "missing /api/supabase rewrite in vercel.json");
  assertEquals(rule.destination, `${PROJECT_URL}/:path*`);
  assertEquals(
    applyRewrite(rule, "/api/supabase/rest/v1/file_metadata"),
    `${PROJECT_URL}/rest/v1/file_metadata`,
  );
  assertEquals(applyRewrite(rule, "/catalog/"), null);
  // Static hosting settings are untouched.
  assertEquals(cfg.outputDirectory, "website/public");
});

Deno.test("vite.config.js: dev proxy mirrors the production rewrite", async () => {
  const src = await Deno.readTextFile(new URL("../../vite.config.js", import.meta.url));
  // Swap the bare 'vite' import for an identity defineConfig so Deno can load it.
  const mod = await import(
    "data:text/javascript," +
      encodeURIComponent(
        src.replace(
          /import\s*\{\s*defineConfig\s*\}\s*from\s*['"]vite['"];?/,
          "const defineConfig = (c) => c;",
        ),
      )
  );
  const proxy = mod.default.server.proxy["/api/supabase"];
  assertEquals(proxy.target, PROJECT_URL);
  assertEquals(proxy.changeOrigin, true);
  assertEquals(
    proxy.rewrite("/api/supabase/rest/v1/file_metadata?select=*"),
    "/rest/v1/file_metadata?select=*",
  );
  assertEquals(mod.default.server.port, 5173);
});
