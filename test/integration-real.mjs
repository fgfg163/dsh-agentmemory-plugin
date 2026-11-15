// Real-cordis integration probe.
//
// Loads the MERGED plugin into an actual Cordis app together with the prompt
// slot plugin, and asserts that per-turn recall really reaches the slot — i.e.
// that ctx.inject(['promptInject']) resolves and registers, not merely that the
// code parses. This is the claim the fake-ctx tests cannot make.
//
// The two Windows traps this probe encodes (both hit for real):
//   1. A bare `D:\...` path passed to import() is rejected by the ESM loader
//      ("Only URLs with a scheme in: file, data, node, and electron"). Every
//      path must be a file:// URL, and app.asar paths are percent-encoded.
//   2. `@deepseek-ai/cordis` has NO default export; `Context` is a named export.
//
// Run with ELECTRON_RUN_AS_NODE=1 and the Electron binary, so `import` can
// resolve modules living inside app.asar.

const { pathToFileURL } = await import('node:url')
const asUrl = (p) => pathToFileURL(p).href

const CORDIS = process.env.DSH_CORDIS_PATH
const SLOT = process.env.DSH_SLOT_PATH
const PLUGIN = process.env.DSH_PLUGIN_PATH

for (const [name, value] of Object.entries({ CORDIS, SLOT, PLUGIN })) {
  if (!value) {
    console.error(`[FAIL] ${name} is not set`)
    process.exit(1)
  }
}

const cordis = await import(asUrl(CORDIS))
const Context = cordis.Context
if (typeof Context !== 'function') {
  console.error('[FAIL] cordis does not export Context')
  process.exit(1)
}
console.log('[ok] cordis loaded')

const ctx = new Context()

// The slot plugin hard-depends on `sessionProjections` (provided by the DSH
// kernel). Without it, prompt-slot stays dormant, no promptInject service is
// ever provided, and recall would look "broken" for a reason that has nothing
// to do with the merge. A minimal stub is enough for this probe.
ctx.provide('sessionProjections', {
  register() {
    return () => {}
  },
  stateOf() {
    return undefined
  },
})

await ctx.plugin(await import(asUrl(SLOT)))
console.log('[ok] prompt-slot mounted')

if (ctx.get('promptInject') === undefined) {
  console.error('[FAIL] prompt-slot did not provide promptInject (sessionProjections stub insufficient?)')
  process.exit(1)
}

await ctx.plugin(await import(asUrl(PLUGIN)), {
  url: 'http://daemon.invalid:3111',
  secret: 'probe',
  recall: { enabled: true, minQueryChars: 1 },
})
console.log('[ok] merged agentmemory plugin mounted')

// Both plugins are up: the recall slot must now be visible through the service
// the slot plugin provides. This is what proves ctx.inject() actually resolved.
const service = ctx.get('promptInject')
if (service === undefined) {
  console.error('[FAIL] ctx.get("promptInject") is undefined — the recall half never attached')
  process.exit(1)
}

const ids = service.list().map((slot) => slot.id)
console.log('[ok] registered slots:', JSON.stringify(ids))

if (!ids.includes('agentmemory:recall')) {
  console.error('[FAIL] agentmemory:recall is not registered — the merge did not wire recall in')
  process.exit(1)
}
const recall = service.list().find((slot) => slot.id === 'agentmemory:recall')
console.log('[ok] recall slot:', JSON.stringify(recall))
if (recall.channel !== 'request') {
  console.error('[FAIL] recall slot must use the request channel')
  process.exit(1)
}

console.log('\nREAL-CORDIS INTEGRATION PASSED')
process.exit(0)
