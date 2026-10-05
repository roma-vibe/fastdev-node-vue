import type { FastifyPluginAsync } from 'fastify';
import type { Config } from '../../config.ts';

export interface HealthRoutesOptions {
  config: Config;
}

export interface HealthResponse {
  status: 'ok';
  name: string;
  version: string;
}

const healthResponseSchema = {
  type: 'object',
  required: ['status', 'name', 'version'],
  properties: {
    status: { type: 'string', enum: ['ok'] },
    name: { type: 'string' },
    version: { type: 'string' },
  },
} as const;

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (app, { config }) => {
  app.get('/health', { schema: { response: { 200: healthResponseSchema } } }, async () => {
    const response: HealthResponse = {
      status: 'ok',
      name: config.appName,
      version: config.version,
    };
    return response;
  });
};
