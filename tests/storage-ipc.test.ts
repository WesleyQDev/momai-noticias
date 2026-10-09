import { describe, expect, it } from 'vitest'
import { createIpcNewsStorage } from '../storage-ipc'

describe('storage IPC bridge', () => {
  it('sends the extension id with every storage request', async () => {
    const previous = process.env.MOMAI_EXTENSION_ID
    process.env.MOMAI_EXTENSION_ID = 'momai-noticias'

    const sent: any[] = []
    let listener: ((msg: any) => void) | null = null
    const bridge = createIpcNewsStorage({
      send: (msg: any) => {
        sent.push(msg)
        if (msg.type === 'storage-request') {
          listener?.({ type: 'storage-response', requestId: msg.requestId, result: { ok: true, value: null } })
        }
      },
      onResponse: (fn) => {
        listener = fn
      }
    })

    try {
      await bridge.storage.get('news_user_profile')
      const request = sent.find((msg) => msg.type === 'storage-request')
      expect(request?.extensionId).toBe('momai-noticias')
    } finally {
      if (previous === undefined) delete process.env.MOMAI_EXTENSION_ID
      else process.env.MOMAI_EXTENSION_ID = previous
    }
  })

  it('rejects when the host answers with an error', async () => {
    let listener: ((msg: any) => void) | null = null
    const bridge = createIpcNewsStorage({
      send: (msg: any) => {
        if (msg.type === 'storage-request') {
          listener?.({ type: 'storage-response', requestId: msg.requestId, result: { ok: false, error: 'quota_exceeded' } })
        }
      },
      onResponse: (fn) => {
        listener = fn
      }
    })

    await expect(bridge.storage.set('k', 1)).rejects.toThrow('quota_exceeded')
  })
})
