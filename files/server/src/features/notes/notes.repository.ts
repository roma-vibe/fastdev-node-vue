import type { Database, Row } from '../../db/database.ts';
import type { Note } from './notes.types.ts';

const COLUMNS = 'id, title, body, created_at, updated_at';

/** Data access for notes. Only SQL lives here: no validation, no HTTP concerns. */
export class NotesRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  list(): Note[] {
    return this.#db
      .prepare(`SELECT ${COLUMNS} FROM notes ORDER BY created_at DESC, id DESC`)
      .all()
      .map(toNote);
  }

  findById(id: number): Note | undefined {
    const row = this.#db.prepare(`SELECT ${COLUMNS} FROM notes WHERE id = ?`).get(id);
    return row ? toNote(row) : undefined;
  }

  insert(data: { title: string; body: string }): Note {
    const row = this.#db
      .prepare(`INSERT INTO notes (title, body) VALUES (?, ?) RETURNING ${COLUMNS}`)
      .get(data.title, data.body);
    if (!row) throw new Error('Insert into notes returned no row');
    return toNote(row);
  }

  update(id: number, data: { title: string; body: string }): Note | undefined {
    const row = this.#db
      .prepare(
        `UPDATE notes
            SET title = ?, body = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?
      RETURNING ${COLUMNS}`,
      )
      .get(data.title, data.body, id);
    return row ? toNote(row) : undefined;
  }

  delete(id: number): boolean {
    return this.#db.prepare('DELETE FROM notes WHERE id = ?').run(id).changes > 0;
  }
}

function toNote(row: Row): Note {
  return {
    id: Number(row.id),
    title: String(row.title),
    body: String(row.body),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
