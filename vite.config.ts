import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'

/* The dev server's root is the whole project, so by default it will hand out any
   file in it — the Node backend (api/, including api/.env), the Python assistant,
   dbinfo.txt, docker/nginx config — and `?raw` slips past Vite's own .env block
   on 7.3.1. This guard runs before Vite's middlewares and only lets the frontend
   through: src/, node_modules/, index.html and public assets.

   It decides on the RESOLVED FILE PATH, not on the URL text. An earlier version
   compared the first URL segment against a list of blocked names, which a URL can
   be spelled around: the same file is reachable through /@fs/ with an absolute
   path, through an extension Vite fills in by itself, or through a different
   extension that resolves to the same module (audit F2/F8). Those all differ as
   text but land on one path, so the path is what gets checked here. */

/* Who the dev server answers: this machine and private LAN ranges. Even when it
   is started with --host on a public server, internet visitors get a 403 instead
   of the application source (audit Finding 2) — a public site must serve the
   production build (`npm run build` + `vite preview` / nginx). */
const LOCAL_CLIENTS = new net.BlockList()
LOCAL_CLIENTS.addSubnet('127.0.0.0', 8, 'ipv4')
LOCAL_CLIENTS.addSubnet('10.0.0.0', 8, 'ipv4')
LOCAL_CLIENTS.addSubnet('172.16.0.0', 12, 'ipv4')
LOCAL_CLIENTS.addSubnet('192.168.0.0', 16, 'ipv4')
LOCAL_CLIENTS.addSubnet('169.254.0.0', 16, 'ipv4')
LOCAL_CLIENTS.addAddress('::1', 'ipv6')
LOCAL_CLIENTS.addSubnet('fc00::', 7, 'ipv6')
LOCAL_CLIENTS.addSubnet('fe80::', 10, 'ipv6')

function isLocalClient(address: string | undefined): boolean {
  if (!address) return false
  const a = address.startsWith('::ffff:') ? address.slice(7) : address
  if (net.isIPv4(a)) return LOCAL_CLIENTS.check(a, 'ipv4')
  if (net.isIPv6(a)) return LOCAL_CLIENTS.check(a, 'ipv6')
  return false
}

