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

export interface ParseTracingMacroResult {
  ok: boolean
  data: ParsedTracingMacro | null
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

  const templateSegments = [
    message ? '{{.message}}' : '',
    ...fields.map((field) => `${field.key}={{.${field.key}}}`),
  ].filter(Boolean)
  const template = templateSegments.join(' ')

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
