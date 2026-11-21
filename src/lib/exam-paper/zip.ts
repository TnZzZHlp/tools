export interface ZipWriteEntry {
  name: string
  data: Uint8Array | string
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8')

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_unused, index) => {
  let c = index
  for (let bit = 0; bit < 8; bit += 1) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return c >>> 0
})

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0
    const tableValue = CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0
    crc = tableValue ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function getDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear())
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = Math.floor(date.getSeconds() / 2)

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f)
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f)
  return { dosTime, dosDate }
}

export function createZipBytes(entries: ZipWriteEntry[], now = new Date()): Uint8Array {
  const { dosTime, dosDate } = getDosDateTime(now)

  const prepared = entries.map((entry) => {
    const nameBytes = textEncoder.encode(entry.name)
    const contentBytes =
      typeof entry.data === 'string' ? textEncoder.encode(entry.data) : entry.data
    const crc = computeCrc32(contentBytes)
    return { nameBytes, contentBytes, crc }
  })

  let localSize = 0
  let centralSize = 0
  for (const item of prepared) {
    localSize += 30 + item.nameBytes.length + item.contentBytes.length
    centralSize += 46 + item.nameBytes.length
  }

  const totalSize = localSize + centralSize + 22
  const output = new Uint8Array(totalSize)
  const view = new DataView(output.buffer)

  let offset = 0
  const localOffsets: number[] = []

  for (const item of prepared) {
    localOffsets.push(offset)
    view.setUint32(offset, 0x04034b50, true)
    view.setUint16(offset + 4, 20, true)
    view.setUint16(offset + 6, 0x0800, true)
    view.setUint16(offset + 8, 0, true)
    view.setUint16(offset + 10, dosTime, true)
    view.setUint16(offset + 12, dosDate, true)
    view.setUint32(offset + 14, item.crc, true)
    view.setUint32(offset + 18, item.contentBytes.length, true)
    view.setUint32(offset + 22, item.contentBytes.length, true)
    view.setUint16(offset + 26, item.nameBytes.length, true)
    view.setUint16(offset + 28, 0, true)
    offset += 30

    output.set(item.nameBytes, offset)
    offset += item.nameBytes.length

    output.set(item.contentBytes, offset)
    offset += item.contentBytes.length
  }

  const centralDirectoryOffset = offset

  for (let i = 0; i < prepared.length; i += 1) {
    const item = prepared[i]
    const localOffset = localOffsets[i] ?? 0
    if (!item) continue

    view.setUint32(offset, 0x02014b50, true)
    view.setUint16(offset + 4, 20, true)
    view.setUint16(offset + 6, 20, true)
    view.setUint16(offset + 8, 0x0800, true)
    view.setUint16(offset + 10, 0, true)
    view.setUint16(offset + 12, dosTime, true)
    view.setUint16(offset + 14, dosDate, true)
    view.setUint32(offset + 16, item.crc, true)
    view.setUint32(offset + 20, item.contentBytes.length, true)
    view.setUint32(offset + 24, item.contentBytes.length, true)
    view.setUint16(offset + 28, item.nameBytes.length, true)
    view.setUint16(offset + 30, 0, true)
    view.setUint16(offset + 32, 0, true)
    view.setUint16(offset + 34, 0, true)
    view.setUint16(offset + 36, 0, true)
    view.setUint32(offset + 38, 0, true)
    view.setUint32(offset + 42, localOffset, true)
    offset += 46

    output.set(item.nameBytes, offset)
    offset += item.nameBytes.length
  }

  view.setUint32(offset, 0x06054b50, true)
  view.setUint16(offset + 4, 0, true)
  view.setUint16(offset + 6, 0, true)
  view.setUint16(offset + 8, prepared.length, true)
  view.setUint16(offset + 10, prepared.length, true)
  view.setUint32(offset + 12, centralSize, true)
  view.setUint32(offset + 16, centralDirectoryOffset, true)
  view.setUint16(offset + 20, 0, true)

  return output
}

async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('当前环境不支持 DEFLATE 解压，无法读取该 .docx 文件。')
  }

  const inputCopy = new Uint8Array(compressed.byteLength)
  inputCopy.set(compressed)

  const sourceStream = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(inputCopy)
      controller.close()
    },
  })

  const decompressedStream = sourceStream.pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = decompressedStream.getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0

  while (true) {
    const result = await reader.read()
    if (result.done) break
    if (result.value) {
      chunks.push(result.value)
      totalLength += result.value.byteLength
    }
  }

  const out = new Uint8Array(totalLength)
  let pos = 0
  for (const chunk of chunks) {
    out.set(chunk, pos)
    pos += chunk.byteLength
  }
  return out
}

function findEocdOffset(bytes: Uint8Array, view: DataView): number {
  const minOffset = Math.max(0, bytes.length - 65557)
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset
    }
  }
  return -1
}

export async function readZipEntries(
  input: ArrayBuffer | Uint8Array,
): Promise<Map<string, Uint8Array>> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.byteLength < 22) {
    throw new Error('文件过小，不是有效的 .docx (ZIP) 文件。')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocdOffset = findEocdOffset(bytes, view)
  if (eocdOffset < 0) {
    throw new Error('未找到 ZIP 目录结束标志，无法解析该 .docx 文件。')
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true)
  const centralDirOffset = view.getUint32(eocdOffset + 16, true)

  if (centralDirOffset >= bytes.byteLength) {
    throw new Error('ZIP 中央目录偏移越界，文件可能已损坏。')
  }

  const entries = new Map<string, Uint8Array>()
  let cursor = centralDirOffset

  for (let i = 0; i < totalEntries; i += 1) {
    if (cursor + 46 > bytes.byteLength || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error('ZIP 中央目录格式无效，文件可能已损坏。')
    }

    const compressionMethod = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const nameLen = view.getUint16(cursor + 28, true)
    const extraLen = view.getUint16(cursor + 30, true)
    const commentLen = view.getUint16(cursor + 32, true)
    const localHeaderOffset = view.getUint32(cursor + 42, true)

    const nameStart = cursor + 46
    const nameEnd = nameStart + nameLen
    if (nameEnd > bytes.byteLength) {
      throw new Error('ZIP 文件名长度越界。')
    }
    const entryName = textDecoder.decode(bytes.subarray(nameStart, nameEnd))
    cursor = nameEnd + extraLen + commentLen

    if (entryName.endsWith('/')) {
      continue
    }

    if (
      localHeaderOffset + 30 > bytes.byteLength ||
      view.getUint32(localHeaderOffset, true) !== 0x04034b50
    ) {
      throw new Error(`文件项“${entryName}”的本地文件头无效。`)
    }

    const localNameLen = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true)
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
    const dataEnd = dataStart + compressedSize

    if (dataEnd > bytes.byteLength) {
      throw new Error(`文件项“${entryName}”的数据长度越界。`)
    }

    const payload = bytes.subarray(dataStart, dataEnd)
    if (compressionMethod === 0) {
      entries.set(entryName, payload.slice())
    } else if (compressionMethod === 8) {
      entries.set(entryName, await inflateRaw(payload))
    } else {
      throw new Error(`不支持的 ZIP 压缩方式 (${compressionMethod})：${entryName}`)
    }
  }

  return entries
}
