<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  validateCustomTargetDraft,
  type CustomTargetDraft,
  type SpeedtestTarget,
} from '@/lib/speedtest'

const open = defineModel<boolean>('open', { default: false })

defineProps<{
  customTargets: readonly SpeedtestTarget[]
  activeTargetId: string
}>()

const emit = defineEmits<{
  add: [target: SpeedtestTarget]
  remove: [id: string]
  select: [id: string]
}>()

const draft = reactive<CustomTargetDraft>({
  name: '',
  ping: '',
  downloadText: '',
  uploadText: '',
})

const submitted = ref(false)
const errors = reactive<Partial<Record<keyof CustomTargetDraft, string>>>({})

function clearErrors() {
  errors.name = undefined
  errors.ping = undefined
  errors.downloadText = undefined
  errors.uploadText = undefined
}

function resetDraft() {
  draft.name = ''
  draft.ping = ''
  draft.downloadText = ''
  draft.uploadText = ''
  submitted.value = false
  clearErrors()
}

watch(open, (isOpen) => {
  if (isOpen) {
    submitted.value = false
    clearErrors()
  }
})

function handleSubmit() {
  submitted.value = true
  clearErrors()
  const result = validateCustomTargetDraft(draft)
  if (!result.valid || !result.target) {
    Object.assign(errors, result.errors)
    return
  }

  const created: SpeedtestTarget = {
    ...result.target,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  }
  emit('add', created)
  resetDraft()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto"
    >
      <DialogTitle>自定义测速源</DialogTitle>
      <DialogDescription>
        配置支持跨域（CORS）的自定义测速节点。下载测速需允许跨域 GET，上传测速需接受并丢弃 POST
        请求体（留空则跳过上传测试）。
      </DialogDescription>

      <div v-if="customTargets.length" class="mt-4 space-y-2">
        <p class="text-[12px] font-medium text-ink-muted">已保存的自定义节点</p>
        <ul class="space-y-2">
          <li
            v-for="item in customTargets"
            :key="item.id"
            class="flex items-center justify-between gap-3 rounded-control border border-line bg-surface px-3 py-2.5"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="truncate text-[14px] font-medium text-ink">{{ item.name }}</span>
                <Badge v-if="item.id === activeTargetId" variant="accent">当前</Badge>
                <Badge v-if="item.upload.length === 0" variant="outline">仅下载</Badge>
              </div>
              <p class="mt-0.5 truncate font-mono text-[12px] text-ink-muted">
                {{ item.download[0] }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <Button
                v-if="item.id !== activeTargetId"
                variant="secondary"
                size="sm"
                @click="emit('select', item.id)"
              >
                选用
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="w-8 px-0 text-ink-muted hover:text-danger"
                :aria-label="`删除 ${item.name}`"
                @click="emit('remove', item.id)"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          </li>
        </ul>

        <Separator class="my-4" />
      </div>

      <form class="mt-4 space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-1.5">
          <Label for="target-name" required>节点名称</Label>
          <Input
            id="target-name"
            v-model="draft.name"
            placeholder="例如：香港自建边缘节点"
            :invalid="submitted && Boolean(errors.name)"
          />
          <p v-if="submitted && errors.name" class="text-[12px] text-danger">{{ errors.name }}</p>
        </div>

        <div class="space-y-1.5">
          <Label for="target-download" required>下载测速 URL（支持多行或逗号分隔多域名）</Label>
          <Textarea
            id="target-download"
            v-model="draft.downloadText"
            class="min-h-20 font-mono text-[13px]"
            placeholder="https://cdn-a.example.com/100mb.bin&#10;https://cdn-b.example.com/100mb.bin"
            spellcheck="false"
            :invalid="submitted && Boolean(errors.downloadText)"
          />
          <p v-if="submitted && errors.downloadText" class="text-[12px] text-danger">
            {{ errors.downloadText }}
          </p>
        </div>

        <div class="grid gap-3.5 sm:grid-cols-2">
          <div class="space-y-1.5">
            <Label for="target-ping">延迟探测 URL（可选）</Label>
            <Input
              id="target-ping"
              v-model="draft.ping"
              class="font-mono text-[13px]"
              placeholder="默认使用首个下载 URL"
              spellcheck="false"
              :invalid="submitted && Boolean(errors.ping)"
            />
            <p v-if="submitted && errors.ping" class="text-[12px] text-danger">
              {{ errors.ping }}
            </p>
          </div>

          <div class="space-y-1.5">
            <Label for="target-upload">上传测速 URL（可选）</Label>
            <Input
              id="target-upload"
              v-model="draft.uploadText"
              class="font-mono text-[13px]"
              placeholder="留空则跳过上传测试"
              spellcheck="false"
              :invalid="submitted && Boolean(errors.uploadText)"
            />
            <p v-if="submitted && errors.uploadText" class="text-[12px] text-danger">
              {{ errors.uploadText }}
            </p>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <DialogClose as-child>
            <Button type="button" variant="ghost" size="sm">关闭</Button>
          </DialogClose>
          <Button type="submit" size="sm">
            <template #leading>
              <Plus class="size-4" />
            </template>
            添加并选用
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
