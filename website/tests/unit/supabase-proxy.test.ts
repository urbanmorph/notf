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

// ---------------------------------------------------------------------------
// Admin client (assets/admin/auth.js)
// ---------------------------------------------------------------------------

const authSrc = await Deno.readTextFile(
  new URL("../../public/assets/admin/auth.js", import.meta.url),
);

function loadAuth(win: any) {
  return new Function(
    "window",
    authSrc +
      "\nreturn { resolveSupabaseUrl, SUPABASE_URL, SUPABASE_PROJECT_URL, AUTH_STORAGE_KEY, getSupabaseAuthClient };",
  )(win);
}

// The key supabase-js derived from the direct project URL before the proxy
// switch (`sb-<first hostname label>-auth-token`). Admin sessions live here.
const LEGACY_AUTH_KEY = `sb-${new URL(PROJECT_URL).hostname.split(".")[0]}-auth-token`;

Deno.test("auth.js: resolves the same proxy URL as data-loader.js for every input", () => {
  const auth = loadAuth({});
  const loader = loadDataLoader({});
  const inputs = [
    undefined,
    {},
    { location: {} },
    { location: { origin: "null" } },
    { location: { origin: "https://www.notf.in" } },
    { location: { origin: "http://localhost:5173" } },
  ];
  for (const w of inputs) {
    assertEquals(auth.resolveSupabaseUrl(w), loader.resolveSupabaseUrl(w));
  }
  assertEquals(auth.SUPABASE_PROJECT_URL, PROJECT_URL);
});

Deno.test("auth.js: admin client uses the proxy and keeps the legacy session storage key", () => {
  const calls: Array<{ url: string; opts: any }> = [];
  const win = {
    location: { origin: "https://www.notf.in" },
    supabase: {
      createClient(url: string, _key: string, opts: any) {
        calls.push({ url, opts });
        return {};
      },
    },
  };
  const { SUPABASE_URL, AUTH_STORAGE_KEY, getSupabaseAuthClient } = loadAuth(win);
  assertEquals(SUPABASE_URL, "https://www.notf.in/api/supabase");
  // Without a pinned key the SDK would derive `sb-www-auth-token` from the new
  // URL and silently log every admin out.
  assertEquals(AUTH_STORAGE_KEY, LEGACY_AUTH_KEY);
  getSupabaseAuthClient();
  getSupabaseAuthClient(); // lazy: one client only
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, "https://www.notf.in/api/supabase");
  assertEquals(calls[0].opts?.auth?.storageKey, LEGACY_AUTH_KEY);
});

Deno.test("auth.js: anon key stays readable by scripts/check-catalogue-consistency.mjs", () => {
  // That script extracts the key with this exact regex.
  const anon = authSrc.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)?.[1];
  assertEquals(typeof anon, "string");
  assertEquals(anon!.split(".").length, 3);
});

// ---------------------------------------------------------------------------
// Chatbot CMS client (assets/chat/notf-cms-api.js)
// ---------------------------------------------------------------------------

Deno.test("notf-cms-api.js: Supabase URL defaults to the same-origin proxy", async () => {
  const src = await Deno.readTextFile(
    new URL("../../public/assets/chat/notf-cms-api.js", import.meta.url),
  );
  const NotfCmsApi = new Function("window", src + "\nreturn NotfCmsApi;")({
    location: { origin: "https://www.notf.in" },
  });
  const api = new NotfCmsApi();
  assertEquals(api.supabaseUrl, "https://www.notf.in/api/supabase");
  // Complaints still go to the separate notf-cms app, untouched.
  assertEquals(api.apiBaseUrl, "https://notf-cms.vercel.app/api");
});

// ---------------------------------------------------------------------------
// Regression guard: no shipped browser code targets *.supabase.co directly
// ---------------------------------------------------------------------------

Deno.test("shipped JS/HTML only references supabase.co as the SUPABASE_PROJECT_URL fallback", async () => {
  const root = new URL("../../public/", import.meta.url);
  const offenders: string[] = [];
  async function walk(dir: URL) {
    for await (const e of Deno.readDir(dir)) {
      if (e.name === "node_modules") continue;
      const u = new URL(e.name + (e.isDirectory ? "/" : ""), dir);
      if (e.isDirectory) await walk(u);
      else if (/\.(js|html)$/.test(e.name)) {
        const lines = (await Deno.readTextFile(u)).split("\n");
        lines.forEach((line, i) => {
          if (!/[a-z0-9]\.supabase\.co\b/i.test(line)) return;
          const t = line.trim();
          if (t.startsWith("//") || t.startsWith("*")) return; // comments
          if (/const SUPABASE_PROJECT_URL\s*=/.test(t)) return; // the one fallback
          offenders.push(`${u.pathname.split("/public/")[1]}:${i + 1}: ${t.slice(0, 100)}`);
        });
      }
    }
  }
  await walk(root);
  assertEquals(offenders, [], `direct *.supabase.co references:\n${offenders.join("\n")}`);
});
