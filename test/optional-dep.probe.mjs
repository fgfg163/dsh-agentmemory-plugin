// Focused probe: the merged plugin must keep capture working when the
// optional prompt-slot service is ABSENT. This is the whole point of using
// ctx.inject() instead of `export const inject = ['promptInject']`.
//
// TWO independent claims are checked, because a fake ctx alone cannot catch the
// hard-dependency mistake: calling `apply()` directly bypasses the loader, so a
// plugin with `export const inject = ['promptInject']` would still look fine.
// The loader-level claim (claim 1) is what actually turns red for that bug.
import assert from 'node:assert/strict'
import * as plugin from 'file:///E:/gem12/DSH/publish/dsh-agentmemory-plugin/lib/index.js'

const { apply, name } = plugin

// --- claim 1: the module declares NO hard dependency on the slot service ----
// Cordis keeps a plugin dormant until every name in `inject` exists. If
// 'promptInject' were in there, a profile without @fgfg163/dsh-prompt-slot
// would lose capture too. Asserted on the real export, not on apply().
{
  const declared = Array.isArray(plugin.inject) ? plugin.inject : []
  assert.ok(
    !declared.includes('promptInject'),
    `module-level inject must not name promptInject (got ${JSON.stringify(declared)});` +
      ' that is a hard dependency and disables capture in profiles without the slot bundle',
  )
  console.log(`[ok] no hard inject dependency (inject = ${JSON.stringify(plugin.inject ?? null)})`)
}


/** Record every ctx.on registration so we can prove capture wired itself up. */
function fakeCtx({ withService }) {
  const events = []
  const warnings = []
  const injectCalls = []
  const ctx = {
    logger: { warn: (m) => warnings.push(m), info: () => {}, error: () => {} },
    on(event, handler) {
      events.push(event)
      return () => {}
    },
    effect(fn) {
      const d = fn()
      return d
    },
    inject(services, cb) {
      injectCalls.push(services.join(','))
      if (!withService) return undefined // cordis: dormant until the service exists
      const scope = {
        effect: (fn) => fn(),
        promptInject: { register: () => () => {} },
      }
      cb(scope)
      return undefined
    },
  }
  return { ctx, events, warnings, injectCalls }
}

// --- case A: slot service ABSENT -> capture still registers -----------------
{
  const { ctx, events, warnings, injectCalls } = fakeCtx({ withService: false })
  apply(ctx, { url: 'http://daemon.test:3111', secret: 'x' })

  const required = ['session/created', 'session/event', 'agent/pre-step', 'session/disposed']
  for (const e of required) {
    assert.ok(events.includes(e), `capture hook "${e}" must register without the slot service`)
  }
  assert.deepEqual(injectCalls, ['promptInject'], 'recall went through optional ctx.inject')
  assert.equal(warnings.length, 0, 'no warning just because the optional service is missing')
  console.log('[ok] slot service ABSENT -> capture hooks still registered, no warning')
}

// --- case B: slot service PRESENT -> capture plus recall -------------------
{
  const { ctx, events, injectCalls } = fakeCtx({ withService: true })
  apply(ctx, { url: 'http://daemon.test:3111', secret: 'x' })
  assert.ok(events.includes('session/event'), 'capture still registers')
  assert.deepEqual(injectCalls, ['promptInject'], 'recall attached')
  console.log('[ok] slot service PRESENT -> capture plus recall both wired')
}

// --- case C: recall.enabled false keeps capture ---------------------------
{
  const { ctx, events } = fakeCtx({ withService: true })
  apply(ctx, { url: 'http://daemon.test:3111', secret: 'x', recall: { enabled: false } })
  assert.ok(events.includes('session/event'), 'capture unaffected by recall switch')
  console.log('[ok] recall.enabled:false leaves capture intact')
}

// --- case D: the contract is unchanged ------------------------------------
{
  assert.equal(name, 'agentmemory', 'plugin name unchanged: agentmemory connect keys on it')
  console.log('[ok] plugin name stays "agentmemory"')
}

console.log('\nALL OPTIONAL-DEPENDENCY PROBES PASSED')
