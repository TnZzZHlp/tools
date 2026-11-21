<script setup lang="ts">
defineProps<{ lines: number; label?: string; heading?: string; leadText?: string }>()
</script>
<template>
  <div v-for="index in lines" :key="index" class="line" data-writing-line>
    <div v-if="index === 1 && (heading || leadText)" class="lead">
      <strong v-if="heading">{{ heading }} </strong>{{ leadText }}<span class="tail" />
    </div>
    <template v-else>
      <slot v-if="index === 1" name="label">{{ label }}</slot>
      <span class="sheet-rule" />
    </template>
  </div>
</template>
<style scoped>
.line {
  display: flex;
  align-items: flex-end;
  gap: 1mm;
  min-height: var(--sheet-line-height, 8mm);
  line-height: var(--sheet-line-height, 8mm);
}
.line > :not(.lead, .sheet-rule) {
  line-height: 1.35;
}
.sheet-rule {
  flex: 1;
}
.lead {
  flex: 1;
  overflow: hidden;
}
.tail {
  display: inline-block;
  position: relative;
  width: 1mm;
}
.tail::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 500mm;
  border-bottom: 0.22mm solid;
}
</style>
