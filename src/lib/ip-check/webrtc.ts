import { isPrivateOrReservedIp, parseIpVersion } from './ip-utils'
import type { WebRtcProbeResult } from './types'

const RE_MDNS_CANDIDATE = /([0-9a-f-]+\.local)\s+\d+/i
const RE_IP_TOKEN = /([0-9a-fA-F:.]+)\s+\d+/

const DEFAULT_STUN_SERVERS = ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302']

export async function probeWebRtcIps(options?: {
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<WebRtcProbeResult> {
  if (typeof window === 'undefined' || typeof window.RTCPeerConnection !== 'function') {
    return {
      status: 'unsupported',
      publicIps: [],
      localIps: [],
      error: '当前浏览器不支持 RTCPeerConnection',
    }
  }

  const timeoutMs = options?.timeoutMs ?? 4500
  const publicSet = new Set<string>()
  const localSet = new Set<string>()

  return new Promise<WebRtcProbeResult>((resolve) => {
    let settled = false
    let pc: RTCPeerConnection | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = () => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      options?.signal?.removeEventListener('abort', onAbort)
      try {
        pc?.close()
      } catch {
        // Ignore close errors.
      }
      resolve({
        status: 'done',
        publicIps: Array.from(publicSet),
        localIps: Array.from(localSet),
      })
    }

    const onAbort = () => {
      finish()
    }

    if (options?.signal?.aborted) {
      finish()
      return
    }
    options?.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      pc = new RTCPeerConnection({
        iceServers: [{ urls: DEFAULT_STUN_SERVERS }],
      })

      pc.onicecandidate = (event) => {
        const line = event.candidate?.candidate
        if (!line) {
          finish()
          return
        }

        const mdnsMatch = RE_MDNS_CANDIDATE.exec(line)
        if (mdnsMatch?.[1]) {
          localSet.add(mdnsMatch[1])
          return
        }

        const ipMatch = RE_IP_TOKEN.exec(line)
        const candidateIp = ipMatch?.[1]
        if (!candidateIp) return
        const version = parseIpVersion(candidateIp)
        if (!version) return

        if (isPrivateOrReservedIp(candidateIp)) {
          localSet.add(candidateIp)
        } else {
          publicSet.add(candidateIp)
        }
      }

      pc.onicegatheringstatechange = () => {
        if (pc?.iceGatheringState === 'complete') {
          finish()
        }
      }

      pc.createDataChannel('ip-check')
      void pc
        .createOffer()
        .then((offer) => pc?.setLocalDescription(offer))
        .catch(() => {
          finish()
        })

      timer = setTimeout(finish, timeoutMs)
    } catch (error) {
      settled = true
      if (timer) clearTimeout(timer)
      options?.signal?.removeEventListener('abort', onAbort)
      resolve({
        status: 'unsupported',
        publicIps: [],
        localIps: [],
        error: error instanceof Error ? error.message : 'WebRTC 初始化失败',
      })
    }
  })
}
