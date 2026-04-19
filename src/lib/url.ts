// ============================================
// Base URL derivation
// ============================================
// Derives the application's base URL from the incoming request. This is the
// source of truth for OAuth redirect URIs and outbound same-origin fetches, so
// the app works correctly on any host (localhost, production, preview URLs,
// custom domains) without relying on a NEXT_PUBLIC_APP_URL env var that can
// drift out of sync with the actual deployment URL.
//
// Order of precedence:
//   1. `x-forwarded-proto` + `x-forwarded-host` (Render, Vercel, Fly.io, etc.)
//   2. `host` header + protocol inferred from request URL
//   3. NEXT_PUBLIC_APP_URL env var (fallback for background jobs with no request)

export function getBaseUrl(request?: Request): string {
  if (request) {
    const headers = request.headers;
    const forwardedHost = headers.get('x-forwarded-host');
    const forwardedProto = headers.get('x-forwarded-proto');
    if (forwardedHost) {
      const proto = forwardedProto || 'https';
      return `${proto}://${forwardedHost}`;
    }
    const host = headers.get('host');
    if (host) {
      const proto = new URL(request.url).protocol.replace(':', '') || 'https';
      return `${proto}://${host}`;
    }
  }
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  return 'http://localhost:3000';
}
