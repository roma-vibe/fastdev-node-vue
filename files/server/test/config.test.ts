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
      host: 'localhost',
      nodeEnv: 'production',
      serveWeb: true,
    });
    expect(isAbsolute(config.dbPath)).toBe(true);
    expect(config.dbPath.startsWith(rootDir)).toBe(true);
  });

  it('reports every invalid value at once', () => {
    const load = () =>
      loadConfig({ APP_SLUG: 'x', DB_PATH: ':memory:', APP_PORT: 'abc', LOG_LEVEL: 'loud' });

    expect(load).toThrow(ConfigError);
    expect(load).toThrow(
      expect.objectContaining({
        problems: [
          expect.stringContaining('APP_NAME'),
          expect.stringContaining('APP_PORT'),
          expect.stringContaining('LOG_LEVEL'),
        ],
      }),
    );
  });
});
