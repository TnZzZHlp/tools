import type { Component } from 'vue'
import { ref } from 'vue'
import {
  Barcode,
  Binary,
  Braces,
  Cpu,
  FileStack,
  FileText,
  Gauge,
  Guitar,
  QrCode,
  Radar,
  Shuffle,
} from 'lucide-vue-next'

export type ToolCategoryId = 'network' | 'document' | 'barcode' | 'dev' | 'learn' | 'company'

export interface ToolCategory {
  id: ToolCategoryId
  label: string
  hiddenOnHome?: boolean
}

export interface ToolDefinition {
  id: string
  name: string
  shortName: string
  description: string
  to: string
  category: ToolCategoryId
  icon: Component
  keywords: string[]
}

export interface BreadcrumbItem {
  label: string
  to?: string
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  { id: 'network', label: '网络与测速' },
  { id: 'document', label: '文档与图像' },
  { id: 'barcode', label: '条码与扫描' },
  { id: 'dev', label: '开发与文本' },
  { id: 'learn', label: '音乐与训练' },
  { id: 'company', label: 'Company', hiddenOnHome: true },
]

export const TOOLS: ToolDefinition[] = [
  {
    id: 'speedtest',
    name: '网络测速',
    shortName: '网络测速',
    description: '测量下载与上传吞吐量、空闲及负载延迟、抖动，并检测本机 IP 与运营商归属。',
    to: '/tools/speedtest',
    category: 'network',
    icon: Gauge,
    keywords: [
      'speedtest',
      'speed',
      'network',
      'ping',
      'latency',
      'jitter',
      'bandwidth',
      'cloudflare',
      '网速',
      '测速',
      '带宽',
      '延迟',
      '抖动',
      'ip',
    ],
  },
  {
    id: 'ip-check',
    name: 'IP 归属与质量检测',
    shortName: 'IP 检测',
    description:
      '检测本机国内外分流与 IPv4/IPv6 双栈出口，支持任意 IP 或域名查询、多源数据库对比、原生/广播识别、风险评分、BGP/C 段与 WebRTC 泄露检测。',
    to: '/tools/ip-check',
    category: 'network',
    icon: Radar,
    keywords: [
      'ip',
      'iplark',
      'ipv4',
      'ipv6',
      'asn',
      'bgp',
      'webrtc',
      'ptr',
      'whois',
      'risk',
      'proxy',
      '原生ip',
      '广播ip',
      '归属地',
      '分流',
      '代理检测',
      '风险评分',
    ],
  },
  {
    id: 'pdf-merge',
    name: 'PDF 合并与旋转',
    shortName: 'PDF 合并',
    description: '合并多份 PDF 文档，拖拽调整顺序，预览并旋转单页或整份文件，全程本地处理。',
    to: '/tools/files/pdf-merge',
    category: 'document',
    icon: FileStack,
    keywords: ['pdf', 'merge', 'rotate', '文件处理', '合并', '旋转', '文档'],
  },
  {
    id: 'answer-sheet',
    name: '智能答题卡工作台',
    shortName: '智能答题卡',
    description:
      '新高考 9 科智能答题卡生成与微调工作台，支持 A3 三栏/两栏、8 开两栏与 A4 单栏物理毫米排版、画布直觉微调与矢量打印。',
    to: '/tools/answer-sheet',
    category: 'company',
    icon: FileStack,
    keywords: ['答题卡', '样卷', '新高考', 'answer sheet', '排版', 'A3', '8开', 'company'],
  },
  {
    id: 'exam-paper',
    name: '试卷模板生成',
    shortName: '试卷模板',
    description:
      '可视化编辑试卷大纲与题组，支持从文本、DOCX、PDF 或 JSON 导入解析并一键导出标准 Word 试卷模板。',
    to: '/tools/exam-paper',
    category: 'company',
    icon: FileText,
    keywords: ['exam', 'paper', 'docx', 'word', '试卷', '模板', '组卷', '出题', 'company'],
  },
  {
    id: 'barcode-generator',
    name: '条形码批量生成',
    shortName: '条形码生成',
    description: '批量生成 CODE128 条码，自定义毫米尺寸并按 A4 自动排版导出 PDF、JPG 或 SVG。',
    to: '/tools/barcode-generator',
    category: 'barcode',
    icon: Barcode,
    keywords: ['barcode', 'code128', 'a4', '条形码', '生成', '打印', '标签'],
  },
  {
    id: 'barcode-reader',
    name: '二维码 / 条码识别',
    shortName: '条码识别',
    description: '上传粘贴图片或使用摄像头实时识别二维码与常见一维、二维条码，本地离线解析。',
    to: '/tools/barcode-reader',
    category: 'barcode',
    icon: QrCode,
    keywords: ['qrcode', 'barcode', 'scan', '二维码', '条码识别', '扫码', '摄像头'],
  },
  {
    id: 'mac-address-scanner',
    name: 'MAC 地址扫描录入',
    shortName: 'MAC 地址识别',
    description: '通过摄像头或照片连续识别设备屏幕上的 MAC 后四段，自动拼接前缀、去重并导出 CSV。',
    to: '/tools/mac-address-scanner',
    category: 'barcode',
    icon: Cpu,
    keywords: ['mac', 'ocr', 'csv', '网卡', '地址', '扫描', '设备录入'],
  },
  {
    id: 'random-string',
    name: '随机字符串生成',
    shortName: '随机字符串',
    description: '一键生成高强度密码、API 密钥、验证码或标准 UUID v4，支持排除易混淆字符。',
    to: '/random-string',
    category: 'dev',
    icon: Shuffle,
    keywords: ['random', 'uuid', 'password', 'token', 'key', '随机', '密码', '字符串'],
  },
  {
    id: 'encoding',
    name: 'Unicode 编码解码',
    shortName: '编码解码',
    description: '在原始文本与 \\uXXXX / \\u{XXXXX} 转义序列之间双向实时互转，即输即得。',
    to: '/tools/encoding',
    category: 'dev',
    icon: Binary,
    keywords: ['unicode', 'encode', 'decode', '编码', '解码', '转义'],
  },
  {
    id: 'rust-tracing-to-logql',
    name: 'Rust tracing → LogQL',
    shortName: 'Tracing 转 LogQL',
    description: '解析 Rust tracing 日志宏并提取结构化字段，自动生成 Grafana Loki / LogQL 模板。',
    to: '/tools/rust-tracing-to-logql',
    category: 'dev',
    icon: Braces,
    keywords: ['rust', 'tracing', 'loki', 'logql', 'grafana', '日志', '宏'],
  },
  {
    id: 'guitar-note-trainer',
    name: '吉他简谱记忆训练',
    shortName: '吉他简谱训练',
    description: '对照记忆简谱、音名、唱名，结合吉他合成音色听音辨位与同弦品格距离闯关。',
    to: '/tools/guitar-note-trainer',
    category: 'learn',
    icon: Guitar,
    keywords: ['guitar', 'music', '吉他', '简谱', '音名', '唱名', '听音', '指板'],
  },
]

