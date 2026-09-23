import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Mirrors the rewrites in vercel.json: `/` is the static landing page, `/mcp` the MCP
// landing page, and the React app (dashboard, boards, docs) is served from app/index.html.
const APP_ROUTE = /^\/(app|b|docs)(\/|$)/

function htmlRoutes(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const [path, query] = (req.url ?? '').split('?')
    const q = query ? `?${query}` : ''
    if (APP_ROUTE.test(path)) req.url = `/app/index.html${q}`
    else if (/^\/mcp\/?$/.test(path)) req.url = `/mcp/index.html${q}`
    next()
  }
  return {
    name: 'html-routes',
    configureServer: (server) => { server.middlewares.use(rewrite) },
    configurePreviewServer: (server) => { server.middlewares.use(rewrite) },
  }
}

// Excalidraw loads its fonts from esm.sh unless EXCALIDRAW_ASSET_PATH points elsewhere
// (set in app/index.html). Serving them ourselves keeps visitors' IPs away from a third-party
// CDN, the same issue as hot-linking Google Fonts under the GDPR.
const EXCALIDRAW_FONTS = resolve(__dirname, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts')
const EXCALIDRAW_ASSETS_URL = '/excalidraw-assets/fonts/'

function excalidrawFonts(): Plugin {
  let outDir = 'dist'
  return {
    name: 'excalidraw-fonts',
    configResolved: (config) => { outDir = resolve(config.root, config.build.outDir) },
    configureServer: (server) => {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        if (!path.startsWith(EXCALIDRAW_ASSETS_URL)) return next()
        const file = join(EXCALIDRAW_FONTS, decodeURIComponent(path.slice(EXCALIDRAW_ASSETS_URL.length)))
        if (!file.startsWith(EXCALIDRAW_FONTS) || !existsSync(file) || !statSync(file).isFile()) return next()
        res.setHeader('Content-Type', 'font/woff2')
        createReadStream(file).pipe(res)
      })
    },
    writeBundle: () => { cpSync(EXCALIDRAW_FONTS, join(outDir, EXCALIDRAW_ASSETS_URL), { recursive: true }) },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), htmlRoutes(), excalidrawFonts()],
  define: {
    'process.env.IS_PREACT': JSON.stringify('false'),
  },
  build: {
    rollupOptions: {
      input: {
        // Static landing pages ship as their own HTML so search engines see real content
        home: resolve(__dirname, 'index.html'),
        mcp: resolve(__dirname, 'mcp/index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
    },
  },
})
