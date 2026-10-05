import { buildApp } from './app.ts';
import { type Config, ConfigError, loadConfig, loadEnvFile } from './config.ts';
import { openDatabase } from './db/database.ts';
import { runMigrations } from './db/migrator.ts';

// Server entry point: `npm start` (production) and `npm run dev` (with node --watch).

function loadConfigOrExit(): Config {
  loadEnvFile();
  try {
    return loadConfig();
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error(error.message);
    process.exit(1);
  }
}

const config = loadConfigOrExit();
const db = openDatabase(config.dbPath);
const applied = runMigrations(db);
const app = await buildApp({ config, db });
if (applied.length > 0) app.log.info({ migrations: applied }, 'Applied database migrations');

let closing = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (closing) return;
  closing = true;
  app.log.info(`Received ${signal}, shutting down`);
  try {
    await app.close();
  } finally {
    db.close();
  }
}
process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.fatal(error, 'Failed to start the server');
  db.close();
  process.exit(1);
}
