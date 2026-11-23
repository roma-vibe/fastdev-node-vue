import { afterEach, describe, expect, it } from 'vitest';
import { hostnameOf } from '../src/host-check.ts';
import { createTestApp, type TestContext } from './helpers.ts';

describe('Host check (DNS rebinding)', () => {
  let ctx: TestContext;
  afterEach(() => ctx.close());

  const healthFor = (host: string) =>
    ctx.app.inject({ method: 'GET', url: '/api/health', headers: { host } });

  it.each(['localhost:3000', 'localhost', 'LOCALHOST:8080', '127.0.0.1:5173', '[::1]:3000'])(
    'accepts %s',
    async (host) => {
      ctx = await createTestApp();

      expect((await healthFor(host)).statusCode).toBe(200);
    },
  );

  it('refuses a rebound host name with 421 before the route runs', async () => {
    ctx = await createTestApp();

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { host: 'rebind.attacker.example:3000' },
      payload: { title: 'Planted' },
    });

    expect(response.statusCode).toBe(421);
    expect(response.json()).toEqual({
      statusCode: 421,
      error: 'Misdirected Request',
      message: 'Unknown host',
    });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    const notes = await ctx.app.inject({ method: 'GET', url: '/api/notes' });
    expect(notes.json()).toEqual([]);
  });

  it.each([
    'localhost.attacker.example',
    '127.0.0.1.nip.io:3000',
    'evil@localhost',
    'localhost:3000/path',
    'localhost:3000:3000',
  ])('refuses %s', async (host) => {
    ctx = await createTestApp();

    expect((await healthFor(host)).statusCode).toBe(421);
  });

  it('accepts the PUBLIC_URL host and ALLOWED_HOSTS on any port', async () => {
    ctx = await createTestApp({
      publicUrl: 'https://App.Example.com',
      allowedHosts: ['notes.internal'],
    });

    expect((await healthFor('app.example.com')).statusCode).toBe(200);
    expect((await healthFor('notes.internal:8443')).statusCode).toBe(200);
    expect((await healthFor('other.example.com')).statusCode).toBe(421);
  });
});

describe('hostnameOf', () => {
  it.each([
    ['localhost:3000', 'localhost'],
    ['Example.COM', 'example.com'],
    ['[::1]:3000', '[::1]'],
    ['[::1]', '[::1]'],
    [undefined, undefined],
    ['', undefined],
    ['host name', undefined],
  ])('reads %j as %j', (header, hostname) => {
    expect(hostnameOf(header)).toBe(hostname);
  });
});
