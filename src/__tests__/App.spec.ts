import { describe, it, expect } from 'vitest'

import { shallowMount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('renders the app shell properly', () => {
    const wrapper = shallowMount(App, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
          RouterView: true,
        },
      },
    })

    expect(wrapper.text()).toContain('个人工具集')
    expect(wrapper.text()).toContain('Rust tracing → LogQL')
  })
})
