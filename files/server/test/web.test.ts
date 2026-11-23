import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_CSP, PAGE_CSP } from '../src/security-headers.ts';
import { createTestApp, type TestContext } from './helpers.ts';

describe('serving the built web app', () => {
  let ctx: TestContext;
  let distDir: string;
  beforeEach(async () => {
    distDir = mkdtempSync(join(tmpdir(), 'web-dist-'));
    mkdirSync(join(distDir, 'assets'));
    writeFileSync(join(distDir, 'index.html'), '<!doctype html><title>SPA</title>');
    writeFileSync(join(distDir, 'assets', 'app-123.js'), 'console.log(1)');
    ctx = await createTestApp({ serveWeb: true, webDistDir: distDir });
  });
  afterEach(async () => {
    await ctx.close();
    rmSync(distDir, { recursive: true, force: true });
  });

  it('serves index.html and fingerprinted assets', async () => {
    const index = await ctx.app.inject({ method: 'GET', url: '/' });
    const asset = await ctx.app.inject({ method: 'GET', url: '/assets/app-123.js' });

    expect(index.statusCode).toBe(200);
    expect(index.headers['cache-control']).toBe('no-cache');
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');
  });

  it('gives the page its CSP and every other file the locked-down one', async () => {
    const index = await ctx.app.inject({ method: 'GET', url: '/' });
    const fallback = await ctx.app.inject({
      method: 'GET',
      url: '/notes',
      headers: { accept: 'text/html' },
    });
    const asset = await ctx.app.inject({ method: 'GET', url: '/assets/app-123.js' });

    expect(index.headers['content-security-policy']).toBe(PAGE_CSP);
    expect(fallback.headers['content-security-policy']).toBe(PAGE_CSP);
    expect(asset.headers['content-security-policy']).toBe(API_CSP);
    expect(index.headers['x-frame-options']).toBe('DENY');
  });

  it('falls back to index.html for client-side routes', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/notes',
      headers: { accept: 'text/html' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<title>SPA</title>');
  });

  it('keeps JSON 404s for the API and missing files', async () => {
    const api = await ctx.app.inject({
      method: 'GET',
      url: '/api/missing',
      headers: { accept: 'text/html' },
    });
    const file = await ctx.app.inject({ method: 'GET', url: '/assets/missing.js' });

    expect(api.statusCode).toBe(404);
    expect(api.json()).toMatchObject({ error: 'Not Found' });
    expect(file.statusCode).toBe(404);
  });
});
