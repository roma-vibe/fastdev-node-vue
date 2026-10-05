import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

/** True when `npm run build` has produced the SPA in `distDir`. */
export function hasWebBuild(distDir: string): boolean {
  return existsSync(join(distDir, 'index.html'));
}

/**
 * Serves the built SPA (web/dist). Unknown page routes fall back to index.html through the
 * not-found handler in app.ts, so client-side routing works on reload.
 */
export async function registerWeb(app: FastifyInstance, distDir: string): Promise<void> {
  const assetsDir = join(distDir, 'assets');
  await app.register(fastifyStatic, {
    root: distDir,
    wildcard: false,
    cacheControl: false,
    // Vite fingerprints files in assets/, so they can be cached forever; everything else is revalidated.
    setHeaders: (reply, filePath) => {
      reply.header(
        'cache-control',
        filePath.startsWith(assetsDir) ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    },
  });
}
