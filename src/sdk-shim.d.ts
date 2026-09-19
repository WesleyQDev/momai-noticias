declare module 'momai:sdk' {
  export interface MomAISDK {
    storage: {
      get<T = any>(key: string): Promise<T | null>
      set(key: string, value: any, options?: { ttlMs?: number }): Promise<void>
      delete(key: string): Promise<void>
      listKeys(): Promise<string[]>
    }
    collections: {
      insert(collection: string, item: any): Promise<void>
      list<T = any>(collection: string, filter?: Record<string, any>): Promise<T[]>
      count(collection: string, filter?: Record<string, any>): Promise<number>
      search<T = any>(collection: string, query: string): Promise<T[]>
      remove(collection: string, filter: Record<string, any>): Promise<void>
      clear(collection: string): Promise<void>
      upsert(collection: string, filter: Record<string, any>, item: any): Promise<void>
      upsertMany(collection: string, items: any[]): Promise<void>
    }
    api: {
      get<T = any>(url: string, config?: any): Promise<T>
      post<T = any>(url: string, data?: any, config?: any): Promise<T>
      put<T = any>(url: string, data?: any, config?: any): Promise<T>
      delete<T = any>(url: string, config?: any): Promise<T>
    }
    ui: {
      overlayRoot(): HTMLElement | null
    }
    registry: {
      registerRenderer(type: string, component: any): void
      getRenderer(type: string): any
    }
    locale?: string
  }

  const sdk: MomAISDK
  export default sdk
  export function getSDK(): MomAISDK
}

declare module 'momai:registry' {
  export function registerRenderer(type: string, rendererComponent: any, extensionId?: string): void
  export function getRenderer(type: string): any
}

declare module '*.png' {
  const value: string
  export default value
}

