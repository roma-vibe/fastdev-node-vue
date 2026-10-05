import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { type Config, loadConfig } from '../src/config.ts';
import { type Database, openDatabase } from '../src/db/database.ts';
import { runMigrations } from '../src/db/migrator.ts';

export const testEnv = {
  APP_NAME: 'Test App',
  APP_SLUG: 'test-app',
  DB_PATH: ':memory:',
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
} satisfies NodeJS.ProcessEnv;

export interface TestContext {
  app: FastifyInstance;
  db: Database;
  config: Config;
  close: () => Promise<void>;
}

/** Builds the app on a fresh, migrated in-memory database. Call `close()` in afterEach. */
export async function createTestApp(overrides: Partial<Config> = {}): Promise<TestContext> {
  const config = { ...loadConfig(testEnv), ...overrides };
  const db = openDatabase(config.dbPath);
  runMigrations(db);
  const app = await buildApp({ config, db });
  return {
    app,
    db,
    config,
    close: async () => {
      await app.close();
      db.close();
    },
  };
}
