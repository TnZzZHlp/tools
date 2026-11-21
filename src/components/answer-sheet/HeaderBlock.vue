<script setup lang="ts">
import type { SheetMeta } from '@/lib/answer-sheet/types'
import BubbleMark from './blocks/BubbleMark.vue'

defineProps<{ meta: SheetMeta; columnWidthMm: number }>()
</script>

<template>
  <header class="sheet-header" :class="{ narrow: columnWidthMm < 160 }">
    <h2>{{ meta.title }}</h2>
    <p v-if="meta.subtitle" class="subtitle">{{ meta.subtitle }}</p>
    <div class="fields">
      <div v-for="(field, index) in meta.studentFields" :key="index">
        <span>{{ field }}:</span><span class="sheet-rule" />
      </div>
    </div>
    <div class="header-details">
      <div class="notice">
        <div class="notice-body">
          <p class="notice-heading">注意事项:</p>
          <ol class="notice-list">
            <li v-if="meta.headerMode === 'barcode'">
              答题前,考生务必用黑色字迹的钢笔或者铅笔填写准考证号和姓名等,将条形码正确粘贴到指定的条形码粘贴区域。
            </li>
            <li v-else>
              答题前,考生务必用黑色字迹的钢笔或者铅笔填写准考证号和姓名等,再用2B铅笔把准考证号的对应数字涂黑。
            </li>
            <li>保持卡面整洁,不要折叠,不要弄破</li>
            <li>考生不得填涂缺考。</li>
            <li>必须在题号对应的答题区域内作答,超出答题区域书写无效。</li>
          </ol>
        </div>
        <div class="examples">
          <span>正确填涂</span>
          <span class="sample-filled" aria-hidden="true" />
          <span class="absent-label">缺考标记</span>
          <BubbleMark option="" />
        </div>
      </div>

      <div v-if="meta.headerMode === 'barcode'" class="id-area barcode">
        <div class="barcode-outline">
          <div class="barcode-cells" aria-hidden="true">
            <span v-for="cell in 10" :key="cell" />
          </div>
          <span class="barcode-caption">条形码粘贴区</span>
        </div>
      </div>

      <div v-else class="id-area id-grid-box">
        <div class="id-title">准 考 证 号</div>
        <div class="id-columns">
          <div v-for="column in 10" :key="column" class="id-column">
            <span class="id-write-cell" />
            <div class="id-bubbles">
              <BubbleMark v-for="digit in 10" :key="digit" :option="String(digit - 1)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.sheet-header {
  overflow-wrap: anywhere;
  padding-bottom: 2.6mm;
}
h2 {
  margin: 0 0 2mm;
  text-align: center;
  font-size: 16.5pt;
  font-weight: 700;
  font-family:
    'Times New Roman', 'FZHei-B01', '方正黑体简体', 'Noto Sans SC Variable', 'Source Han Sans SC',
    'PingFang SC', 'Microsoft YaHei', 'Heiti SC', 'STHeiti', SimHei, '黑体', sans-serif;
}
.subtitle {
  margin: 0 0 1.5mm;
  text-align: center;
  font-size: 9pt;
}
.fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 3mm;
  margin-top: 2mm;
  font-size: 9pt;
}
.fields > div {
  display: flex;
  align-items: baseline;
  gap: 1.5mm;
}
.fields .sheet-rule {
  flex: 1;
  min-width: 12mm;
}
.header-details {
  display: grid;
  grid-template-columns: 1.08fr 1fr;
  gap: 2.6mm;
  margin-top: 2mm;
  min-height: 61.5mm;
}
.narrow .fields {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.narrow .header-details {
  grid-template-columns: 1fr;
  min-height: 0;
}
.notice {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 0.25mm dashed;
  font-size: 9pt;
}
.notice-body {
  padding: 2mm 2.2mm 1.5mm;
}
.notice-heading {
  margin: 0 0 1.2mm;
}
.notice-list {
  list-style: decimal inside;
  padding: 0;
  margin: 0;
  line-height: 1.55;
}
.notice-list li {
  margin-block: 1mm;
}
.examples {
  display: flex;
  align-items: center;
  gap: 2mm;
  border-top: 0.25mm dashed;
  padding: 1.8mm 2.2mm;
  font-size: 9pt;
}
.sample-filled {
  display: inline-block;
  width: 3.8mm;
  height: 2.2mm;
  background: currentColor;
}
.absent-label {
  margin-left: 2mm;
}
.id-area {
  border: 0.27mm solid;
  font-size: 9pt;
}
.barcode {
  border-radius: 1.3mm;
  padding: 2.5mm;
  display: grid;
  place-items: center;
}
.barcode-outline {
  width: 100%;
  border: 0.25mm dashed;
}
.barcode-cells {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  border-bottom: 0.25mm dashed;
}
.barcode-cells span {
  height: 7.9mm;
}
.barcode-cells span + span {
  border-inline-start: 0.25mm solid;
}
.barcode-caption {
  display: grid;
  min-height: 28.8mm;
  place-items: center;
}
.id-grid-box {
  display: flex;
  flex-direction: column;
  padding: 0;
}
.id-title {
  display: grid;
  place-items: center;
  height: 9.8mm;
  border-bottom: 0.26mm solid;
  font-size: 9.5pt;
  letter-spacing: 1.5mm;
}
.id-columns {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
}
.id-column {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.id-column + .id-column {
  border-inline-start: 0.25mm solid;
}
.id-write-cell {
  width: 100%;
  height: 7.8mm;
  border-bottom: 0.25mm solid;
}
.id-bubbles {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  align-items: center;
  padding-block: 1mm;
  gap: 0.5mm;
}
</style>
