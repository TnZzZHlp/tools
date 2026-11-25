<script setup lang="ts">
import { computed, inject, useAttrs } from 'vue'
import type { ClassValue } from 'clsx'
import { cn } from '@/lib/utils'
import { MenuItem as SdkMenuItem } from '@ui-sdk/vue/menu'
import { emitMenuSelect, menuRadioValue } from './selection'
import { menuItem } from './styles'

defineOptions({ inheritAttrs: false })

export type DropdownMenuRadioItemProps = {
  value: string
  disabled?: boolean
  textValue?: string
}

const props = withDefaults(defineProps<DropdownMenuRadioItemProps>(), {
  disabled: false,
  textValue: undefined,
})

const emit = defineEmits<{ select: [event: Event] }>()

const model = inject(menuRadioValue)
const checked = computed(() => model?.value === props.value)

function onSelect(event: Event) {
  emitMenuSelect(event, (select) => emit('select', select))
  if (model) model.value = props.value
}

const attrs = useAttrs()
const forwarded = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  return rest
})
</script>

<template>
  <SdkMenuItem
    v-bind="forwarded"
    :disabled="disabled"
    :label="textValue"
    :class="cn(menuItem, attrs.class as ClassValue)"
    @select="onSelect"
  >
    <template #render="{ props: part }">
      <div
        v-bind="part"
        role="menuitemradio"
        :aria-checked="checked"
        :data-state="checked ? 'checked' : 'unchecked'"
      >
        <span class="flex size-3.5 shrink-0 items-center justify-center">
          <Transition
            enter-active-class="motion-safe:animate-check-in"
            leave-active-class="motion-safe:animate-check-out"
          >
            <span v-if="checked" class="flex items-center justify-center text-ink">
              <slot name="indicator"><span class="size-1.5 rounded-full bg-ink" /></slot>
            </span>
          </Transition>
        </span>
        <slot />
      </div>
    </template>
  </SdkMenuItem>
</template>
