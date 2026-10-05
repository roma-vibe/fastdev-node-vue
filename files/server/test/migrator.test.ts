import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Database, openDatabase } from '../src/db/database.ts';
import { runMigrations } from '../src/db/migrator.ts';

describe('runMigrations', () => {
  let db: Database;
  let dir: string;
  beforeEach(() => {
    db = openDatabase(':memory:');
    dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  });
  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('applies the bundled migrations once', () => {
    expect(runMigrations(db)).toContain('001_create_notes');
    expect(runMigrations(db)).toEqual([]);
  });

  it('applies migrations in numeric order and records them', () => {
    writeFileSync(join(dir, '010_second.sql'), 'ALTER TABLE items ADD COLUMN note TEXT;');
    writeFileSync(join(dir, '002_first.sql'), 'CREATE TABLE items (id INTEGER PRIMARY KEY);');

    expect(runMigrations(db, dir)).toEqual(['002_first', '010_second']);
    const rows = db.prepare('SELECT name FROM schema_migrations ORDER BY name').all();
    expect(rows.map((row) => row.name)).toEqual(['002_first', '010_second']);
  });

  it('rolls back a failing migration', () => {
    writeFileSync(join(dir, '001_broken.sql'), 'CREATE TABLE ok (id INTEGER); SELECT * FROM nope;');

    expect(() => runMigrations(db, dir)).toThrow(/001_broken\.sql failed/);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE name = 'ok'").all();
    expect(tables).toEqual([]);
  });

  it('rejects invalid file names and duplicate numbers', () => {
    writeFileSync(join(dir, 'create-things.sql'), '');
    expect(() => runMigrations(db, dir)).toThrow(/Invalid migration file name/);

    rmSync(join(dir, 'create-things.sql'));
    writeFileSync(join(dir, '001_a.sql'), '');
    writeFileSync(join(dir, '001_b.sql'), '');
    expect(() => runMigrations(db, dir)).toThrow(/Duplicate migration number/);
  });
});
