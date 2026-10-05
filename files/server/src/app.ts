import { STATUS_CODES } from 'node:http';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { Config } from './config.ts';
import type { Database } from './db/database.ts';
import { healthRoutes } from './features/health/health.routes.ts';
import { NotesRepository } from './features/notes/notes.repository.ts';
import { notesRoutes } from './features/notes/notes.routes.ts';
import { NotesService } from './features/notes/notes.service.ts';
import { hasWebBuild, registerWeb } from './web.ts';

export interface AppDependencies {
  config: Config;
  db: Database;
}

/** Standard JSON error body returned by every failing /api request. */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
}

const API_PATH = /^\/api(?:[/?]|$)/;

/**
 * Builds the Fastify app without starting it. This is the composition root:
 * repositories → services → routes are wired here. Tests call it with an in-memory database.
 */
export async function buildApp({ config, db }: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: config.logLevel } });

  // Handlers are set before any plugin is registered so that every route inherits them.
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (statusCode >= 500) request.log.error({ err: error }, 'Request failed');
    const body: ErrorResponse = {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      // Never leak internal error details to clients.
      message: statusCode >= 500 ? 'Internal Server Error' : error.message,
    };
    return reply.code(statusCode).send(body);
  });

  const webEnabled = config.serveWeb && hasWebBuild(config.webDistDir);
  if (config.serveWeb && !webEnabled) {
    app.log.warn(`No web build in ${config.webDistDir}; run "npm run build" to serve the UI`);
  }

  app.setNotFoundHandler((request, reply) => {
    // Browser navigation to a client-side route: serve the SPA and let Vue Router handle it.
    const isPageRequest =
      webEnabled &&
      request.method === 'GET' &&
      !API_PATH.test(request.url) &&
      (request.headers.accept ?? '').includes('text/html');
    if (isPageRequest) return reply.sendFile('index.html');

    const body: ErrorResponse = {
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    };
    return reply.code(404).send(body);
  });

  const notesService = new NotesService(new NotesRepository(db));

  await app.register(healthRoutes, { prefix: '/api', config });
  await app.register(notesRoutes, { prefix: '/api/notes', service: notesService });

  if (webEnabled) await registerWeb(app, config.webDistDir);

  return app;
}
