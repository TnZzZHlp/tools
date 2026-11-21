export const SHEET_FONTS = {
  gaokaoPrint: {
    label: '高考印刷体（书宋 + Times）',
    family:
      '"Times New Roman", "FZShuSong-Z01", "方正书宋简体", "FZNewShuSong-Z10", "Noto Serif SC Variable", "Source Han Serif SC", "Songti SC", "STSong", SimSun, "宋体", serif',
    load: () => import('@fontsource-variable/noto-serif-sc/index.css'),
  },
  sourceSerif: {
    label: '思源宋体',
    family:
      '"Times New Roman", "Noto Serif SC Variable", "Source Han Serif SC", "Songti SC", "STSong", serif',
    load: () => import('@fontsource-variable/noto-serif-sc/index.css'),
  },
  systemSerif: {
    label: '系统宋体',
    family: '"Times New Roman", "Songti SC", "STSong", "Noto Serif CJK SC", SimSun, "宋体", serif',
  },
  sourceSans: {
    label: '思源黑体',
    family: '"Times New Roman", "Noto Sans SC Variable", "Source Han Sans SC", sans-serif',
    load: () => import('@fontsource-variable/noto-sans-sc/index.css'),
  },
  systemSans: {
    label: '系统黑体',
    family:
      '"Times New Roman", "PingFang SC", "Microsoft YaHei", "Heiti SC", "STHeiti", SimHei, "黑体", "Noto Sans CJK SC", sans-serif',
  },
} as const

export type SheetFont = keyof typeof SHEET_FONTS

export const DEFAULT_SHEET_FONT: SheetFont = 'gaokaoPrint'

export async function loadSheetFont(font: SheetFont): Promise<void> {
  const entry = SHEET_FONTS[font]
  if ('load' in entry) await entry.load()
}
