#!/usr/bin/env node
/**
 * Verify that per-turn recall actually works, against YOUR daemon.
 *
 *   node scripts/verify-recall.mjs --url http://daemon:3111 --secret-file /path/to/secret
 *
 * Loads the real plugin into a real Cordis app together with the prompt slot,
 * drives one `agent/pre-step`, and reports every outbound request. A pass means
 * both halves fired from the same hook:
 *
 *   POST /agentmemory/session/start    (capture)
 *   POST /agentmemory/smart-search     (recall hop 1: query)
 *   POST /agentmemory/smart-search     (recall hop 2: expandIds)
 *
 * Why this exists: "no error in the log" proves nothing. Recall fails soft on
 * purpose (a slow or unreachable daemon means "no recall this turn"), so a
 * broken setup looks exactly like a quiet one. This script produces evidence.
 *
 * Exit codes: 0 = pass, 1 = recall did not run, 2 = bad usage.
 */

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const url = arg('url', process.env.AGENTMEMORY_URL || 'http://localhost:3111').replace(/\/+$/, '')
const secretFile = arg('secret-file', '')
const secret = secretFile ? readFileSync(secretFile, 'utf8').trim() : (process.env.AGENTMEMORY_SECRET || '')

/**
 * Locate the Cordis runtime and the prompt-slot plugin.
 *
 * Both live outside this package: Cordis ships with the DSH host, and the slot
 * plugin is a separate (optional) package. Neither can be a normal dependency
 * here, so the doctor asks for paths and says plainly what is missing.
 */
const cordisPath = arg('cordis', process.env.DSH_CORDIS_PATH || '')
const slotPath = arg('slot', process.env.DSH_SLOT_PATH || '')

if (!cordisPath || !slotPath) {
  console.error('usage: node scripts/verify-recall.mjs --cordis <path> --slot <path> [--url URL --secret-file FILE]')
  console.error('')
  console.error('  --cordis       @deepseek-ai/cordis/lib/index.js (ships inside DSH; use ELECTRON_RUN_AS_NODE=1')
  console.error('                 with the Electron binary when the path is inside app.asar)')
  console.error('  --slot         @fgfg163/dsh-prompt-slot/lib/index.js')
  console.error('  --url          daemon base URL (default: $AGENTMEMORY_URL or http://localhost:3111)')
  console.error('  --secret-file  file holding the bearer token (or set $AGENTMEMORY_SECRET)')
  process.exit(2)
}

const asUrl = (p) => pathToFileURL(p).href

const cordis = await import(asUrl(cordisPath))
const Context = cordis.Context ?? cordis.default?.Context
if (typeof Context !== 'function') {
  console.error('[FAIL] the --cordis path does not export Cordis Context')
  process.exit(2)
}

const ctx = new Context()

// The slot plugin hard-depends on sessionProjections (a DSH kernel service).
// Without a stub it stays dormant and recall would look broken for a reason
// that has nothing to do with this package.
ctx.provide('sessionProjections', {
  register: () => () => {},
  stateOf: () => undefined,
})

// Count every outbound request. This is the evidence, not the log.
//
// Record failures too, and keep the status: an unreachable daemon still lets a
// request be *attempted*, so counting attempts alone would report "query sent"
// for a call that never landed. Every verdict below keys on `ok`.
const realFetch = globalThis.fetch
const calls = []
globalThis.fetch = async (target, init) => {
  let body = null
  try {
    body = JSON.parse(init?.body)
  } catch {}
  const entry = { url: String(target), body, ok: false, status: 0, error: '' }
  calls.push(entry)
  try {
    const response = await realFetch(target, init)
    entry.status = response.status
    entry.ok = response.ok
    return response
  } catch (error) {
    entry.error = error?.message ?? String(error)
    throw error
  }
}

await ctx.plugin(await import(asUrl(slotPath)))
if (ctx.get('promptInject') === undefined) {
  console.error('[FAIL] prompt-slot did not provide promptInject')
  process.exit(1)
}

const self = await import(new URL('../lib/index.js', import.meta.url).href)
if (Array.isArray(self.inject) && self.inject.includes('promptInject')) {
  console.error('[FAIL] this package declares a HARD dependency on promptInject;')
  console.error('       capture would be disabled in profiles without the slot plugin')
  process.exit(1)
}

await ctx.plugin(self, {
  url,
  secret,
  recall: { enabled: true, minQueryChars: 1 },
})

const slots = ctx.get('promptInject').list().map((s) => s.id)
if (!slots.includes('agentmemory:recall')) {
  console.error(`[FAIL] recall slot not registered (slots: ${JSON.stringify(slots)})`)
  process.exit(1)
}

// Drive one turn. The query is deliberately long enough to pass minQueryChars
// and unmistakably ours, so the daemon trace is unambiguous.
const QUERY = 'agentmemory recall verification probe query'
const decision = {
  kind: 'enter',
  startsRequestSeries: true,
  messages: [
    { role: 'user', source: { kind: 'agentmemory' }, content: [{ type: 'text', text: 'injected block, must be ignored' }] },
    { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: QUERY }] },
  ],
}
const agent = { session: { id: `verify-${Date.now()}`, header: { cwd: process.cwd() } } }

await ctx.waterfall('agent/pre-step', { agent, signal: { aborted: false }, turn: 1, step: 1 }, async () => decision)
await new Promise((r) => setTimeout(r, 2500))

console.log('\n=== outbound requests ===')
for (const c of calls) {
  const path = c.url.replace(url, '')
  const detail = c.body?.query
    ? `query=${JSON.stringify(c.body.query)}`
    : Array.isArray(c.body?.expandIds)
      ? `expandIds=${c.body.expandIds.length}`
      : ''
  const status = c.ok ? `HTTP ${c.status}` : c.status ? `HTTP ${c.status}` : `FAILED ${c.error || 'no response'}`
  console.log(`  ${path}  ${detail}  [${status}]`)
}

// Only calls that actually reached the daemon count as evidence.
const searches = calls.filter((c) => c.url.includes('/smart-search') && c.ok)
const query = searches.find((c) => c.body?.query)
const captured = calls.some((c) => c.url.includes('/session/start') && c.ok)

console.log('\n=== verdict ===')
console.log(`  capture /session/start : ${captured ? 'yes' : 'no'}`)
console.log(`  recall  /smart-search  : ${searches.length} successful call(s)`)
console.log(`  query sent             : ${query ? JSON.stringify(query.body.query) : 'none'}`)
console.log(`  targetLayer            : ${query ? query.body.targetLayer : 'n/a'}`)

const queryCorrect = query?.body?.query === QUERY
if (queryCorrect) {
  console.log('  [ok] the query is the human prompt, not the injected block')
}

const pass = captured && searches.length >= 2 && queryCorrect && query.body.targetLayer === 'memory'
if (pass) {
  console.log('\nPASS — capture and both recall hops fired from one pre-step.')
  process.exit(0)
}

console.log('\nFAIL — expected a /session/start plus two successful /smart-search calls using the human prompt.')
const failed = calls.filter((c) => !c.ok)
if (failed.length) {
  console.log(`  ${failed.length} request(s) did not reach the daemon: ${failed[0].error || `HTTP ${failed[0].status}`}`)
  console.log('  check --url and the secret first.')
}
if (!captured && failed.length === 0) console.log('  capture never posted: check url/secret.')
if (searches.length === 0 && failed.length === 0) console.log('  recall never searched: is recall.enabled true?')
if (searches.length === 1) console.log('  only hop 1 succeeded: the expand step failed mid-flight.')
process.exit(1)
