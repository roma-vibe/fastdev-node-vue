import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OutboundError, safeFetch } from '../src/lib/outbound.ts';

/** Expects safeFetch to fail with the given OutboundError code. */
async function expectRefused(url: string, code: string, options = {}): Promise<void> {
  const error: unknown = await safeFetch(url, options).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(OutboundError);
  expect(error).toMatchObject({ code });
}

describe('safeFetch', () => {
  let server: Server;
  let port: number;
  let hits = 0;
  beforeAll(async () => {
    server = createServer((_request, response) => {
      hits += 1;
      response.end('local secret');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('refuses a local server by IP, by name and through IPv6 forms', async () => {
    const allowedPorts = [port];

    await expectRefused(`http://127.0.0.1:${port}/`, 'blocked-address', { allowedPorts });
    await expectRefused(`http://localhost:${port}/`, 'blocked-address', { allowedPorts });
    await expectRefused(`http://[::ffff:127.0.0.1]:${port}/`, 'blocked-address', { allowedPorts });
    await expectRefused(`http://2130706433:${port}/`, 'blocked-address', { allowedPorts });
    await expectRefused(`http://0x7f.0.0.1:${port}/`, 'blocked-address', { allowedPorts });
    expect(hits).toBe(0);
  });

  it('refuses ports other than 80 and 443 unless allowed', async () => {
    await expectRefused(`http://127.0.0.1:${port}/`, 'blocked-url');
    await expectRefused('https://example.com:8443/', 'blocked-url');
  });

  it('refuses other protocols, credentials and invalid URLs', async () => {
    await expectRefused('file:///etc/passwd', 'blocked-url');
    await expectRefused('ftp://example.com/', 'blocked-url');
    await expectRefused('https://user:pass@example.com/', 'blocked-url');
    await expectRefused('not a url', 'invalid-url');
  });

  it('refuses metadata and private addresses before connecting', async () => {
    await expectRefused('http://169.254.169.254/latest/meta-data/', 'blocked-address');
    await expectRefused('http://[fd00::1]/', 'blocked-address');
    await expectRefused('http://10.0.0.1/', 'blocked-address');
  });
});
