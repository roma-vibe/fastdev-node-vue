<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import { useHealthStore } from '@/stores/health.ts';

const health = useHealthStore();

onMounted(() => {
  void health.check();
});
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader :status="health.status" :version="health.info?.version" />
    <main class="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <RouterView />
    </main>
  </div>
</template>
