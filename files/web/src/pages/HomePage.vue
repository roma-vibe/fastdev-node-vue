<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { appName } from '@/config.ts';
import { useHealthStore } from '@/stores/health.ts';

const health = useHealthStore();
</script>

<template>
  <section class="space-y-12">
    <div class="space-y-4">
      <p class="text-sm font-medium text-indigo-600 dark:text-indigo-400">Welcome to</p>
      <h1 class="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{{ appName }}</h1>
      <p class="max-w-2xl text-lg text-pretty text-zinc-600 dark:text-zinc-400">
        A Fastify API and a Vue single-page app sharing one SQLite database. Replace this page with
        your product.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div
        class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 class="text-sm font-medium text-zinc-500 dark:text-zinc-400">API</h2>
        <p v-if="health.status === 'online' && health.info" class="mt-2 text-lg font-semibold">
          Online
          <span class="ml-1 text-sm font-normal text-zinc-500">v{{ health.info.version }}</span>
        </p>
        <p v-else-if="health.status === 'offline'" class="mt-2 text-lg font-semibold text-rose-600">
          Offline
        </p>
        <p v-else class="mt-2 text-lg font-semibold text-zinc-400">Checking…</p>
        <p class="mt-1 font-mono text-xs text-zinc-500">GET /api/health</p>
      </div>

      <RouterLink
        :to="{ name: 'notes' }"
        class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
      >
        <h2 class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Example feature</h2>
        <p class="mt-2 text-lg font-semibold">Notes <span aria-hidden="true">→</span></p>
        <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Migration, repository, service, route, API client, store and page.
        </p>
      </RouterLink>
    </div>
  </section>
</template>
