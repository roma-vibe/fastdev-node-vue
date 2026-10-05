import { http } from './http.ts';

/** Mirrors GET /api/health (server/src/features/health/health.routes.ts). */
export interface Health {
  status: 'ok';
  name: string;
  version: string;
}

export const healthApi = {
  get: () => http.get<Health>('/health'),
};
