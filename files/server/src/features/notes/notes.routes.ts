import type { FastifyPluginAsync } from 'fastify';
import {
  createNoteBodySchema,
  noteListSchema,
  noteParamsSchema,
  noteSchema,
  updateNoteBodySchema,
} from './notes.schemas.ts';
import type { NotesService } from './notes.service.ts';
import type { CreateNoteInput, UpdateNoteInput } from './notes.types.ts';

export interface NotesRoutesOptions {
  service: NotesService;
}

interface NoteParams {
  id: number;
}

/** HTTP layer for notes: validation (JSON Schema), status codes, delegation to the service. */
export const notesRoutes: FastifyPluginAsync<NotesRoutesOptions> = async (app, { service }) => {
  app.get('/', { schema: { response: { 200: noteListSchema } } }, async () => service.list());

  app.get<{ Params: NoteParams }>(
    '/:id',
    { schema: { params: noteParamsSchema, response: { 200: noteSchema } } },
    async (request) => service.get(request.params.id),
  );

  app.post<{ Body: CreateNoteInput }>(
    '/',
    { schema: { body: createNoteBodySchema, response: { 201: noteSchema } } },
    async (request, reply) => reply.code(201).send(service.create(request.body)),
  );

  app.patch<{ Params: NoteParams; Body: UpdateNoteInput }>(
    '/:id',
    {
      schema: {
        params: noteParamsSchema,
        body: updateNoteBodySchema,
        response: { 200: noteSchema },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.delete<{ Params: NoteParams }>(
    '/:id',
    { schema: { params: noteParamsSchema } },
    async (request, reply) => {
      service.delete(request.params.id);
      return reply.code(204).send();
    },
  );
};
