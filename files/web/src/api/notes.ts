import { http } from './http.ts';

/** Mirrors server/src/features/notes/notes.types.ts. Keep both in sync. */
export interface Note {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  title: string;
  body?: string;
}

export interface UpdateNoteInput {
  title?: string;
  body?: string;
}

export const notesApi = {
  list: () => http.get<Note[]>('/notes'),
  get: (id: number) => http.get<Note>(`/notes/${id}`),
  create: (input: CreateNoteInput) => http.post<Note>('/notes', input),
  update: (id: number, input: UpdateNoteInput) => http.patch<Note>(`/notes/${id}`, input),
  remove: (id: number) => http.delete(`/notes/${id}`),
};
