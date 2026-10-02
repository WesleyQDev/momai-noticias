import { existsSync } from 'node:fs'
import path from 'node:path'

export function resolveCatalogPath(
  extensionDir: string | undefined,
  runtimeDir: string,
  workingDir: string
): string | null {
  const candidates = [
    ...(extensionDir ? [path.join(extensionDir, 'sources', 'catalog.json')] : []),
    path.join(runtimeDir, 'sources', 'catalog.json'),
    path.join(runtimeDir, '..', 'sources', 'catalog.json'),
    path.join(workingDir, 'sources', 'catalog.json')
  ]

  return candidates.find((candidate) => existsSync(candidate)) || null
}
