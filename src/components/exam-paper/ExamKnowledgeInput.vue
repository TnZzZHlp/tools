<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, X } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'

const props = withDefaults(
  defineProps<{
    modelValue: string
    suggestions?: string[]
    inputId?: string
    placeholder?: string
  }>(),
  {
    suggestions: () => [],
    inputId: undefined,
    placeholder: '输入知识点按回车或分号添加…',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const draft = ref('')

const chips = computed(() =>
  props.modelValue
    .split(/[；;、,，\r\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0),
)

const unusedSuggestions = computed(() => {
  const currentSet = new Set(chips.value)
  return props.suggestions.filter((item) => !currentSet.has(item)).slice(0, 6)
})

function commitTokens(raw: string) {
  const incoming = raw
    .split(/[；;、,，\r\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (incoming.length === 0) return

  const next = [...chips.value]
  const seen = new Set(next)
  for (const item of incoming) {
    if (!seen.has(item)) {
      seen.add(item)
      next.push(item)
    }
  }
  emit('update:modelValue', next.join('；'))
}

function commitDraft() {
  if (!draft.value.trim()) {
    draft.value = ''
    return
  }
  commitTokens(draft.value)
  draft.value = ''
}

function removeChipAt(index: number) {
  const next = chips.value.filter((_item, idx) => idx !== index)
  emit('update:modelValue', next.join('；'))
}

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (/[；;,，]/.test(value)) {
    commitTokens(value)
    draft.value = ''
    return
  }
  draft.value = value
}

function onPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text') ?? ''
  if (/[；;、,，\n]/.test(text)) {
    event.preventDefault()
    commitTokens(`${draft.value}；${text}`)
    draft.value = ''
  }
}

function onBackspace() {
  if (draft.value.length > 0 || chips.value.length === 0) return
  removeChipAt(chips.value.length - 1)
}
</script>

<template>
  <div class="space-y-1.5">
    <div
      class="flex min-h-10 flex-wrap items-center gap-1.5 rounded-control border border-line bg-control px-2.5 py-1.5 transition-colors focus-within:border-ink"
    >
      <Badge
        v-for="(chip, idx) in chips"
        :key="chip"
        variant="neutral"
        class="gap-1 bg-raised pr-1 text-[12px] font-normal text-ink"
      >
        <span>{{ chip }}</span>
        <button
          type="button"
          class="inline-flex size-4 items-center justify-center rounded-full text-ink-muted hover:bg-control hover:text-ink"
          :aria-label="`移除知识点 ${chip}`"
          @click="removeChipAt(idx)"
        >
          <X class="size-3" />
        </button>
      </Badge>

      <input
        :id="inputId"
        :value="draft"
        type="text"
        class="min-w-36 flex-1 bg-transparent py-0.5 text-[13px] text-ink outline-none placeholder:text-ink-muted"
        :placeholder="chips.length === 0 ? placeholder : '继续添加知识点…'"
        @input="onInput"
        @keydown.enter.prevent="commitDraft"
        @keydown.backspace="onBackspace"
        @paste="onPaste"
        @blur="commitDraft"
      />
    </div>

    <div v-if="unusedSuggestions.length > 0" class="flex flex-wrap items-center gap-1">
      <span class="text-[11px] text-ink-faint">复用本卷知识点：</span>
      <button
        v-for="suggestion in unusedSuggestions"
        :key="suggestion"
        type="button"
        class="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:border-ink/40 hover:text-ink"
        @click="commitTokens(suggestion)"
      >
        <Plus class="size-2.5" />
        {{ suggestion }}
      </button>
    </div>
  </div>
</template>
