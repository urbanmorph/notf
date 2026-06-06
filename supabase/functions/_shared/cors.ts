// Shared CORS handling for the admin Edge Functions.
//
// A stale per-function whitelist (missing https://www.notf.in, the live
// production origin) caused preflights to succeed without an
// Access-Control-Allow-Origin header, so browsers silently blocked the POST
// ("Failed to send a request to the Edge Function"). Centralizing the list
// here prevents that drift across functions.

export const ALLOWED_ORIGINS = [
  "https://www.notf.in", // production (canonical, post-redirect)
  "https://notf.in", // production (apex, pre-redirect)
  "https://notf.vercel.app",
  "https://www.notf.org",
  "http://localhost:3000", // Development only
  "http://localhost:5173", // Vite dev server
];

/**
 * Build CORS response headers for a request. If the request Origin is on the
 * allowlist, reflect it (with credentials); otherwise omit
 * Access-Control-Allow-Origin so browsers block the cross-origin call.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Credentials": "true",
    };
  }
  // Fallback for non-CORS (direct/server-to-server) callers.
  return {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}
