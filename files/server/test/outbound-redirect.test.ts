import {
  createServer,
  type IncomingHttpHeaders,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { safeFetch } from '../src/lib/outbound.ts';

// Two local servers stand in for two public sites: in this file every address counts as public.
vi.mock('../src/lib/address-policy.ts', () => ({ classifyAddress: () => 'public' }));

interface Received {
  server: 'a' | 'b';
  method: string;
  headers: IncomingHttpHeaders;
  body: string;
}

/** What a caller might send: credentials under any name next to harmless headers. */
const CALLER_HEADERS = {
  Authorization: 'Bearer secret',
  Cookie: 'sid=secret',
  'X-Api-Key': 'secret',
  'X-Custom-Token': 'secret',
  Accept: 'application/json',
  'Accept-Language': 'en',
  'User-Agent': 'test-agent',
  'Content-Type': 'application/json',
};
/** Headers Node adds to every request by itself. */
const TRANSPORT_HEADERS = new Set(['host', 'connection', 'content-length', 'transfer-encoding']);

const callerHeaderNames = (received: Received | undefined) =>
  Object.keys(received?.headers ?? {})
    .filter((name) => !TRANSPORT_HEADERS.has(name))
    .sort();

describe('safeFetch redirects', () => {
  const received: Received[] = [];
  const servers: Server[] = [];
  let originA = '';
  let originB = '';
  let allowedPorts: number[] = [];

  /** Starts a server on 127.0.0.1 that records every request `respond` does not redirect. */
  async function start(
    name: Received['server'],
    respond: (path: string, response: ServerResponse) => boolean,
  ): Promise<number> {
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        if (respond(request.url ?? '/', response)) return;
        const body = Buffer.concat(chunks).toString('utf8');
        received.push({
          server: name,
          method: request.method ?? '',
          headers: request.headers,
          body,
        });
        response.end('ok');
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return (server.address() as AddressInfo).port;
  }

  beforeAll(async () => {
    // A answers /redirect/<status>/<same|other> with a redirect (and a body nobody reads).
    const portA = await start('a', (path, response) => {
      const [, kind, status, target] = path.split('/');
      if (kind !== 'redirect') return false;
      const location = target === 'same' ? '/landed' : `${originB}/landed`;
      response.writeHead(Number(status), { location }).end('x'.repeat(64 * 1024));
      return true;
    });
    const portB = await start('b', () => false);
    originA = `http://127.0.0.1:${portA}`;
    originB = `http://127.0.0.1:${portB}`;
    allowedPorts = [portA, portB];
  });
  afterAll(() =>
    Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve)))),
  );

  it('sends only harmless headers and the kept body to another origin (307)', async () => {
    const response = await safeFetch(`${originA}/redirect/307/other`, {
      method: 'POST',
      headers: CALLER_HEADERS,
      body: '{"a":1}',
      allowedPorts,
    });

    expect(response.text()).toBe('ok');
    const last = received.at(-1);
    expect(last).toMatchObject({ server: 'b', method: 'POST', body: '{"a":1}' });
    expect(callerHeaderNames(last)).toEqual([
      'accept',
      'accept-language',
      'content-type',
      'user-agent',
    ]);
  });

  it('drops content-type with the body when the redirect turns into a GET (303)', async () => {
    await safeFetch(`${originA}/redirect/303/other`, {
      method: 'POST',
      headers: CALLER_HEADERS,
      body: '{"a":1}',
      allowedPorts,
    });

    const last = received.at(-1);
    expect(last).toMatchObject({ server: 'b', method: 'GET', body: '' });
    expect(callerHeaderNames(last)).toEqual(['accept', 'accept-language', 'user-agent']);
  });

  it('drops content-type on a GET without a body (302)', async () => {
    await safeFetch(`${originA}/redirect/302/other`, { headers: CALLER_HEADERS, allowedPorts });

    expect(callerHeaderNames(received.at(-1))).toEqual(['accept', 'accept-language', 'user-agent']);
  });

  it('keeps every header on a redirect within the same origin', async () => {
    await safeFetch(`${originA}/redirect/302/same`, { headers: CALLER_HEADERS, allowedPorts });

    const last = received.at(-1);
    expect(last?.server).toBe('a');
    expect(last?.headers).toMatchObject({
      authorization: 'Bearer secret',
      cookie: 'sid=secret',
      'x-api-key': 'secret',
      'x-custom-token': 'secret',
    });
  });
});
