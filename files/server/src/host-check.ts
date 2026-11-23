import { STATUS_CODES } from 'node:http';
import type { FastifyInstance } from 'fastify';
import type { ErrorResponse } from './app.ts';

/** Names the app is opened with on this machine, accepted on any port. */
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** A Host header: a DNS name, an IPv4 address or a bracketed IPv6 address, then an optional port. */
const HOST_HEADER = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/;

export interface HostCheckOptions {
  publicUrl: string | undefined;
  allowedHosts: readonly string[];
}

/**
 * Answers 421 to every request whose Host header names a host the app does not serve. This stops
 * DNS rebinding: a page on attacker.example can point its own name at 127.0.0.1 and then call this
 * API from a visitor's browser as its "own" origin, but the Host header still says
 * attacker.example. Allowed: localhost, 127.0.0.1 and [::1] on any port, the PUBLIC_URL host and
 * ALLOWED_HOSTS. Register it on the root instance before any route.
 */
export function registerHostCheck(app: FastifyInstance, options: HostCheckOptions): void {
  const allowed = new Set([...LOOPBACK_HOSTS, ...options.allowedHosts]);
  if (options.publicUrl) allowed.add(new URL(options.publicUrl).hostname);

  app.addHook('onRequest', async (request, reply) => {
    const hostname = hostnameOf(request.headers.host);
    if (hostname !== undefined && allowed.has(hostname)) return;
    const body: ErrorResponse = {
      statusCode: 421,
      error: STATUS_CODES[421] ?? 'Misdirected Request',
      message: 'Unknown host',
    };
    return reply.code(421).send(body);
  });
}

/** The lowercase host name of a Host header without its port, or undefined when it is malformed. */
export function hostnameOf(header: string | undefined): string | undefined {
  return HOST_HEADER.exec((header ?? '').toLowerCase())?.[1];
}
