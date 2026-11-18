<script setup lang="ts">
import type { Component, HTMLAttributes } from 'vue'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const props = defineProps<{
  title: string
  description?: string
  badge?: string
  icon?: Component
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <header
    :class="
      cn('mb-5 flex shrink-0 flex-wrap items-start justify-between gap-3 sm:mb-6', props.class)
    "
  >
    <div class="flex min-w-0 items-start gap-3">
      <div
        v-if="icon"
        class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card text-foreground shadow-xs sm:size-10"
        aria-hidden="true"
      >
        <component :is="icon" class="size-4.5 sm:size-5" />
      </div>
      <div class="min-w-0 space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {{ title }}
          </h1>
          <Badge v-if="badge" variant="secondary" class="font-normal">
            {{ badge }}
          </Badge>
          <slot name="badges" />
        </div>
        <p v-if="description" class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {{ description }}
        </p>
      </div>
    </div>

    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
