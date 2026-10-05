<script setup lang="ts">
import type { Note } from '@/api/notes.ts';
import { formatDateTime } from '@/lib/format.ts';

defineProps<{
  note: Note;
}>();

const emit = defineEmits<{
  remove: [id: number];
}>();
</script>

<template>
  <article
    class="group rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h3 class="font-medium break-words">{{ note.title }}</h3>
        <p
          v-if="note.body"
          class="mt-1 text-sm break-words whitespace-pre-line text-zinc-600 dark:text-zinc-400"
        >
          {{ note.body }}
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-md p-1.5 text-zinc-400 opacity-60 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-rose-950/50"
        :aria-label="`Delete note ${note.title}`"
        @click="emit('remove', note.id)"
      >
        <svg viewBox="0 0 20 20" fill="none" class="size-4" aria-hidden="true">
          <path
            d="M5 5l10 10M15 5L5 15"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
    <p class="mt-3 text-xs text-zinc-500">
      <time :datetime="note.createdAt">{{ formatDateTime(note.createdAt) }}</time>
    </p>
  </article>
</template>
