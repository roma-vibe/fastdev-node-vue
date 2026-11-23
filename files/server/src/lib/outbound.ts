/**
 * safeFetch(): the only way to request a URL that comes from a user, a model, a webhook or any
 * third party. It refuses URLs that could reach this machine or the local network (SSRF):
 *
 * - http and https only, no credentials in the URL, ports 80 and 443 unless the caller allows more;
 * - every address a host name resolves to must be public (lib/address-policy.ts), checked in the
 *   socket's own DNS lookup, so the connection goes only to an address that was checked;
 * - IP-literal hosts (http://127.0.0.1, http://[::ffff:7f00:1]) are checked the same way;
 * - redirects are followed by hand, at most 3, and every target is checked again; a redirect to
 *   another origin carries only the harmless headers of CROSS_ORIGIN_HEADERS;
 * - 10 s for the whole request and a 5 MB cap on the response body, enforced while streaming;
 * - HTTP_PROXY / HTTPS_PROXY are ignored on purpose: a proxy would connect in our place, so the
 *   address checks above would not apply to the real connection.
 */
import { lookup as dnsLookup } from 'node:dns';
import http, { type IncomingHttpHeaders, type IncomingMessage } from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { classifyAddress } from './address-policy.ts';

export type OutboundErrorCode =
  | 'invalid-url'
  | 'blocked-url'
  | 'blocked-address'
  | 'too-many-redirects'
  | 'too-large'
  | 'timeout'
  | 'aborted'
  | 'network';

export class OutboundError extends Error {
  readonly code: OutboundErrorCode;

  constructor(code: OutboundErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'OutboundError';
    this.code = code;
  }
}

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  /** For the whole request, redirects and body included. Default 10 000. */
  timeoutMs?: number;
  /** Largest accepted response body. Default 5 MB. */
  maxBytes?: number;
  /** Default 3. */
  maxRedirects?: number;
  /** Default [80, 443]. */
  allowedPorts?: readonly number[];
  signal?: AbortSignal;
}

