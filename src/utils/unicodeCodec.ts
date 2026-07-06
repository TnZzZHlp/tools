export function encodeUnicode(value: string): string {
  let result = ''

  for (let index = 0; index < value.length; index += 1) {
    result += `\\u${value.charCodeAt(index).toString(16).toUpperCase().padStart(4, '0')}`
  }

  return result
}

export function decodeUnicode(value: string): string {
  return value.replace(
    /\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})/g,
    (match, codePointHex: string | undefined, codeUnitHex: string | undefined) => {
      if (codePointHex) {
        const codePoint = Number.parseInt(codePointHex, 16)
        return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match
      }

      return String.fromCharCode(Number.parseInt(codeUnitHex!, 16))
    },
  )
}
