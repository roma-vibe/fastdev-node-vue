import { ConfigError, loadConfig, loadEnvFile } from './config.ts';
import { openDatabase } from './db/database.ts';
import { runMigrations } from './db/migrator.ts';

// CLI: `npm run db:migrate` applies pending migrations without starting the server.
loadEnvFile();

try {
  const config = loadConfig();
  const db = openDatabase(config.dbPath);
  try {
    const applied = runMigrations(db);
    console.log(
      applied.length > 0
        ? `Applied ${applied.length} migration(s):\n${applied.map((name) => `  ${name}`).join('\n')}`
        : `Database is up to date (${config.dbPath})`,
    );
  } finally {
    db.close();
  }
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exitCode = 1;
}
