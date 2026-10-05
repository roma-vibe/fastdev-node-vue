import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLOutputValue } from 'node:sqlite';

export type Database = DatabaseSync;

/** A raw result row as returned by node:sqlite. Map it to a domain type in the repository. */
export type Row = Record<string, SQLOutputValue>;

/**
 * Opens (and creates, if needed) the SQLite database at `path`.
 * Pass ":memory:" for a throwaway in-memory database (tests).
 */
export function openDatabase(path: string): Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  return db;
}
