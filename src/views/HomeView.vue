<script setup lang="ts">
import HoverUnderlineTitle from '@/components/HoverUnderlineTitle.vue'

const tools = [
  {
    name: '随机字符串生成器',
    description: '生成随机字符串，支持自定义字符类型、长度、批量生成、排除字符和 UUID 模式。',
    to: '/random-string',
  },
  {
    name: 'Rust tracing → LogQL',
    description: '提取 Rust tracing 宏并且生成适合 Loki / LogQL 使用的模板字符串。',
    to: '/tools/rust-tracing-to-logql',
  },
  {
    name: '编码解码',
    description: '在原始文本与编码结果之间实时转换，当前支持 Unicode 编码与解码。',
    to: '/tools/encoding',
  },
  {
    name: '吉他简谱记忆训练',
    description: '训练简谱、音名、唱名对应关系，并把全音/半音换算成吉他品格距离。',
    to: '/tools/guitar-note-trainer',
  },
  {
    name: 'OCR 识别',
    description: '粘贴图片或选择文件，自动识别成纯文本或 Markdown。',
    to: '/tools/ocr',
  },
  {
    name: '条码识别',
    description: '通过图片或摄像头实时识别二维码及常见条码，全程在浏览器本地处理。',
    to: '/tools/barcode-reader',
  },
  {
    name: 'MAC 地址识别',
    description: '连续识别设备屏幕上的 MAC 后四段，自动拼接前缀、去重并导出 CSV。',
    to: '/tools/mac-address-scanner',
  },
]
</script>

<template>
  <section class="space-y-6">
    <ul class="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      <li
        v-for="tool in tools"
        :key="tool.to"
        class="group cursor-pointer rounded-xl p-4 transition-colors active:bg-muted/70 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
        tabindex="0"
        role="link"
        @click="$router.push(tool.to)"
        @keydown.enter="$router.push(tool.to)"
        @keydown.space.prevent="$router.push(tool.to)"
      >
        <HoverUnderlineTitle class="mb-2">{{ tool.name }}</HoverUnderlineTitle>
        <p class="text-sm text-muted-foreground leading-relaxed">{{ tool.description }}</p>
      </li>
    </ul>
  </section>
</template>