function blockNonFrontendFiles({ allowPublic = false } = {}): Plugin {
  return {
    name: 'rivira-block-non-frontend-files',
    apply: 'serve',
    configureServer(server) {
      if (!allowPublic) {
        server.middlewares.use((req, res, next) => {
          if (isLocalClient(req.socket.remoteAddress)) return next()
          res.statusCode = 403
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('This is a development server and only answers this machine and the local network.')
        })
      }

      const root = server.config.root
      const publicDir = server.config.publicDir
      const indexHtml = path.join(root, 'index.html')
      // The only directories the browser may read files from. Anything else in
      // the project root — configs, the backend, the runbook — is not servable.
      const srcDir = path.join(root, 'src')
      const modulesDir = path.join(root, 'node_modules')

      // Windows compares paths case-insensitively and ignores trailing dots and
      // spaces, so "DOCKER-COMPOSE.YML." names the same file as the real one.
      const key = (p: string) =>
        process.platform === 'win32' ? p.replace(/[. ]+$/, '').toLowerCase() : p

      const isInside = (dir: string, target: string) => {
        const rel = path.relative(key(dir), key(target))
        return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
      }
      /* src/ and node_modules/ are served as a tree, so containment is enough.
         A public asset has to EXIST: public/ is mapped onto the URL root, so
         "is it under public/?" alone would accept every name in the project
         root and hand the request on to Vite, which then reads the root file. */
      const allowedPath = (target: string) =>
        isInside(srcDir, target) ||
        isInside(modulesDir, target) ||
        key(target) === key(indexHtml) ||
        (!!publicDir && isInside(publicDir, target) && fs.existsSync(target))

      // Dotfiles stay unreachable (.env, .git, …). Vite's own node_modules/.vite
      // cache is the one exception, minus the dependency manifest, which is
      // server-side bookkeeping the browser never needs.
      const hiddenOrInternal = (target: string) => {
        const posix = target.replace(/\\/g, '/')
        const lc = posix.toLowerCase()
        if (/\/_metadata\.json$/i.test(lc)) return true
        return posix
          .split('/')
          .some((s, i, all) => s.startsWith('.') && s.length > 1 && !(s === '.vite' && all[i - 1] === 'node_modules'))
      }

      server.middlewares.use((req, res, next) => {
        let url = (req.url || '/').split('?')[0].split('#')[0]
        for (let i = 0; i < 3; i++) {
          try {
            const d = decodeURIComponent(url)
            if (d === url) break
            url = d
          } catch {
            break
          }
        }
        url = url.replace(/\\/g, '/')
        // An absolute-form target ("GET http://host/path") must be judged on its path
        const absoluteForm = url.match(/^https?:\/\/[^/]*(\/.*)?$/i)
        if (absoluteForm) url = absoluteForm[1] || '/'

        const deny = () => {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('Not found')
        }

        /* Which file on disk would this URL read?
           - /@fs/<absolute path> names one outright.
           - /@vite/…, /@id/… and friends are virtual modules, not file reads.
           - anything else is relative to the project root, or to public/. */
        let targets: string[]
        if (url.startsWith('/@fs/')) {
          let abs = url.slice('/@fs'.length).replace(/\/{2,}/g, '/')
          if (/^\/[A-Za-z]:\//.test(abs)) abs = abs.slice(1) // /E:/x -> E:/x
          targets = [path.resolve(abs)]
        } else if (url.startsWith('/@')) {
          return next()
        } else {
          targets = [path.resolve(path.join(root, url))]
          if (publicDir) targets.push(path.resolve(path.join(publicDir, url)))
        }

        const hit = targets.find((t) => allowedPath(t) && !hiddenOrInternal(t))
        if (hit) return next()

        /* Not a file the browser may read. A page navigation to a client-side
           route (/panel/students) looks the same, so serve index.html for those
           here rather than letting Vite resolve the name — that resolution is
           what turns an extension-less or re-spelled URL into a project file. */
        const wantsHtml = (req.headers.accept || '').includes('text/html')
        const hasExtension = /\.[a-z0-9]+$/i.test(url.split('/').pop() || '')
        if (wantsHtml && !hasExtension && !url.startsWith('/@fs/')) {
          fs.promises
            .readFile(indexHtml, 'utf8')
            .then((html) => server.transformIndexHtml(req.url || '/', html, req.originalUrl))
            .then((html) => {
              res.statusCode = 200
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              res.end(html)
            })
            .catch(() => deny())
          return
        }
        deny()
      })
    },
  }
}

// Sent by the dev and preview servers. Production gets the same set from
// vercel.json / nginx.conf (security audit, Finding 11).
const SECURITY_HEADERS = {
  'Content-Security-Policy': "frame-ancestors 'self'",
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

const originOf = (url?: string) => {
  try {
    return url && /^https?:\/\//i.test(url) ? new URL(url).origin : ''
  } catch {
    return ''
  }
}

/* Full policy for the production build served by `vite preview` (the dev
   server keeps frame-ancestors only — HMR needs inline/eval/websocket freedom).
   The API and chatbot origins come from VITE_SERVER_URL / VITE_CHATBOT_URL, so
   the policy follows whichever servers the build was made for. */
function productionCsp(apiOrigin: string, chatOrigin: string): string {
  const own = [apiOrigin, chatOrigin].filter(Boolean).join(' ')
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://js.stripe.com https://challenges.cloudflare.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
    `img-src 'self' data: blob: https: ${apiOrigin}`.trim(),
    `media-src 'self' blob: https: ${apiOrigin}`.trim(),
    `connect-src 'self' ${own} https://*.stripe.com https://challenges.cloudflare.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://cdn.jsdelivr.net`.replace(/\s+/g, ' '),
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com https://js.stripe.com https://*.stripe.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
  ].join('; ')
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  /* The dev server is for this machine. Anything wider is opt-in, set in a
     LOCAL .env.local (gitignored) or the shell — never on a public server, which
     should serve `npm run build` output instead (audit Findings 2, 13, 14):
       DEV_HOST=0.0.0.0                       also listen on the LAN
       DEV_PORT=5175                          default 5173
       DEV_ALLOWED_HOSTS=.trycloudflare.com   extra Host names, comma-separated
       DEV_ALLOW_PUBLIC=true                  answer internet clients too (don't) */
  const env = { ...loadEnv(mode, process.cwd(), ['DEV_', 'VITE_']), ...process.env }
  const extraHosts = (env.DEV_ALLOWED_HOSTS || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
  const allowPublic = String(env.DEV_ALLOW_PUBLIC || '').trim().toLowerCase() === 'true'

  const previewHeaders = {
    ...SECURITY_HEADERS,
    'Content-Security-Policy': productionCsp(originOf(env.VITE_SERVER_URL), originOf(env.VITE_CHATBOT_URL)),
    // takes effect once the site is reached over HTTPS; browsers ignore it on http
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  }

  return {
    plugins: [react(), blockNonFrontendFiles({ allowPublic })],
    server: {
      host: env.DEV_HOST || '127.0.0.1',
      port: Number(env.DEV_PORT) || 5173,
      strictPort: true,
      allowedHosts: ['localhost', '127.0.0.1', ...extraHosts],
      headers: SECURITY_HEADERS,
      fs: {
        // Vite's defaults plus the backend/infra files (setting deny replaces the defaults)
        deny: [
          '.env', '.env.*', '*.{crt,pem,key}', '**/.git/**',
          '**/api/**', '**/assistant/**', 'dbinfo.txt',
        ],
      },
    },
    preview: {
      headers: previewHeaders,
    },
  }
})
