import { afterEach, describe, expect, it } from 'vitest';
import { API_CSP } from '../src/security-headers.ts';
import { createTestApp, type TestContext } from './helpers.ts';

describe('secure defaults', () => {
  let ctx: TestContext;
  afterEach(() => ctx.close());

  it('sends the security headers and the API CSP on JSON responses', async () => {
    ctx = await createTestApp();

    const response = await ctx.app.inject({ method: 'GET', url: '/api/health' });

    expect(response.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-frame-options': 'DENY',
      'cross-origin-opener-policy': 'same-origin',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()',
      'content-security-policy': API_CSP,
    });
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('sends HSTS only when PUBLIC_URL is https', async () => {
    ctx = await createTestApp({ publicUrl: 'https://app.example.com' });

    const response = await ctx.app.inject({ method: 'GET', url: '/api/unknown' });

    expect(response.headers['strict-transport-security']).toBe('max-age=31536000');
  });

  it('sends no CORS headers to other origins', async () => {
    ctx = await createTestApp();

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://evil.example' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers 5xx with a generic body and no details', async () => {
    ctx = await createTestApp();
    ctx.app.get('/api/boom', () => {
      throw new Error('connection to db at /srv/secret failed');
    });

    const response = await ctx.app.inject({ method: 'GET', url: '/api/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ statusCode: 500, error: 'Internal Server Error' });
    expect(response.headers['content-security-policy']).toBe(API_CSP);
  });

  it('answers unknown routes with a plain 404 that does not echo the URL', async () => {
    ctx = await createTestApp();

    const response = await ctx.app.inject({ method: 'GET', url: '/api/<script>' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Route not found',
    });
  });

  it('rejects bodies over MAX_BODY_BYTES with 413', async () => {
    ctx = await createTestApp({ maxBodyBytes: 100 });

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/notes',
      payload: { title: 'x'.repeat(200) },
    });

    expect(response.statusCode).toBe(413);
  });
});
