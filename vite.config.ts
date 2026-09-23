import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Static landing pages ship as their own HTML so search engines see real content
const LANDING_PAGES = ['lousa-online', 'whiteboard-mcp']

// Serve /lousa-online like production does (vercel.json rewrites it to /lousa-online/index.html)
function landingPageRoutes(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const path = req.url?.split('?')[0].replace(/\/$/, '').slice(1)
    if (path && LANDING_PAGES.includes(path)) req.url = `/${path}/index.html`
    next()
  }
  return {
    name: 'landing-page-routes',
    configureServer: (server) => { server.middlewares.use(rewrite) },
    configurePreviewServer: (server) => { server.middlewares.use(rewrite) },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), landingPageRoutes()],
  define: {
    'process.env.IS_PREACT': JSON.stringify('false'),
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...Object.fromEntries(LANDING_PAGES.map((page) => [page, resolve(__dirname, page, 'index.html')])),
      },
    },
  },
})
