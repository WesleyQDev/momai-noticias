import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveCatalogPath } from '../src/services/catalog-path'

describe('resolveCatalogPath', () => {
  const temporaryDirectories: string[] = []

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('finds the catalog from the extension directory when the host has a different working directory', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'momai-news-catalog-'))
    temporaryDirectories.push(tempDir)

    const extensionDir = path.join(tempDir, 'momai-noticias')
    const catalogPath = path.join(extensionDir, 'sources', 'catalog.json')
    const hostDir = path.join(tempDir, 'apps', 'server')
    mkdirSync(path.dirname(catalogPath), { recursive: true })
    mkdirSync(hostDir, { recursive: true })
    writeFileSync(catalogPath, '[]', 'utf8')

    expect(resolveCatalogPath(extensionDir, hostDir, hostDir)).toBe(catalogPath)
  })

  it('finds the catalog relative to a bundled runtime in dist', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'momai-news-bundle-'))
    temporaryDirectories.push(tempDir)

    const extensionDir = path.join(tempDir, 'momai-noticias')
    const runtimeDir = path.join(extensionDir, 'dist')
    const catalogPath = path.join(extensionDir, 'sources', 'catalog.json')
    mkdirSync(path.dirname(catalogPath), { recursive: true })
    mkdirSync(runtimeDir, { recursive: true })
    writeFileSync(catalogPath, '[]', 'utf8')

    expect(resolveCatalogPath(undefined, runtimeDir, path.join(tempDir, 'apps', 'server'))).toBe(
      catalogPath
    )
  })
})
