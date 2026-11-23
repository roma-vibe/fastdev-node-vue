import type { FastifyInstance } from 'fastify';

/**
 * Content-Security-Policy of the built web app (index.html). The Vite build needs nothing more:
 * scripts and styles are files in /assets (no inline code), API calls go to /api on the same
 * origin, and small images and fonts may be inlined as data: URIs. Read AGENTS.md "Security" before
 * changing it; never add 'unsafe-inline', 'unsafe-eval' or wildcard sources.
 */
export const PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Content-Security-Policy of every other response (JSON, assets): it may load nothing. */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'";

const COMMON_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  // An OAuth or payment popup that must talk back to this page (window.opener) needs
  // 'same-origin-allow-popups' on that page instead; keep same-origin everywhere else.
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
} as const;

export interface SecurityHeadersOptions {
  /** Send Strict-Transport-Security: only when the app is served over https (PUBLIC_URL). */
  hsts: boolean;
}

/**
 * Adds the security headers to every response: routes, errors, 404s and static files. Call it on
 * the root instance before any route is registered.
 */
export function registerSecurityHeaders(
  app: FastifyInstance,
  options: SecurityHeadersOptions,
): void {
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.headers(COMMON_HEADERS);
    if (options.hsts) reply.header('strict-transport-security', 'max-age=31536000');
    const contentType = String(reply.getHeader('content-type') ?? '');
    reply.header(
      'content-security-policy',
      contentType.startsWith('text/html') ? PAGE_CSP : API_CSP,
    );
    return payload;
  });
}
