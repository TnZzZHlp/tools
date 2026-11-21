import { buildRenderedParagraphs, type RenderedParagraph } from './render'
import type { ExamDocument } from './types'
import { createZipBytes } from './zip'

export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

function stripIllegalXmlChars(input: string): string {
  let result = ''
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    const isAllowed =
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd)
    if (isAllowed) {
      result += input[i] ?? ''
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += (input[i] ?? '') + (input[i + 1] ?? '')
        i += 1
      }
    }
  }
  return result
}

export function escapeXml(text: string): string {
  return stripIllegalXmlChars(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildRunXml(text: string, rPrXml: string): string {
  return `<w:r>${rPrXml}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function renderParagraphXml(paragraph: RenderedParagraph): string {
  if (paragraph.role === 'title') {
    const rPr =
      '<w:rPr><w:rFonts w:ascii="宋体" w:eastAsia="宋体" w:hAnsi="宋体" w:cs="宋体" w:hint="eastAsia"/><w:b/><w:color w:val="000000"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>'
    return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:line="360" w:lineRule="auto"/>${rPr}</w:pPr>${buildRunXml(paragraph.text, rPr)}</w:p>`
  }

  if (paragraph.role === 'section-header') {
    const rPr =
      '<w:rPr><w:rFonts w:ascii="宋体" w:eastAsia="宋体" w:hAnsi="宋体" w:cs="宋体" w:hint="eastAsia"/><w:b/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
    return `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:line="360" w:lineRule="auto"/>${rPr}</w:pPr>${buildRunXml(paragraph.text, rPr)}</w:p>`
  }

  if (paragraph.role === 'group-delimiter') {
    const rPr =
      '<w:rPr><w:rFonts w:ascii="宋体" w:eastAsia="宋体" w:hAnsi="宋体" w:cs="宋体" w:hint="eastAsia"/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>'
    return `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:line="360" w:lineRule="auto"/>${rPr}</w:pPr>${buildRunXml(paragraph.text, rPr)}</w:p>`
  }

  const bodyRPr =
    '<w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="宋体" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:hint="eastAsia"/><w:color w:val="000000"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr>'
  return `<w:p><w:pPr><w:pStyle w:val="DefaultParagraph"/><w:spacing w:line="360" w:lineRule="auto"/>${bodyRPr}</w:pPr>${buildRunXml(paragraph.text, bodyRPr)}</w:p>`
}

export function buildExamDocumentXml(doc: ExamDocument): string {
  const paragraphs = buildRenderedParagraphs(doc)
  const bodyContent = paragraphs.map(renderParagraphXml).join('')
  const sectPr =
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" w:header="851" w:footer="992" w:gutter="0"/><w:cols w:space="425"/><w:docGrid w:type="lines" w:linePitch="312"/></w:sectPr>'

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}">` +
    `<w:body>${bodyContent}${sectPr}</w:body>` +
    '</w:document>'
  )
}

function buildContentTypesXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
    '<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>'
  )
}

function buildRootRelsXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>'
  )
}

function buildDocumentRelsXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>' +
    '</Relationships>'
  )
}

function buildStylesXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:styles xmlns:w="${W_NS}">` +
    '<w:docDefaults>' +
    '<w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="宋体" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault/>' +
    '</w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="a">' +
    '<w:name w:val="Normal"/>' +
    '<w:qFormat/>' +
    '<w:pPr><w:widowControl w:val="0"/><w:jc w:val="both"/></w:pPr>' +
    '<w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="宋体" w:hAnsi="Calibri" w:cs="Times New Roman"/><w:kern w:val="2"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr>' +
    '</w:style>' +
    '<w:style w:type="character" w:default="1" w:styleId="a0">' +
    '<w:name w:val="Default Paragraph Font"/>' +
    '<w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/>' +
    '</w:style>' +
    '<w:style w:type="paragraph" w:customStyle="1" w:styleId="DefaultParagraph">' +
    '<w:name w:val="DefaultParagraph"/>' +
    '<w:basedOn w:val="a"/>' +
    '<w:qFormat/>' +
    '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>' +
    '<w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="宋体" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:kern w:val="2"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr>' +
    '</w:style>' +
    '</w:styles>'
  )
}

function buildSettingsXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:settings xmlns:w="${W_NS}">` +
    '<w:bordersDoNotSurroundHeader/>' +
    '<w:bordersDoNotSurroundFooter/>' +
    '<w:defaultTabStop w:val="420"/>' +
    '<w:drawingGridVerticalSpacing w:val="156"/>' +
    '<w:characterSpacingControl w:val="compressPunctuation"/>' +
    '<w:compat>' +
    '<w:spaceForUL/>' +
    '<w:balanceSingleByteDoubleByteWidth/>' +
    '<w:doNotLeaveBackslashAlone/>' +
    '<w:ulTrailSpace/>' +
    '<w:doNotExpandShiftReturn/>' +
    '<w:adjustLineHeightInTable/>' +
    '<w:useFELayout/>' +
    '<w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="14"/>' +
    '</w:compat>' +
    '</w:settings>'
  )
}

function buildFontTableXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:fonts xmlns:w="${W_NS}">` +
    '<w:font w:name="Times New Roman"><w:charset w:val="00"/><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font>' +
    '<w:font w:name="宋体"><w:altName w:val="SimSun"/><w:charset w:val="86"/><w:family w:val="auto"/><w:pitch w:val="variable"/></w:font>' +
    '<w:font w:name="Calibri"><w:charset w:val="00"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>' +
    '</w:fonts>'
  )
}

function buildCorePropsXml(title: string, now: Date): string {
  const iso = now.toISOString()
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${escapeXml(title || '试卷')}</dc:title>` +
    '<dc:creator>Tools Exam Generator</dc:creator>' +
    '<cp:revision>1</cp:revision>' +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>` +
    '</cp:coreProperties>'
  )
}

function buildAppPropsXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
    '<Application>Microsoft Office Word</Application>' +
    '<AppVersion>16.0000</AppVersion>' +
    '</Properties>'
  )
}

export function buildExamDocxBytes(doc: ExamDocument, now = new Date()): Uint8Array {
  return createZipBytes(
    [
      { name: '[Content_Types].xml', data: buildContentTypesXml() },
      { name: '_rels/.rels', data: buildRootRelsXml() },
      { name: 'word/_rels/document.xml.rels', data: buildDocumentRelsXml() },
      { name: 'word/document.xml', data: buildExamDocumentXml(doc) },
      { name: 'word/styles.xml', data: buildStylesXml() },
      { name: 'word/settings.xml', data: buildSettingsXml() },
      { name: 'word/fontTable.xml', data: buildFontTableXml() },
      { name: 'docProps/core.xml', data: buildCorePropsXml(doc.title, now) },
      { name: 'docProps/app.xml', data: buildAppPropsXml() },
    ],
    now,
  )
}

export function buildExamDocxBlob(doc: ExamDocument, now = new Date()): Blob {
  const bytes = buildExamDocxBytes(doc, now)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: DOCX_MIME_TYPE })
}

export function sanitizeFilename(title: string): string {
  const cleaned = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[._]+|[._]+$/g, '')
  return cleaned || '试卷'
}

export function downloadDocxFile(doc: ExamDocument): string {
  const filename = `${sanitizeFilename(doc.title)}.docx`
  const blob = buildExamDocxBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}
