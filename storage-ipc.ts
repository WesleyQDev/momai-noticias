// storage-ipc.ts
// IPC storage bridge for MomAI Notícias persistent worker.

function codedError(code: string, message: string) {
  const err: any = new Error(message)
  err.code = code
  return err
}

export function createIpcNewsStorage({ send, onResponse, timeoutMs = 30000 }: {
  send: (msg: any) => void
  onResponse: (listener: (msg: any) => void) => void
  timeoutMs?: number
}) {
  let seq = 0
  const pending = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timer: any }>()

  onResponse((msg: any) => {
    if (!msg || msg.type !== 'storage-response' || !msg.requestId) return
    const entry = pending.get(msg.requestId)
    if (!entry) return
    pending.delete(msg.requestId)
    clearTimeout(entry.timer)
    const result = msg.result || {}
    if (result.ok === false) {
      entry.reject(codedError(result.errorCode || 'storage_error', result.error || 'storage request failed'))
      return
    }
    entry.resolve(result.value)
  })

  function call(method: string, args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = 'news-' + Date.now() + '.' + seq++
      const timer = setTimeout(() => {
        pending.delete(requestId)
        reject(new Error('storage IPC timeout: ' + method))
      }, timeoutMs)
      if (timer.unref) timer.unref()
      pending.set(requestId, { resolve, reject, timer })
      try {
        send({ type: 'storage-request', requestId, method, args })
      } catch (err) {
        pending.delete(requestId)
        clearTimeout(timer)
        reject(err)
      }
    })
  }

  function area(prefix: string, methods: string[]) {
    return Object.fromEntries(methods.map((name) => [name, (...args: any[]) => call(prefix + '.' + name, args)]))
  }

  const storageMethods = area('storage', ['get', 'set', 'getMany', 'setMany', 'delete', 'listKeys', 'migrate'])

  return {
    storage: {
      get: storageMethods.get as (key: string) => Promise<any>,
      set: async (key: string, value: any, opts?: any) => {
        await call('storage.set', opts === undefined ? [key, value] : [key, value, opts])
      },
      getMany: storageMethods.getMany,
      setMany: storageMethods.setMany,
      delete: async (key: string, opts?: any) => {
        await call('storage.delete', opts === undefined ? [key] : [key, opts])
      },
      listKeys: storageMethods.listKeys,
      migrate: storageMethods.migrate
    },
    collections: area('collections', ['insert', 'list', 'count', 'search', 'remove', 'clear', 'upsert', 'upsertMany']) as {
      insert: (collection: string, item: any) => Promise<void>
      list: (collection: string, filter?: any) => Promise<any[]>
      count: (collection: string, filter?: any) => Promise<number>
      search: (collection: string, query: string) => Promise<any[]>
      remove: (collection: string, filter: any) => Promise<void>
      clear: (collection: string) => Promise<void>
      upsert: (collection: string, filter: any, item: any) => Promise<void>
      upsertMany: (collection: string, items: any[]) => Promise<void>
    },
    sessionFiles: area('sessionFiles', ['write', 'read', 'list', 'remove'])
  }
}