export interface SafeResponse {
  status: number;
  /** The final URL, after redirects. */
  url: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
  text(): string;
  json<T = unknown>(): T;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
/**
 * The only caller headers that follow a redirect to another origin (content-type only with the
 * body it describes). Everything else, credentials and API keys of any name included, stays with
 * the origin it was meant for.
 */
const CROSS_ORIGIN_HEADERS = new Set(['accept', 'accept-language', 'user-agent']);

export async function safeFetch(
  input: string | URL,
  options: SafeFetchOptions = {},
): Promise<SafeResponse> {
  const { maxBytes = 5 * 1024 * 1024, maxRedirects = 3, allowedPorts = [80, 443] } = options;
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 10_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const headers = new Map(
    Object.entries(options.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  let method = (options.method ?? 'GET').toUpperCase();
  let body = options.body === undefined ? undefined : Buffer.from(options.body);
  let url = checkUrl(String(input), allowedPorts);

  for (let redirects = 0; ; redirects += 1) {
    const response = await guard(send(url, { method, headers, signal }, body), timeout);
    const status = response.statusCode ?? 0;
    const location = response.headers.location;
    if (!REDIRECT_STATUSES.has(status) || !location) {
      const data = await guard(readBody(response, maxBytes), timeout);
      return toSafeResponse(url, response, data);
    }

    // The redirect body is never read: close the connection instead of draining it.
    response.destroy();
    if (redirects >= maxRedirects) {
      throw new OutboundError('too-many-redirects', `More than ${maxRedirects} redirects`);
    }
    if (!URL.canParse(location, url.href)) {
      throw new OutboundError('invalid-url', 'Invalid redirect');
    }
    const next = checkUrl(new URL(location, url).href, allowedPorts);
    // Like fetch: 303 (and 301/302 after a POST) continue as a GET without the body.
    const toGet = status === 303 ? method !== 'HEAD' : status <= 302 && method === 'POST';
    if (toGet) {
      method = 'GET';
      body = undefined;
      headers.delete('content-type');
      headers.delete('content-length');
    }
    if (next.origin !== url.origin) keepCrossOriginHeaders(headers, body !== undefined);
    url = next;
  }
}

/** Removes every header that must not reach another origin (see CROSS_ORIGIN_HEADERS). */
export function keepCrossOriginHeaders(headers: Map<string, string>, hasBody: boolean): void {
  for (const name of headers.keys()) {
    const keep = CROSS_ORIGIN_HEADERS.has(name) || (hasBody && name === 'content-type');
    if (!keep) headers.delete(name);
  }
}

/** Checks a URL before any connection: protocol, credentials, port and IP-literal hosts. */
function checkUrl(input: string, allowedPorts: readonly number[]): URL {
  if (!URL.canParse(input)) throw new OutboundError('invalid-url', 'Invalid URL');
  const url = new URL(input);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new OutboundError('blocked-url', `Protocol ${url.protocol} is not allowed`);
  }
  if (url.username || url.password) {
    throw new OutboundError('blocked-url', 'URLs with credentials are not allowed');
  }
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  if (!allowedPorts.includes(port)) {
    throw new OutboundError('blocked-url', `Port ${port} is not allowed`);
  }
  // Sockets skip the DNS lookup for IP literals, so they are checked here.
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
  if (isIP(host)) assertPublic(host, host);
  return url;
}

function assertPublic(host: string, address: string): void {
  const refusal = refuse(host, address);
  if (refusal) throw refusal;
}

function refuse(host: string, address: string): OutboundError | undefined {
  const kind = classifyAddress(address);
  if (kind === 'public') return undefined;
  return new OutboundError('blocked-address', `${host} is a ${kind} address (${address})`);
}

/** DNS lookup of the socket: resolves every address and refuses the host if any is not public. */
const checkedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '');
    const [first] = addresses;
    if (!first) return callback(new OutboundError('network', `${hostname} has no address`), '');
    for (const { address } of addresses) {
      const refusal = refuse(hostname, address);
      if (refusal) return callback(refusal, '');
    }
    if (options.all) return callback(null, addresses);
    return callback(null, first.address, first.family);
  });
};

interface SendOptions {
  method: string;
  headers: Map<string, string>;
  signal: AbortSignal;
}

function send(url: URL, options: SendOptions, body: Buffer | undefined): Promise<IncomingMessage> {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    // agent: false: a fresh connection made through checkedLookup, never a pooled socket.
    const request = client.request(url, {
      method: options.method,
      headers: Object.fromEntries(options.headers),
      signal: options.signal,
      lookup: checkedLookup,
      agent: false,
    });
    request.once('response', resolve);
    request.once('error', reject);
    request.end(body);
  });
}

function readBody(response: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tooLarge = () => {
      response.destroy();
      reject(new OutboundError('too-large', `Response is larger than ${maxBytes} bytes`));
    };
    if (Number(response.headers['content-length']) > maxBytes) return tooLarge();

    const chunks: Buffer[] = [];
    let size = 0;
    response.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) return tooLarge();
      chunks.push(chunk);
    });
    response.once('end', () => resolve(Buffer.concat(chunks)));
    response.once('error', reject);
    response.once('close', () => {
      if (!response.complete) reject(new OutboundError('network', 'Response ended early'));
    });
  });
}

/** Turns any failure into an OutboundError. */
async function guard<T>(promise: Promise<T>, timeout: AbortSignal): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof OutboundError) throw error;
    if (timeout.aborted) throw new OutboundError('timeout', 'Request timed out', { cause: error });
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OutboundError('aborted', 'Request aborted', { cause: error });
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new OutboundError('network', `Request failed: ${reason}`, { cause: error });
  }
}

function toSafeResponse(url: URL, response: IncomingMessage, body: Buffer): SafeResponse {
  return {
    status: response.statusCode ?? 0,
    url: url.href,
    headers: response.headers,
    body,
    text: () => body.toString('utf8'),
    json: <T>() => JSON.parse(body.toString('utf8')) as T,
  };
}
