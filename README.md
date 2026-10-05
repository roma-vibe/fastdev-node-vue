# Node + Vue

A full-stack TypeScript web app: a Fastify 5 API and a Vue 3 single-page app (Vite, Vue Router, Pinia, Tailwind CSS 4) sharing one SQLite database through the built-in node:sqlite. A Notes example goes through every layer, from an SQL migration to a Pinia store and a page, with server and web tests and a zero-warning quality gate (ESLint, Prettier, vue-tsc, Vitest). Choose it for web apps, internal tools and prototypes that need a real backend; Docker can build the production container or run everything.

This repository is a [fastDev](https://github.com/roma-vibe/fastDev) project skeleton (`node-vue`). fastDev lists it
from a registry, downloads it when first used and creates named, ready-to-run projects from it.

- `template.toml` — the manifest: requirements, options, env, setup steps and commands.
- `files/` — the files of a new project (`*.tmpl` files are rendered with the project name and options).
- `CHANGELOG.md` — what changed in every version.

Versions are the `vX.Y.Z` tags of this repository and never change once published.
