import { mount, RouterLinkStub } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AppHeader from '@/components/AppHeader.vue';

describe('AppHeader', () => {
  it('shows the app name from the environment and the API status', () => {
    const wrapper = mount(AppHeader, {
      props: { status: 'online', version: '1.2.3' },
      global: { stubs: { RouterLink: RouterLinkStub } },
    });

    expect(wrapper.text()).toContain('Test App');
    expect(wrapper.text()).toContain('API online');
  });
});
