import { build, context } from 'esbuild'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'))

mkdirSync(path.join(__dirname, 'dist'), { recursive: true })

const entries = []
if (manifest.ui?.page && existsSync(path.join(__dirname, 'src/page.tsx'))) {
  entries.push({ in: 'src/page.tsx', out: 'page' })
}
if (manifest.ui?.panel && existsSync(path.join(__dirname, 'src/panel.tsx'))) {
  entries.push({ in: 'src/panel.tsx', out: 'panel' })
}
if (Array.isArray(manifest.ui?.widgets)) {
  for (const widget of manifest.ui.widgets) {
    const entry = widget?.entry || widget?.file
    if (!entry || typeof entry !== 'string' || !entry.startsWith('dist/') || !entry.endsWith('.js')) continue
    const out = entry.slice('dist/'.length, -'.js'.length)
    const id = widget?.id
    const candidates = id ? [`src/widgets/${id}.tsx`, `src/widgets/${id}.ts`] : []
    for (const candidate of candidates) {
      if (existsSync(path.join(__dirname, candidate))) {
        entries.push({ in: candidate, out })
        break
      }
    }
  }
}

const makeHostGlobalsPlugin = {
  name: 'make-host-globals',
  setup(build) {
    const mapGlobal = (filter, globalName, namespace) => {
      build.onResolve({ filter }, (args) => {
        return { path: args.path, namespace }
      })
      build.onLoad({ filter, namespace }, () => {
        return {
          contents: `module.exports = ${globalName};`,
          loader: 'js'
        }
      })
    }
    mapGlobal(/^react$/, 'window.React', 'react-global')
    mapGlobal(/^react-dom$/, 'window.ReactDOM', 'react-dom-global')
    mapGlobal(/^react\/jsx-runtime$/, 'window.JSXRuntime', 'react-jsx-runtime-global')
    mapGlobal(/^momai:sdk$/, 'window.MomAISDK', 'sdk-global')
  }
}

// Locate MomAI renderer source
let momaiSrcDir = path.resolve(__dirname, '../../../../src/renderer/src')
if (!existsSync(momaiSrcDir)) {
  momaiSrcDir = path.resolve(__dirname, '../momai/apps/momai/src/renderer/src')
}
if (!existsSync(momaiSrcDir)) {
  momaiSrcDir = path.resolve(__dirname, '../../momai/apps/momai/src/renderer/src')
}

/** @type {import('esbuild').BuildOptions} */
const uiOptions = {
  entryPoints: entries.map((e) => ({ in: e.in, out: e.out })),
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  jsxImportSource: 'react',
  target: 'es2022',
  platform: 'browser',
  minify: process.env.NODE_ENV === 'production',
  sourcemap: true,
  outdir: 'dist',
  logLevel: 'info',
  loader: {
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.svg': 'dataurl'
  },
  nodePaths: [path.join(__dirname, 'node_modules')],
  plugins: [makeHostGlobalsPlugin],
  alias: {
    'momai:registry': path.resolve(momaiSrcDir, 'components/chat/SkillResponseRegistry.ts'),
    'momai:events': path.resolve(momaiSrcDir, 'hooks/useExtensionEvents.ts'),
    'momai:api': path.resolve(momaiSrcDir, 'services/api.ts'),
    'momai:constants': path.resolve(momaiSrcDir, 'constants.ts')
  }
}

/** @type {import('esbuild').BuildOptions} */
const runtimeOptions = {
  entryPoints: [{ in: 'runtime.ts', out: 'runtime' }],
  bundle: true,
  format: 'cjs',
  target: 'node20',
  platform: 'node',
  minify: false,
  sourcemap: true,
  outdir: 'dist',
  logLevel: 'info',
  packages: 'bundle'
}

if (process.argv.includes('--watch')) {
  const uiCtx = await context(uiOptions)
  await uiCtx.watch()
  console.log('[momai-noticias:build] Watching UI changes...')
} else {
  if (entries.length > 0) {
    await build(uiOptions)
    console.log('[momai-noticias:build] Built UI →', entries.map((e) => e.out + '.js').join(', '))
  }
  if (existsSync(path.join(__dirname, 'runtime.ts'))) {
    await build(runtimeOptions)
    console.log('[momai-noticias:build] Built Runtime → dist/runtime.js')
  }
}
