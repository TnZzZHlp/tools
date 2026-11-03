export const readerFonts = [
  {
    value: 'serif',
    label: '系统宋体 / 衬线',
    family: '"Noto Serif CJK SC", "Songti SC", "STSong", "SimSun", Georgia, serif',
  },
  {
    value: 'sans',
    label: '系统黑体 / 无衬线',
    family: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  },
  {
    value: 'lxgw-wenkai',
    label: '霞鹜文楷',
    webFamily: 'LXGW WenKai',
    family: '"LXGW WenKai", "Songti SC", "SimSun", serif',
  },
  {
    value: 'source-han-serif',
    label: '思源宋体',
    webFamily: 'Source Han Serif SC',
    family: '"Source Han Serif SC", "Songti SC", "SimSun", serif',
  },
  {
    value: 'source-han-sans',
    label: '思源黑体',
    webFamily: 'Source Han Sans SC',
    family: '"Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
] as const

export type ReaderFont = (typeof readerFonts)[number]['value']