const CATEGORY_MAP = new Map<ToolCategoryId, string>(
  TOOL_CATEGORIES.map((item) => [item.id, item.label]),
)

const HIDDEN_HOME_CATEGORIES = new Set<ToolCategoryId>(
  TOOL_CATEGORIES.filter((item) => item.hiddenOnHome).map((item) => item.id),
)

export const HOME_TOOL_CATEGORIES: ToolCategory[] = TOOL_CATEGORIES.filter(
  (item) => !item.hiddenOnHome,
)

export const HOME_TOOLS: ToolDefinition[] = TOOLS.filter(
  (tool) => !HIDDEN_HOME_CATEGORIES.has(tool.category),
)

export function getCategoryLabel(categoryId: ToolCategoryId): string {
  return CATEGORY_MAP.get(categoryId) ?? categoryId
}

export function findToolByPath(path: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.to === path)
}

export function resolveRouteBreadcrumbs(path: string): BreadcrumbItem[] {
  if (path === '/') return []

  const matchedTool = findToolByPath(path)
  if (matchedTool) {
    const categoryCrumb: BreadcrumbItem =
      matchedTool.category === 'company'
        ? { label: getCategoryLabel(matchedTool.category), to: '/company' }
        : { label: getCategoryLabel(matchedTool.category) }
    return [{ label: '首页', to: '/' }, categoryCrumb, { label: matchedTool.shortName }]
  }

  if (path === '/company') {
    return [{ label: '首页', to: '/' }, { label: 'Company' }]
  }

  if (path === '/tools/files') {
    return [{ label: '首页', to: '/' }, { label: '文件处理' }]
  }

  if (path === '/novels') {
    return [{ label: '首页', to: '/' }, { label: '小说阅读' }]
  }

  if (path.startsWith('/novels/')) {
    return [{ label: '首页', to: '/' }, { label: '小说阅读', to: '/novels' }, { label: '作品目录' }]
  }

  if (path === '/randomyuri') {
    return [{ label: '首页', to: '/' }, { label: '随机图片' }]
  }

  return [{ label: '首页', to: '/' }, { label: '工具' }]
}

export function resolveBackTarget(path: string): string {
  if (path.startsWith('/novels/') && path !== '/novels') {
    return '/novels'
  }
  if (findToolByPath(path)?.category === 'company') {
    return '/company'
  }
  return '/'
}

const RECENT_STORAGE_KEY = 'tools:recent-ids'
const MAX_RECENT_TOOLS = 4
const recentIds = ref<string[]>(loadRecentIds())

function loadRecentIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_RECENT_TOOLS)
  } catch {
    return []
  }
}

export function recordRecentTool(path: string) {
  const tool = findToolByPath(path)
  if (!tool) return
  const next = [tool.id, ...recentIds.value.filter((id) => id !== tool.id)].slice(
    0,
    MAX_RECENT_TOOLS,
  )
  recentIds.value = next
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage failures.
  }
}

export function useRecentTools() {
  return {
    recentIds,
  }
}
