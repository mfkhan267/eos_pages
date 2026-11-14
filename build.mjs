// Builds the static site into ./docs (what GitHub Pages serves). Usage: node build.mjs [--serve] [--test]
import { build, context } from 'esbuild'
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'

const out = 'docs', args = process.argv.slice(2)
const opts = { entryPoints: ['src/main.tsx'], bundle: true, minify: !args.includes('--serve'), sourcemap: false, format: 'iife', target: 'es2020', jsx: 'automatic', outfile: `${out}/assets/app.js`,
  alias: { 'react-router-dom': './src/lib/router.tsx' }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'info', loader: { '.json': 'json' } }
const copy = () => { cpSync('index.html', `${out}/index.html`); cpSync('src/styles.css', `${out}/assets/styles.css`); cpSync('public', out, { recursive: true }) }

if (args.includes('--test')) {  // unit tests of the import engine, run in Node
  await build({ entryPoints: ['test/core.test.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'test/.core.test.cjs', logLevel: 'error' })
  try { execFileSync('node', ['test/.core.test.cjs'], { stdio: 'inherit' }) } finally { rmSync('test/.core.test.cjs', { force: true }) }
} else if (args.includes('--serve')) {
  rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true }); copy(); const ctx = await context(opts); await ctx.watch()
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  createServer((q, r) => { const p = q.url.split('?')[0] === '/' ? '/index.html' : q.url.split('?')[0]; try { r.setHeader('content-type', types[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream'); r.end(readFileSync(out + p)) } catch { r.statusCode = 404; r.end('not found') } })
    .listen(8080, () => console.log('ATLAS running at http://localhost:8080'))
} else { rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true }); await build(opts); copy(); writeFileSync(`${out}/.nojekyll`, ''); console.log('Built ./docs') }
