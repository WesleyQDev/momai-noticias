export interface HeadlinesConfig {
  topic?: string
}

/** Empty topic means the general feed; any other value is a customization. */
export function isHeadlinesConfigCustomized(config?: Record<string, unknown> | null): boolean {
  const topic = (config as HeadlinesConfig | undefined)?.topic
  return typeof topic === 'string' && topic !== ''
}
