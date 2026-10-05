<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <section class="py-16 text-center">
    <p class="text-sm font-semibold text-indigo-600 dark:text-indigo-400">404</p>
    <h1 class="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
    <p class="mt-2 text-zinc-600 dark:text-zinc-400">
      The page you are looking for does not exist.
    </p>
    <RouterLink
      :to="{ name: 'home' }"
      class="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
    >
      Back home
    </RouterLink>
  </section>
</template>
