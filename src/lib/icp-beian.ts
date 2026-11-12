const ENCODED = '2o+ZdH5t2Jm6Dw0PDw0KCwkOBNiyig=='
const KEY = 0x3d
const HOST = 'tnzzz.top'

function decode(encoded: string) {
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0) ^ KEY)
  return new TextDecoder().decode(bytes)
}

export function beianText(hostname = window.location.hostname) {
  if (hostname !== HOST && !hostname.endsWith(`.${HOST}`)) return ''
  return decode(ENCODED)
}
