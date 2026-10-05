import { BadRequestError, NotFoundError } from '../../errors.ts';
import type { NotesRepository } from './notes.repository.ts';
import type { CreateNoteInput, Note, UpdateNoteInput } from './notes.types.ts';

/** Business rules for notes. Knows nothing about HTTP or SQL. */
export class NotesService {
  readonly #repository: NotesRepository;

  constructor(repository: NotesRepository) {
    this.#repository = repository;
  }

  list(): Note[] {
    return this.#repository.list();
  }

  get(id: number): Note {
    const note = this.#repository.findById(id);
    if (!note) throw new NotFoundError(`Note ${id} not found`);
    return note;
  }

  create(input: CreateNoteInput): Note {
    return this.#repository.insert({
      title: normalizeTitle(input.title),
      body: input.body?.trim() ?? '',
    });
  }

  update(id: number, input: UpdateNoteInput): Note {
    const current = this.get(id);
    const updated = this.#repository.update(id, {
      title: input.title === undefined ? current.title : normalizeTitle(input.title),
      body: input.body === undefined ? current.body : input.body.trim(),
    });
    if (!updated) throw new NotFoundError(`Note ${id} not found`);
    return updated;
  }

  delete(id: number): void {
    if (!this.#repository.delete(id)) throw new NotFoundError(`Note ${id} not found`);
  }
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();
  if (normalized === '') throw new BadRequestError('Title must not be blank');
  return normalized;
}
