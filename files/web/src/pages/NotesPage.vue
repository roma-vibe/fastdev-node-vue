<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import NoteCard from '@/components/NoteCard.vue';
import NoteForm from '@/components/NoteForm.vue';
import { useNotesStore } from '@/stores/notes.ts';

const notes = useNotesStore();
const draft = reactive({ title: '', body: '' });

onMounted(() => {
  void notes.load();
});

async function createNote(): Promise<void> {
  if (await notes.create({ title: draft.title, body: draft.body })) {
    draft.title = '';
    draft.body = '';
  }
}
</script>

<template>
  <section class="space-y-8">
    <header>
      <h1 class="text-3xl font-semibold tracking-tight">Notes</h1>
      <p class="mt-1 text-zinc-600 dark:text-zinc-400">
        {{ notes.count === 1 ? '1 note' : `${notes.count} notes` }}
      </p>
    </header>

    <p
      v-if="notes.error"
      role="alert"
      class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
    >
      {{ notes.error }}
    </p>

    <NoteForm
      v-model:title="draft.title"
      v-model:body="draft.body"
      :busy="notes.saving"
      @submit="createNote"
    />

    <div v-if="notes.loading && !notes.loaded" class="space-y-3" aria-busy="true">
      <div
        v-for="n in 3"
        :key="n"
        class="h-20 animate-pulse rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70"
      />
    </div>
    <p
      v-else-if="notes.loaded && notes.count === 0"
      class="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700"
    >
      No notes yet. Add the first one above.
    </p>
    <ul v-else class="space-y-3">
      <li v-for="note in notes.items" :key="note.id">
        <NoteCard :note="note" @remove="notes.remove" />
      </li>
    </ul>
  </section>
</template>
