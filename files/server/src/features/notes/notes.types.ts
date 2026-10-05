export interface Note {
  id: number;
  title: string;
  body: string;
  /** ISO 8601, UTC. */
  createdAt: string;
  /** ISO 8601, UTC. */
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
