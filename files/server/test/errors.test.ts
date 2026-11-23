import { afterEach, describe, expect, it } from 'vitest';
import { HttpError } from '../src/errors.ts';
import { createTestApp, type TestContext } from './helpers.ts';

/** An error the way libraries build them: a plain Error with a statusCode and a detailed message. */
function libraryError(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode });
}

const INTERNAL = { statusCode: 500, error: 'Internal Server Error' };

describe('error responses', () => {
  let ctx: TestContext;
  afterEach(() => ctx.close());

  async function answer(thrown: Error) {
    ctx = await createTestApp();
    ctx.app.get('/api/fail', () => {
      throw thrown;
    });
    return ctx.app.inject({ method: 'GET', url: '/api/fail' });
  }

  it('sends an HttpError with its status and message', async () => {
    const response = await answer(new HttpError(409, 'Title already used'));

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'Title already used',
    });
  });

  it('turns a 4xx error from anywhere else into a bare 500', async () => {
    const response = await answer(libraryError(404, 'no row in /srv/secret.sqlite'));

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(INTERNAL);
  });

  it.each([302, 600, 999])('answers a status of %i with a bare 500', async (status) => {
    const own = await answer(new HttpError(status, 'odd status'));
    expect(own.statusCode).toBe(500);
    expect(own.json()).toEqual(INTERNAL);
    await ctx.close();

    const foreign = await answer(libraryError(status, 'odd status'));
    expect(foreign.statusCode).toBe(500);
    expect(foreign.json()).toEqual(INTERNAL);
  });

  it('keeps the status of a 5xx HttpError but not its message', async () => {
    const response = await answer(new HttpError(503, 'database at /srv/db is down'));

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ statusCode: 503, error: 'Service Unavailable' });
  });

  it('keeps Fastify validation errors with their message', async () => {
    ctx = await createTestApp();

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/notes',
      payload: { title: 'x', extra: true },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ statusCode: 400, message: expect.any(String) });
  });

  it("keeps Fastify's own body errors (FST_* codes)", async () => {
    ctx = await createTestApp();

    const invalidJson = await ctx.app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { 'content-type': 'application/json' },
      payload: '{"title":',
    });
    const wrongType = await ctx.app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { 'content-type': 'application/xml' },
      payload: '<note/>',
    });

    expect(invalidJson.statusCode).toBe(400);
    expect(invalidJson.json()).toMatchObject({ statusCode: 400, message: expect.any(String) });
    expect(wrongType.statusCode).toBe(415);
  });
});
