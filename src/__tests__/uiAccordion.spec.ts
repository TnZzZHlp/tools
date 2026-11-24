import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { Accordion, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

describe('Accordion', () => {
  it('keeps both items expanded when defaultValue is an array and type is omitted', () => {
    const wrapper = mount(Accordion, {
      props: { defaultValue: ['first', 'second'] },
      slots: {
        default: () =>
          ['first', 'second'].map((value) =>
            h(AccordionItem, { key: value, value }, () => h(AccordionTrigger, {}, () => value)),
          ),
      },
    })

    expect(wrapper.findAll('button[aria-expanded="true"]')).toHaveLength(2)
  })
})
