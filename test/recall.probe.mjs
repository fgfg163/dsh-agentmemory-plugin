// Behavioural probe for the merged recall half.
// Runs the real applyRecall() against a fake ctx + fake fetch, no daemon needed.
import assert from 'node:assert/strict'
import { applyRecall, SLOT_ID } from 'file:///E:/gem12/DSH/publish/dsh-agentmemory-plugin/lib/recall.js'

/** Build a fake ctx that records what was registered and whether inject fired. */
function fakeCtx() {
  const slots = []
  const log = []
  const ctx = {
    logger: { warn: (m) => log.push(['warn', m]) },
    effects: [],
    effect(fn, label) {
      this.effects.push(label)
      const disposer = fn()
      return disposer
    },
    inject(services, cb) {
      log.push(['inject', services.join(',')])
      // Emulate cordis: the callback runs only when the service exists.
      const scope = {
        effect: (fn, label) => {
          ctx.effects.push(label)
          return fn()
        },
        promptInject: {
          register(slot) {
            slots.push(slot)
            return () => {}
          },
        },
      }
      cb(scope)
    },
  }
  return { ctx, slots, log }
}

/** Two-hop daemon stub: query returns ranks, expandIds returns bodies. */
function fakeFetch(calls) {
  return async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url, body, auth: init.headers.authorization })
    if (body.expandIds) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: body.expandIds.map((id) => ({
            obsId: id,
            memory: { title: `title-${id}`, narrative: `fact for ${id}` },
          })),
        }),
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        results: body.query.includes('nothing')
          ? []
          : [
              { obsId: 'a', score: 1.0 },
              { obsId: 'b', score: 0.97 },
              { obsId: 'c', score: 0.5 },
            ],
      }),
    }
  }
}

const base = {
  url: 'http://daemon.test:3111',
  secret: 'tok-123',
  fetch: undefined,
}

// --- 1. registers exactly one request-channel turn slot ----------------------
{
  const { ctx, slots, log } = fakeCtx()
  const calls = []
  applyRecall(ctx, { ...base, fetch: fakeFetch(calls) })
  assert.equal(slots.length, 1, 'exactly one slot registered')
  assert.equal(slots[0].id, SLOT_ID)
  assert.equal(slots[0].channel, 'request', 'rides the outbound request, not the log')
  assert.equal(slots[0].when, 'turn')
  assert.equal(slots[0].priority, 100)
  assert.ok(log.some(([k, v]) => k === 'inject' && v === 'promptInject'), 'uses optional ctx.inject')
  console.log('[ok] registers one request-channel turn slot via ctx.inject')
}

// --- 2. enabled:false registers nothing --------------------------------------
{
  const { ctx, slots } = fakeCtx()
  applyRecall(ctx, { ...base, fetch: fakeFetch([]), enabled: false })
  assert.equal(slots.length, 0)
  console.log('[ok] enabled:false registers nothing')
}

// --- 3. two hops, real block, bearer in header -------------------------------
{
  const { ctx, slots } = fakeCtx()
  const calls = []
  applyRecall(ctx, { ...base, fetch: fakeFetch(calls), limit: 3, minConfidence: 0.5, tailRatio: 0.9 })
  const decision = {
    messages: [
      { role: 'user', source: { kind: 'agentmemory' }, content: [{ type: 'text', text: 'injected junk' }] },
      { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'how do I restart the daemon' }] },
    ],
  }
  const out = await slots[0].render({ decision })

  assert.ok(out.startsWith('<agentmemory-recall>'), 'block opens')
  assert.ok(out.trimEnd().endsWith('</agentmemory-recall>'), 'block closes')
  assert.ok(out.includes('how do I restart the daemon'), 'query is the human prompt')
  assert.ok(!out.includes('injected junk'), 'plugin-injected text is not the query')
  assert.ok(out.includes('title-a') && out.includes('title-b'), 'top hits present')

  assert.equal(calls.length, 2, 'two hops')
  assert.equal(calls[0].body.query, 'how do I restart the daemon')
  assert.equal(calls[0].body.targetLayer, 'memory', 'conclusions only')
  assert.equal(calls[0].body.project, undefined, 'no project filter')
  assert.equal(calls[0].body.agentId, undefined, 'no agentId filter')
  assert.equal(calls[0].auth, 'Bearer tok-123', 'bearer in header')
  assert.ok(!calls[0].url.includes('tok-123'), 'secret never in the URL')
  console.log('[ok] two hops, correct scope, bearer in header')
}

// --- 4. tailRatio trims the weak tail within the batch -----------------------
{
  const { ctx, slots } = fakeCtx()
  const calls = []
  applyRecall(ctx, { ...base, fetch: fakeFetch(calls), minConfidence: 0.4, tailRatio: 0.95 })
  const decision = { messages: [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'restart daemon please' }] }] }
  const out = await slots[0].render({ decision })
  assert.ok(out.includes('title-a') && out.includes('title-b'), 'strong hits kept')
  assert.ok(!out.includes('title-c'), 'score 0.5 dropped by tailRatio 0.95')
  console.log('[ok] tailRatio trims the weak tail')
}

// --- 5. empty result yields no block ---------------------------------------
{
  const { ctx, slots } = fakeCtx()
  const calls = []
  applyRecall(ctx, { ...base, fetch: fakeFetch(calls) })
  const decision = { messages: [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'tell me nothing at all' }] }] }
  const out = await slots[0].render({ decision })
  assert.equal(out, null, 'no hits -> null, not an empty block')
  console.log('[ok] empty result yields null')
}

// --- 6. short prompt skips the daemon entirely ------------------------------
{
  const { ctx, slots } = fakeCtx()
  const calls = []
  applyRecall(ctx, { ...base, fetch: fakeFetch(calls) })
  const decision = { messages: [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'ok' }] }] }
  const out = await slots[0].render({ decision })
  assert.equal(out, null)
  assert.equal(calls.length, 0, 'daemon never contacted')
  console.log('[ok] short prompt skips the daemon')
}

// --- 7. daemon failure degrades to no block --------------------------------
{
  const { ctx, slots, log } = fakeCtx()
  applyRecall(ctx, { ...base, fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }) })
  const decision = { messages: [{ role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'a question worth searching' }] }] }
  const out = await slots[0].render({ decision })
  assert.equal(out, null, 'failure -> no block')
  assert.ok(log.some(([k, m]) => k === 'warn' && m.includes('smart-search')), 'failure is logged')
  console.log('[ok] daemon failure degrades to null and logs')
}

// --- 8. slot timeout sits above the fetch budget ---------------------------
{
  const { ctx, slots } = fakeCtx()
  applyRecall(ctx, { ...base, fetch: fakeFetch([]), fetchTimeoutMs: 1200 })
  assert.equal(slots[0].timeoutMs, 1400, 'timeout = fetch budget + 200')
  console.log('[ok] slot timeout above fetch budget')
}

console.log('\nALL RECALL PROBES PASSED')
