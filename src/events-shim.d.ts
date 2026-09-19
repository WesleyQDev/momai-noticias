/**
 * Type-only bridge for the host `momai:events` module.
 * The bundler aliases it to the real renderer hook; tsc resolves it here
 * so host sources (and their ambient globals) never enter this program.
 */
declare module 'momai:events' {
  export type ExtensionEvent = any
  export function useExtensionEvents(options: {
    eventType?: string
    onEvent?: (event: any) => void
  }): {
    events: any[]
    latestEvent: any | null
    clearEvents: () => void
  }
}
