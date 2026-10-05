import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Database } from './database.ts';

/** Folder with the SQL migrations: NNN_name.sql, applied in file-name order. */
export const migrationsDir = resolve(import.meta.dirname, 'migrations');

const MIGRATION_FILE = /^(\d{3,})_[a-z0-9_]+\.sql$/;

/**
 * Applies every migration from `dir` that is not yet recorded in `schema_migrations`.
 * Each migration runs in its own transaction. Returns the names of the applied migrations.
 */
export function runMigrations(db: Database, dir: string = migrationsDir): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT
  `);

  const done = new Set(
    db
      .prepare('SELECT name FROM schema_migrations')
      .all()
      .map((row) => String(row.name)),
  );

  const applied: string[] = [];
  for (const file of listMigrationFiles(dir)) {
    const name = file.slice(0, -'.sql'.length);
    if (done.has(name)) continue;

    const sql = readFileSync(join(dir, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(name);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
    }
    applied.push(name);
  }
  return applied;
}

/** Lists migration files sorted by number; rejects bad names and duplicate numbers. */
function listMigrationFiles(dir: string): string[] {
  const seen = new Map<number, string>();
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql'))) {
    const digits = MIGRATION_FILE.exec(file)?.[1];
    if (digits === undefined) {
      throw new Error(`Invalid migration file name "${file}", expected NNN_snake_case.sql`);
    }
    const previous = seen.get(Number(digits));
    if (previous !== undefined) {
      throw new Error(`Duplicate migration number ${digits}: "${previous}" and "${file}"`);
    }
    seen.set(Number(digits), file);
  }
  return [...seen.entries()].sort(([a], [b]) => a - b).map(([, file]) => file);
}
