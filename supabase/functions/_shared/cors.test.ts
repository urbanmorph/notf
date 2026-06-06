import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ALLOWED_ORIGINS, getCorsHeaders } from "./cors.ts";

function reqWithOrigin(origin: string | null): Request {
  const headers = new Headers();
  if (origin !== null) headers.set("Origin", origin);
  return new Request("https://fn.example/functions/v1/update-file", {
    headers,
  });
}

Deno.test("getCorsHeaders: production origin www.notf.in is reflected (regression for the CORS outage)", () => {
  const h = getCorsHeaders(reqWithOrigin("https://www.notf.in"));
  assertEquals(h["Access-Control-Allow-Origin"], "https://www.notf.in");
  assertEquals(h["Access-Control-Allow-Credentials"], "true");
});

Deno.test("getCorsHeaders: apex notf.in is allowed", () => {
  const h = getCorsHeaders(reqWithOrigin("https://notf.in"));
  assertEquals(h["Access-Control-Allow-Origin"], "https://notf.in");
});

Deno.test("getCorsHeaders: an un-whitelisted origin gets NO allow-origin header", () => {
  const h = getCorsHeaders(reqWithOrigin("https://evil.example.com"));
  assertEquals(h["Access-Control-Allow-Origin"], undefined);
  // still returns the allow-headers fallback
  assertEquals(
    h["Access-Control-Allow-Headers"],
    "authorization, x-client-info, apikey, content-type",
  );
});

Deno.test("getCorsHeaders: no Origin header (server-to-server) gets no allow-origin", () => {
  const h = getCorsHeaders(reqWithOrigin(null));
  assertEquals(h["Access-Control-Allow-Origin"], undefined);
});

Deno.test("ALLOWED_ORIGINS includes both production hosts", () => {
  assertEquals(ALLOWED_ORIGINS.includes("https://www.notf.in"), true);
  assertEquals(ALLOWED_ORIGINS.includes("https://notf.in"), true);
});
