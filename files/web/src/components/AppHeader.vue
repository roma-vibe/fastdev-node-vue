<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { appName } from '@/config.ts';
import type { ApiStatus } from '@/stores/health.ts';

const props = defineProps<{
  status: ApiStatus;
  version?: string;
}>();

const STATUS_VIEW: Record<ApiStatus, { label: string; dot: string }> = {
  unknown: { label: 'Checking API…', dot: 'bg-zinc-400' },
  online: { label: 'API online', dot: 'bg-emerald-500' },
  offline: { label: 'API offline', dot: 'bg-rose-500' },
};

const links = [
  { name: 'home', label: 'Home' },
  { name: 'notes', label: 'Notes' },
] as const;

const initial = appName.trim().charAt(0).toUpperCase();
const statusView = computed(() => STATUS_VIEW[props.status]);
</script>

<template>
  <header
    class="sticky top-0 z-10 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80"
  >
    <div class="mx-auto flex h-16 max-w-4xl items-center gap-6 px-4 sm:px-6">
      <RouterLink
        :to="{ name: 'home' }"
        class="flex items-center gap-2.5 font-semibold tracking-tight"
      >
        <span
          class="grid size-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm"
          aria-hidden="true"
        >
          {{ initial }}
        </span>
        <span>{{ appName }}</span>
      </RouterLink>

      <nav class="flex items-center gap-1 text-sm">
        <RouterLink
          v-for="link in links"
          :key="link.name"
          :to="{ name: link.name }"
          class="rounded-md px-3 py-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          exact-active-class="bg-zinc-100 !text-zinc-900 dark:bg-zinc-800 dark:!text-zinc-100"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <div
        class="ml-auto flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"
        :title="version ? `Version ${version}` : undefined"
      >
        <span class="size-2 rounded-full" :class="statusView.dot" aria-hidden="true" />
        <span>{{ statusView.label }}</span>
      </div>
    </div>
  </header>
</template>
