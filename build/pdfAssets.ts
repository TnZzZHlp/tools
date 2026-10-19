import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readFileSync, readdirSync } from 'node:fs'
import type { Plugin } from 'vite'

export function pdfAssets(): Plugin {
  const root = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))
  const assets = new Map<string, string>()
  for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
    for (const name of readdirSync(join(root, directory))) {
      if (/\.(bcmap|ttf|pfb|wasm|m?js|icc)$/.test(name) || name.startsWith('LICENSE')) {
        assets.set(`pdf-assets/${directory}/${name}`, join(root, directory, name))
      }
    }
  }
  return {
    name: 'pdf-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        const asset = assets.get(pathname.replace(/^\//, ''))
        if (!asset) return next()
        response.setHeader(
          'Content-Type',
          asset.endsWith('.wasm')
            ? 'application/wasm'
            : /\.m?js$/.test(asset)
              ? 'text/javascript'
              : 'application/octet-stream',
        )
        response.end(readFileSync(asset))
      })
    },
    generateBundle() {
      for (const [fileName, path] of assets) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(path) })
      }
    },
  }
}
