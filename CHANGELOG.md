# Changelog

## 1.1.0 — 2026-11-23

_Not verified on the publishing machine: data=volume, docker=run: Docker >=24; data=local, docker=full: Docker >=24._

- Security headers on every response (strict CSP, HSTS behind https, nosniff, no framing) and no source maps in production builds.
- Host check against DNS rebinding: only localhost, 127.0.0.1, [::1], the PUBLIC_URL host and ALLOWED_HOSTS are answered, others get 421.
- Error handler shows messages only for the app's own and Fastify's errors; everything else is a bare 500.
- Safe outbound HTTP helper safeFetch: public addresses only, redirects re-checked with secret headers dropped across origins, size and time caps.
- npm run check ends with npm run security (secbase); without secbase it fails, only SECBASE_OPTIONAL=1 skips it with a notice.
- Docker publishes ports on 127.0.0.1 only; production dependencies have no known vulnerabilities.

## 1.0.0 — 2026-10-05

- Initial version: Fastify 5 API and Vue 3 SPA with SQLite (node:sqlite), Tailwind CSS 4, Pinia, Vue Router and TypeScript.
- Notes example feature through every layer, with server and web tests.
- Docker modes: none, Docker to run the app (default), or everything in Docker (dev container with hot reload, dependencies in volumes).
- Data storage for containers: Docker volume or the project's data/ folder (DOCKER_DATA in .env).
- Docker build command in both Docker modes; verification builds the production image.
- Cleanup removes the containers, volumes and local images that verifications and previews create in both Docker modes.
- .env is read only by dotenv loaders (process.loadEnvFile, Vite loadEnv, Docker Compose), so names with spaces, quotes and Cyrillic work.
- Vite ignores data/ and SQLite files, so database writes do not reload the page.
- package.json records allowScripts (fsevents: false), so npm 11 installs without warnings.
- Russian translations of all manifest texts.
- Preview in fastDev: the dev server runs in a throwaway copy, with its own message in Everything in Docker.
- Verified: default choices, Everything in Docker with the project folder, and No Docker; manually checked a project named Test "Shop" Магазин (dev server, build + start, production container) and previews in the default and Everything in Docker modes.
- Vite reads the root .env with Node's dotenv parser (web/vite/env.ts, with tests) instead of loadEnv, so $ in APP_NAME is not expanded in the page title and the UI.
- index.html placeholders insert values literally: $& or $$ in the name are no longer replacement patterns.
