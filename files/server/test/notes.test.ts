import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Note } from '../src/features/notes/notes.types.ts';
import { createTestApp, type TestContext } from './helpers.ts';

describe('notes API', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await createTestApp();
  });
  afterEach(() => ctx.close());

  async function createNote(payload: Record<string, unknown>): Promise<Note> {
    const response = await ctx.app.inject({ method: 'POST', url: '/api/notes', payload });
    expect(response.statusCode).toBe(201);
    return response.json<Note>();
  }

  it('starts empty', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/notes' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('creates a note and trims its fields', async () => {
    const note = await createNote({ title: '  First  ', body: ' Hello ' });

    expect(note).toMatchObject({ id: 1, title: 'First', body: 'Hello' });
    expect(new Date(note.createdAt).toISOString()).toBe(note.createdAt);
  });

  it('lists notes newest first', async () => {
    await createNote({ title: 'Older' });
    await createNote({ title: 'Newer' });

    const response = await ctx.app.inject({ method: 'GET', url: '/api/notes' });

    expect(response.json<Note[]>().map((note) => note.title)).toEqual(['Newer', 'Older']);
  });

  it('gets a note by id', async () => {
    const created = await createNote({ title: 'Read me' });

    const response = await ctx.app.inject({ method: 'GET', url: `/api/notes/${created.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(created);
  });

  it('updates a note partially', async () => {
    const created = await createNote({ title: 'Draft', body: 'Keep me' });

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/notes/${created.id}`,
      payload: { title: 'Final' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: created.id, title: 'Final', body: 'Keep me' });
  });

  it('deletes a note', async () => {
    const created = await createNote({ title: 'Temporary' });

    const deleted = await ctx.app.inject({ method: 'DELETE', url: `/api/notes/${created.id}` });
    const list = await ctx.app.inject({ method: 'GET', url: '/api/notes' });

    expect(deleted.statusCode).toBe(204);
    expect(list.json()).toEqual([]);
  });

  it('rejects an invalid body with 400', async () => {
    const missing = await ctx.app.inject({ method: 'POST', url: '/api/notes', payload: {} });
    const blank = await ctx.app.inject({
      method: 'POST',
      url: '/api/notes',
      payload: { title: '   ' },
    });

    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: "body must have required property 'title'",
    });
    expect(blank.statusCode).toBe(400);
    expect(blank.json()).toMatchObject({ message: 'Title must not be blank' });
  });

  it('rejects unknown body fields instead of dropping them', async () => {
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/notes',
      payload: { title: 'Mine', ownerId: 2 },
    });
    const updated = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/notes/1',
      payload: { id: 5 },
    });

    expect(created.statusCode).toBe(400);
    expect(created.json()).toMatchObject({ message: 'body must NOT have additional properties' });
    expect(updated.statusCode).toBe(400);
  });

  it('returns 404 for a missing note', async () => {
    const get = await ctx.app.inject({ method: 'GET', url: '/api/notes/999' });
    const remove = await ctx.app.inject({ method: 'DELETE', url: '/api/notes/999' });

    expect(get.statusCode).toBe(404);
    expect(get.json()).toMatchObject({ message: 'Note 999 not found' });
    expect(remove.statusCode).toBe(404);
  });
});
