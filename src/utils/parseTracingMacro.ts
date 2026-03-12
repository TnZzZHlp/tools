const SUPPORTED_MACROS = ['trace', 'debug', 'info', 'warn', 'error'] as const

export interface ParsedTracingField {
  key: string
  expression: string
}

export interface ParsedTracingMacro {
  macroName: (typeof SUPPORTED_MACROS)[number]
  message: string | null
  fields: ParsedTracingField[]
  template: string
}

export interface ParsedTracingMacroBatch {
  macros: ParsedTracingMacro[]
  template: string
}

export interface ParseTracingMacroResult {
  ok: boolean
  data: ParsedTracingMacroBatch | null
  error: string | null
}

export function parseTracingMacro(input: string): ParseTracingMacroResult {
  const source = input.trim()

  if (!source) {
    return {
      ok: false,
      data: null,
      error: '请输入 Rust tracing 宏内容。',
    }
  }

  const statements = splitTopLevelStatements(source)

  if (statements.length === 0) {
    return {
      ok: false,
      data: null,
      error: '请输入 Rust tracing 宏内容。',
    }
  }

  const macros: ParsedTracingMacro[] = []

  for (const [index, statement] of statements.entries()) {
    const parsed = parseSingleTracingMacro(statement)

    if (!parsed.ok || !parsed.data) {
      return {
        ok: false,
        data: null,
        error:
          statements.length === 1 ? parsed.error : `第 ${index + 1} 条宏解析失败：${parsed.error}`,
      }
    }

    macros.push(parsed.data)
  }

  return {
    ok: true,
    data: {
      macros,
      template: buildBatchTemplate(macros),
    },
    error: null,
  }
}

function parseSingleTracingMacro(input: string): {
  ok: boolean
  data: ParsedTracingMacro | null
  error: string | null
} {
  const source = input.trim()

  const macroMatch = source.match(/^(trace|debug|info|warn|error)!\s*\(([\s\S]*)\)\s*;?$/)

  if (!macroMatch) {
    return {
      ok: false,
      data: null,
      error: '暂时只支持 trace!/debug!/info!/warn!/error! 这类宏调用。',
    }
  }

  const macroName = macroMatch[1]
  const innerSource = macroMatch[2] ?? ''
  const tokens = splitTopLevelArguments(innerSource)
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    return {
      ok: false,
      data: null,
      error: '宏里没有可解析的字段或消息。',
    }
  }

  let message: string | null = null
  const fields: ParsedTracingField[] = []

  for (const [index, token] of tokens.entries()) {
    if (isStringLiteral(token) && index === tokens.length - 1) {
      message = unquoteStringLiteral(token)
      continue
    }

    const equalIndex = findTopLevelEquals(token)

    if (equalIndex === -1) {
      return {
        ok: false,
        data: null,
        error: `暂不支持解析这一项：${token}`,
      }
    }

    const key = token.slice(0, equalIndex).trim()
    const expression = token.slice(equalIndex + 1).trim()

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return {
        ok: false,
        data: null,
        error: `字段名不合法：${key}`,
      }
    }

    if (!expression) {
      return {
        ok: false,
        data: null,
        error: `字段 ${key} 缺少右侧表达式。`,
      }
    }

    fields.push({ key, expression })
  }

  if (!message && fields.length === 0) {
    return {
      ok: false,
      data: null,
      error: '没有解析出任何字段。',
    }
  }

  const template = buildTemplate(message, fields)

  return {
    ok: true,
    data: {
      macroName: macroName as ParsedTracingMacro['macroName'],
      message,
      fields,
      template,
    },
    error: null,
  }
}

function splitTopLevelStatements(source: string): string[] {
  const statements: string[] = []
  let current = ''
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let inString = false
  let escaped = false

  for (const char of source) {
    current += char

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '(') {
      parenDepth += 1
      continue
    }

    if (char === ')') {
      parenDepth -= 1
      continue
    }

    if (char === '[') {
      bracketDepth += 1
      continue
    }

    if (char === ']') {
      bracketDepth -= 1
      continue
    }

    if (char === '{') {
      braceDepth += 1
      continue
    }

    if (char === '}') {
      braceDepth -= 1
      continue
    }

    if (char === ';' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      const statement = current.trim()

      if (statement) {
        statements.push(statement)
      }

      current = ''
    }
  }

  if (current.trim()) {
    statements.push(current.trim())
  }

  return statements
}

function buildTemplate(message: string | null, fields: ParsedTracingField[]): string {
  const segments = ['{{$hasContent := false}}']

  if (message) {
    segments.push('{{ with .message }}{{ . }}{{$hasContent = true}}{{ end }}')
  }

  for (const field of fields) {
    segments.push(
      `{{ with .${field.key} }}{{ if $hasContent }} {{ end }}${field.key}={{ . }}{{$hasContent = true}}{{ end }}`,
    )
  }

  return `| json | line_format "${segments.join('')}"`
}

function buildBatchTemplate(macros: ParsedTracingMacro[]): string {
  const seenFieldKeys = new Set<string>()
  const uniqueFields: ParsedTracingField[] = []

  for (const macro of macros) {
    for (const field of macro.fields) {
      if (seenFieldKeys.has(field.key)) {
        continue
      }

      seenFieldKeys.add(field.key)
      uniqueFields.push(field)
    }
  }

  const hasMessage = macros.some((macro) => macro.message !== null)

  return buildTemplate(hasMessage ? '__message__' : null, uniqueFields)
}

function splitTopLevelArguments(source: string): string[] {
  const tokens: string[] = []
  let current = ''
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let inString = false
  let escaped = false

  for (const char of source) {
    current += char

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '(') {
      parenDepth += 1
      continue
    }

    if (char === ')') {
      parenDepth -= 1
      continue
    }

    if (char === '[') {
      bracketDepth += 1
      continue
    }

    if (char === ']') {
      bracketDepth -= 1
      continue
    }

    if (char === '{') {
      braceDepth += 1
      continue
    }

    if (char === '}') {
      braceDepth -= 1
      continue
    }

    if (char === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      tokens.push(current.slice(0, -1))
      current = ''
    }
  }

  if (current.trim()) {
    tokens.push(current)
  }

  return tokens
}

function findTopLevelEquals(source: string): number {
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (char === '\\') {
        escaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '(') {
      parenDepth += 1
      continue
    }

    if (char === ')') {
      parenDepth -= 1
      continue
    }

    if (char === '[') {
      bracketDepth += 1
      continue
    }

    if (char === ']') {
      bracketDepth -= 1
      continue
    }

    if (char === '{') {
      braceDepth += 1
      continue
    }

    if (char === '}') {
      braceDepth -= 1
      continue
    }

    if (char === '=' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      return index
    }
  }

  return -1
}

function isStringLiteral(source: string): boolean {
  const trimmed = source.trim()
  return trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2
}

function unquoteStringLiteral(source: string): string {
  const trimmed = source.trim()
  const inner = trimmed.slice(1, -1)

  return inner
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}
