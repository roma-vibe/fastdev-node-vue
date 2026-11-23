import { isAbsolute } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, rootDir } from '../src/config.ts';
import { testEnv } from './helpers.ts';

describe('loadConfig', () => {
  it('applies defaults and resolves DB_PATH against the project root', () => {
    const config = loadConfig({ ...testEnv, DB_PATH: 'data/test.sqlite', NODE_ENV: undefined });

    expect(config).toMatchObject({
      appName: 'Test App',
      port: 3000,
      host: '127.0.0.1',
      publicUrl: undefined,
      maxBodyBytes: 1_048_576,
      nodeEnv: 'production',
      serveWeb: true,
    });
    expect(isAbsolute(config.dbPath)).toBe(true);
    expect(config.dbPath.startsWith(rootDir)).toBe(true);
  });

  it('reads ALLOWED_HOSTS as a lowercase list', () => {
    expect(loadConfig(testEnv).allowedHosts).toEqual([]);
    expect(
      loadConfig({ ...testEnv, ALLOWED_HOSTS: ' App.Example.com, notes.internal ,,[::1]' })
        .allowedHosts,
    ).toEqual(['app.example.com', 'notes.internal', '[::1]']);
  });

  it.each([
    'https://app.example.com',
    'app.example.com:8080',
    'app.example.com/x',
    '*.example.com',
  ])('rejects the ALLOWED_HOSTS entry %s', (entry) => {
    expect(() => loadConfig({ ...testEnv, ALLOWED_HOSTS: entry })).toThrow(ConfigError);
  });

  it('reports every invalid value at once', () => {
    const load = () =>
      loadConfig({
        APP_SLUG: 'x',
        DB_PATH: ':memory:',
        APP_PORT: 'abc',
        PUBLIC_URL: 'javascript:alert(1)',
        MAX_BODY_BYTES: '-1',
        LOG_LEVEL: 'loud',
      });

    expect(load).toThrow(ConfigError);
    expect(load).toThrow(
      expect.objectContaining({
        problems: [
          expect.stringContaining('APP_NAME'),
          expect.stringContaining('APP_PORT'),
          expect.stringContaining('PUBLIC_URL'),
          expect.stringContaining('MAX_BODY_BYTES'),
          expect.stringContaining('LOG_LEVEL'),
        ],
      }),
    );
  });
});
