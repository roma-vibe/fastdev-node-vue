import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestContext } from './helpers.ts';

describe('GET /api/health', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await createTestApp();
  });
  afterEach(() => ctx.close());

  it('returns status, the app name from the environment and the version', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      name: 'Test App',
      version: ctx.config.version,
    });
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/unknown' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });
});
