import { STATUS_CODES } from 'node:http';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { Config } from './config.ts';
import type { Database } from './db/database.ts';
import { HttpError } from './errors.ts';
import { healthRoutes } from './features/health/health.routes.ts';
import { NotesRepository } from './features/notes/notes.repository.ts';
import { notesRoutes } from './features/notes/notes.routes.ts';
import { NotesService } from './features/notes/notes.service.ts';
import { registerHostCheck } from './host-check.ts';
import { registerSecurityHeaders } from './security-headers.ts';
import { hasWebBuild, registerWeb } from './web.ts';

export interface AppDependencies {
  config: Config;
  db: Database;
}

/**
 * Standard JSON error body returned by every failing /api request. 5xx answers carry no
 * `message`: their details go to the log only.
 */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message?: string;
}

const API_PATH = /^\/api(?:[/?]|$)/;

/**
 * Builds the Fastify app without starting it. This is the composition root:
 * repositories → services → routes are wired here. Tests call it with an in-memory database.
 */
export async function buildApp({ config, db }: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logLevel },
    bodyLimit: config.maxBodyBytes,
    // Reject unknown body fields (400) instead of silently dropping them: schemas with
    // `additionalProperties: false` then fail on fields the client should not send.
    ajv: { customOptions: { removeAdditional: false } },
  });

  // Hooks and handlers are set before any plugin is registered so that every route inherits them.
  registerHostCheck(app, { publicUrl: config.publicUrl, allowedHosts: config.allowedHosts });
  const https = config.publicUrl !== undefined && new URL(config.publicUrl).protocol === 'https:';
  registerSecurityHeaders(app, { hsts: https });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const statusCode = errorStatus(error);
    const body: ErrorResponse = { statusCode, error: STATUS_CODES[statusCode] ?? 'Error' };
    if (statusCode >= 500) {
      // Never leak internal details (message, stack) to clients: they go to the log only.
      request.log.error({ err: error }, 'Request failed');
    } else {
      // Only HttpError and Fastify's own errors get here: their messages are meant for the client
      // (validation errors name the field).
      body.message = error.message;
    }
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

    // Plain 404: the request URL is not echoed back.
    const body: ErrorResponse = { statusCode: 404, error: 'Not Found', message: 'Route not found' };
    return reply.code(404).send(body);
  });

  const notesService = new NotesService(new NotesRepository(db));

  await app.register(healthRoutes, { prefix: '/api', config });
  await app.register(notesRoutes, { prefix: '/api/notes', service: notesService });

  if (webEnabled) await registerWeb(app, config.webDistDir);

  return app;
}

/**
 * The status a failed request is answered with. Only errors raised on purpose keep theirs: the
 * app's HttpError and Fastify's own errors (validation, body parsing, limits: codes FST_*). Any
 * other error, even one carrying a statusCode, and any status outside 400-599 is a 500.
 */
function errorStatus(error: Error): number {
  const { statusCode, code, validation } = error as Partial<FastifyError>;
  const own =
    error instanceof HttpError ||
    validation !== undefined ||
    (typeof code === 'string' && code.startsWith('FST_'));
  if (!own || typeof statusCode !== 'number' || !Number.isInteger(statusCode)) return 500;
  return statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
}
