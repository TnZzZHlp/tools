<script setup lang="ts">
import { FileStack, Info, ShieldCheck } from 'lucide-vue-next'

import PdfMergeTool from '@/components/pdf/PdfMergeTool.vue'
import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
</script>

<template>
  <div class="space-y-5 pb-10">
    <ToolPageHeader
      title="PDF 合并与旋转"
      description="选择或拖入多份 PDF，自由调整合并顺序与单页方向，在本地合成并下载。"
      :icon="FileStack"
    >
      <template #badges>
        <Badge variant="outline" class="gap-1 font-normal">
          <ShieldCheck class="size-3.5 text-emerald-600 dark:text-emerald-400" />
          本地离线处理
        </Badge>
      </template>

      <template #actions>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline" size="sm" class="gap-1.5">
              <Info class="size-4" />
              兼容性说明
            </Button>
          </TooltipTrigger>
          <TooltipContent class="max-w-80 space-y-1.5 text-xs leading-5">
            <p>所有文件仅在浏览器内存中处理，绝不上传至任何服务器。</p>
            <p>
              按文件顺序合并并保留内部页序；旋转角度会直接写入导出的
              PDF。交互式表单将转为静态内容，不保留数字签名与文档级书签；不支持加密 PDF 与 XFA
              表单。
            </p>
          </TooltipContent>
        </Tooltip>
      </template>
    </ToolPageHeader>

    <PdfMergeTool />
  </div>
</template>
