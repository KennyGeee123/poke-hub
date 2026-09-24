import { cpSync, mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const www = join(root, 'www')
mkdirSync(www, { recursive: true })

const files = [
  'favicon.svg',
  'apple-touch-icon.png',
  'icon-512.png',
  'icon-192.png',
  'manifest.webmanifest',
  'privacy.html',
  'terms.html',
  'support.html',
]
for (const f of files) {
  const src = join(root, 'public', f)
  if (existsSync(src)) cpSync(src, join(www, f))
}

writeFileSync(
  join(www, 'index.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0b1020" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <title>PokéVault</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: #0b1020; color: #f1f5f9; font-family: system-ui, sans-serif; }
      a { color: #f87171; }
    </style>
  </head>
  <body>
    <main>
      <p>PokéVault</p>
      <p>Native builds load <a href="https://pokedex-hub-lime.vercel.app/">the live app</a> via Capacitor server.url.</p>
    </main>
  </body>
</html>
`,
)
console.log('prepared www/ for cap sync')
