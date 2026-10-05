<script setup lang="ts">
/** Presentational form: owns no data. The parent binds v-model:title / v-model:body and handles submit. */
defineProps<{
  busy?: boolean;
}>();

const emit = defineEmits<{
  submit: [];
}>();

const title = defineModel<string>('title', { required: true });
const body = defineModel<string>('body', { required: true });
</script>

<template>
  <form
    class="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    @submit.prevent="emit('submit')"
  >
    <label class="block">
      <span class="sr-only">Title</span>
      <input
        v-model="title"
        type="text"
        required
        maxlength="200"
        placeholder="Title"
        class="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base font-medium outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700"
      />
    </label>
    <label class="block">
      <span class="sr-only">Body</span>
      <textarea
        v-model="body"
        rows="3"
        maxlength="10000"
        placeholder="Write something…"
        class="w-full resize-y rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700"
      />
    </label>
    <div class="flex justify-end">
      <button
        type="submit"
        :disabled="busy || !title.trim()"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {{ busy ? 'Saving…' : 'Add note' }}
      </button>
    </div>
  </form>
</template>
