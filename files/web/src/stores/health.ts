import { defineStore } from 'pinia';
import { ref } from 'vue';
import { type Health, healthApi } from '@/api/health.ts';

export type ApiStatus = 'unknown' | 'online' | 'offline';

/** Backend availability, shown in the header. */
export const useHealthStore = defineStore('health', () => {
  const status = ref<ApiStatus>('unknown');
  const info = ref<Health | null>(null);

  async function check(): Promise<void> {
    try {
      info.value = await healthApi.get();
      status.value = 'online';
    } catch {
      info.value = null;
      status.value = 'offline';
    }
  }

  return { status, info, check };
});
