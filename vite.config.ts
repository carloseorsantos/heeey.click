import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), htmlRoutes()],
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
