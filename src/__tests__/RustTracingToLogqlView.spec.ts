import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import RustTracingToLogqlView from '@/views/RustTracingToLogqlView.vue'

describe('RustTracingToLogqlView', () => {
  it('renders the parsed template for the default example', () => {
    const wrapper = mount(RustTracingToLogqlView)
    const output = wrapper.get('[data-testid="logql-output"]').element as HTMLTextAreaElement

    expect(wrapper.text()).toContain('生成 LogQL 模板')
    expect(output.value).toContain(
      '{{.message}} manga_name={{.manga_name}} parsed_count={{.parsed_count}} skipped_count={{.skipped_count}}',
    )
  })

  it('updates output and parsed field list when input changes', async () => {
    const wrapper = mount(RustTracingToLogqlView)

    await wrapper
      .get('[data-testid="tracing-input"]')
      .setValue('error!(job_id = job.id, attempts = retry_count, "failed");')

    const output = wrapper.get('[data-testid="logql-output"]').element as HTMLTextAreaElement

    expect(output.value).toBe('{{.message}} job_id={{.job_id}} attempts={{.attempts}}')
    expect(wrapper.text()).toContain('job.id')
    expect(wrapper.text()).toContain('retry_count')
  })

  it('shows validation feedback for unsupported input', async () => {
    const wrapper = mount(RustTracingToLogqlView)

    await wrapper.get('[data-testid="tracing-input"]').setValue('println!("oops")')

    const output = wrapper.get('[data-testid="logql-output"]').element as HTMLTextAreaElement

    expect(wrapper.text()).toContain('暂时只支持 trace!/debug!/info!/warn!/error! 这类宏调用。')
    expect(output.value).toBe('')
  })
})
