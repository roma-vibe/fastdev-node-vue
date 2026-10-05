/**
 * JSON Schemas for the notes routes. Fastify validates requests with them (Ajv) and uses the
 * response schemas for fast serialization; fields not listed in a response schema are dropped.
 * Keep them in sync with notes.types.ts and with web/src/api/notes.ts.
 */

export const noteSchema = {
  type: 'object',
  required: ['id', 'title', 'body', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'integer' },
    title: { type: 'string' },
    body: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

export const noteListSchema = {
  type: 'array',
  items: noteSchema,
} as const;

export const noteParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer', minimum: 1 },
  },
} as const;

export const createNoteBodySchema = {
  type: 'object',
  required: ['title'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    body: { type: 'string', maxLength: 10_000 },
  },
} as const;

export const updateNoteBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: createNoteBodySchema.properties,
} as const;
