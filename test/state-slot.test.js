/**
 * Harness-free unit tests for the per-turn state-slot half.
 *
 * Run: node --test test/
 *
 * The behaviour worth pinning down is the three-way channel choice, because
 * everything else is glue:
 *
 * | stateSlotMode | promptInject | channel | position | re-injected       |
 * |---|---|---|---|---|
 * | history       | either       | history | before   | only when changed |
 * | slot-before   | yes          | request | before   | every turn        |
 * | slot-after    | yes          | request | after    | every turn        |
 * | slot-*        | no           | history | before   | only when changed |
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyStateSlot,
  composeStateBlock,
  isRequestMode,
  MAX_STATE_CHARS,
  MODE_HISTORY,
  MODE_SLOT_AFTER,
  MODE_SLOT_BEFORE,
  resolveMode,
  SLOT_ID,
} from '../lib/state-slot.js'

/**
 * Minimal plugin harness.
 *
 * @param options.withService - whether the fake `promptInject` service exists.
 */
function makeCtx({ withService = false } = {}) {
  const handlers = new Map()
  const slots = []
  const warnings = []
  const ctx = {
    logger: { warn: (message) => warnings.push(message), info: () => {} },
    on(event, handler) {
      const list = handlers.get(event) ?? []
      list.push(handler)
      handlers.set(event, list)
    },
    // Mimic cordis: the callback runs only once the named service exists, and
    // `ctx.get()` answers whether it is there NOW (which is what the module
    // probes, so a service appearing later flips the branch).
    inject(services, callback) {
      if (!withService) return
      if (!services.includes('promptInject')) return
      callback({
        effect: (factory) => factory(),
        promptInject: {
          register(slot) {
            slots.push(slot)
            return () => {}
          },
          registerAfter(slot) {
            slots.push(slot)
            return () => {}
          },
          registerBefore(slot) {
            slots.push(slot)
            return () => {}
          },
        },
      })
    },
    get(name) {
      if (name !== 'promptInject') return undefined
      return withService ? { register: () => {} } : undefined
    },
  }
  return { ctx, handlers, slots, warnings }
}

/** Base decision shape the hook expects. */
function decisionOf() {
  return {
    kind: 'enter',
    messages: [{ id: 'm1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'hi' }] }],
  }
}

/** Run the history-channel hook once. */
async function step(handlers, { sessionId = 's1', stepNumber = 1, cwd } = {}) {
  const handler = handlers.get('agent/pre-step')?.[0]
  if (!handler) return undefined
  const agent = { session: { id: sessionId, header: cwd ? { cwd } : {} } }
  return await handler({ agent, step: stepNumber, signal: undefined }, async () => decisionOf())
}

/** fetch fake answering `GET /agentmemory/slot?label=...` with mutable content. */
function slotFetch({ content = '', status = 200, fail = false } = {}) {
  const calls = []
  const state = { content }
  const impl = async (url, init) => {
    calls.push({ url: String(url), init })
    if (fail) throw new Error('boom')
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return { success: true, slot: { label: 'agent_state', content: state.content }, scope: 'project' }
      },
    }
  }
  return { impl, calls, state, initial: content }
}

/** Config object the module reads, shaped like `recallConfig()`'s output. */
function configOf(overrides = {}) {
  return {
    url: 'http://daemon:3111',
    secret: 'sekret',
    stateSlot: 'agent_state',
    stateSlotMode: MODE_HISTORY,
    fetchTimeoutMs: 1200,
    ...overrides,
  }
}

test('an empty stateSlot injects nothing and never calls the daemon', async () => {
  const { ctx, handlers } = makeCtx()
  const { impl, calls } = slotFetch({ content: 'x' })
  applyStateSlot(ctx, configOf({ stateSlot: '', fetch: impl }))
  const result = await step(handlers)
  assert.equal(result.messages.length, 1, 'no message was appended')
  assert.equal(calls.length, 0, 'the daemon was not called')
})

test('the first turn injects the slot content once', async () => {
  const { ctx, handlers } = makeCtx()
  const { impl, calls } = slotFetch({ content: '在改状态槽' })
  applyStateSlot(ctx, configOf({ fetch: impl }))
  const result = await step(handlers)
  assert.equal(result.messages.length, 2, 'one message was appended')
  const added = result.messages[1]
  assert.equal(added.role, 'user')
  assert.equal(added.source.kind, 'agentmemory')
  assert.equal(added.source.form, 'state-slot')
  assert.equal(added.source.label, 'agent_state')
  assert.match(added.content[0].text, /在改状态槽/)
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /\/agentmemory\/slot\?label=agent_state$/)
  assert.equal(calls[0].init.headers.authorization, 'Bearer sekret')
})

test('history channel: an unchanged slot is NOT re-injected', async () => {
  const { ctx, handlers } = makeCtx()
  const { impl, calls } = slotFetch({ content: '同一个状态' })
  applyStateSlot(ctx, configOf({ fetch: impl }))
  assert.equal((await step(handlers)).messages.length, 2)
  assert.equal((await step(handlers)).messages.length, 1, 'nothing appended on the second turn')
  assert.equal(calls.length, 2, 'but the slot was still read, so a change is noticed')
})

test('history channel: a changed slot is appended again', async () => {
  const { ctx, handlers } = makeCtx()
  const fake = slotFetch({ content: '状态 A' })
  applyStateSlot(ctx, configOf({ fetch: fake.impl }))
  const first = await step(handlers)
  assert.match(first.messages[1].content[0].text, /状态 A/)

  fake.state.content = '状态 B'
  const second = await step(handlers)
  assert.equal(second.messages.length, 2, 'the change produced a new message')
  assert.match(second.messages[1].content[0].text, /状态 B/)

  assert.equal((await step(handlers)).messages.length, 1, 'and it settles again')
})

test('history channel runs once per turn, not per step', async () => {
  const { ctx, handlers } = makeCtx()
  const { impl, calls } = slotFetch({ content: '状态' })
  applyStateSlot(ctx, configOf({ fetch: impl }))
  await step(handlers, { stepNumber: 1 })
  await step(handlers, { stepNumber: 2 })
  await step(handlers, { stepNumber: 3 })
  assert.equal(calls.length, 1, 'the daemon was read once per turn')
})

test('each session keeps its own last-injected content', async () => {
  const { ctx, handlers } = makeCtx()
  const { impl } = slotFetch({ content: '共享状态' })
  applyStateSlot(ctx, configOf({ fetch: impl }))
  assert.equal((await step(handlers, { sessionId: 'a' })).messages.length, 2)
  assert.equal((await step(handlers, { sessionId: 'b' })).messages.length, 2)
  assert.equal((await step(handlers, { sessionId: 'a' })).messages.length, 1)
})

test('an unreachable daemon backs off instead of costing a timeout every turn', async () => {
  const { ctx, handlers } = makeCtx()
  const { impl, calls } = slotFetch({ fail: true })
  applyStateSlot(ctx, configOf({ fetch: impl }))
  assert.equal((await step(handlers)).messages.length, 1)
  assert.equal(calls.length, 1)
  assert.equal((await step(handlers)).messages.length, 1)
  assert.equal(calls.length, 1, 'the backoff skipped the second attempt')
})

test('an empty slot is nothing to inject', async () => {
  const { ctx, handlers } = makeCtx()
  const { impl } = slotFetch({ content: '   ' })
  applyStateSlot(ctx, configOf({ fetch: impl }))
  assert.equal((await step(handlers)).messages.length, 1)
})

test('a 404 slot is treated as absent, not as an error to log', async () => {
  const { ctx, handlers, warnings } = makeCtx()
  const { impl } = slotFetch({ status: 404 })
  applyStateSlot(ctx, configOf({ fetch: impl }))
  assert.equal((await step(handlers)).messages.length, 1)
  assert.equal(warnings.length, 0)
})

test('an invalid label warns once and never calls the daemon', async () => {
  const { ctx, handlers, warnings } = makeCtx()
  const { impl, calls } = slotFetch({ content: 'x' })
  applyStateSlot(ctx, configOf({ stateSlot: 'Has Spaces', fetch: impl }))
  assert.equal((await step(handlers)).messages.length, 1)
  assert.equal((await step(handlers)).messages.length, 1)
  assert.equal(calls.length, 0)
  assert.equal(warnings.length, 1, 'the warning is emitted once, not every turn')
  assert.match(warnings[0], /not a valid slot label/)
})

test('a workspace can point at a different slot', async () => {
  const { ctx, handlers } = makeCtx()
  const urls = []
  const impl = async (url) => {
    urls.push(String(url))
    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true, slot: { label: 'other', content: '目录专属状态' } }
      },
    }
  }
  const config = configOf({
    fetch: impl,
    resolve: (cwd) => (cwd === 'D:/proj' ? configOf({ stateSlot: 'other', fetch: impl }) : configOf({ fetch: impl })),
  })
  applyStateSlot(ctx, config)
  const result = await step(handlers, { cwd: 'D:/proj' })
  assert.match(urls[0], /label=other$/)
  assert.match(result.messages[1].content[0].text, /目录专属状态/)
})

test('the composed block says what it is and caps the content', () => {
  const short = composeStateBlock('agent_state', '正在跑测试')
  assert.match(short, /agent state/)
  assert.match(short, /agent_state/)
  assert.match(short, /不是指令/)

  const long = composeStateBlock('agent_state', 'x'.repeat(MAX_STATE_CHARS + 500))
  assert.ok(long.length < MAX_STATE_CHARS + 500, 'the body was capped')
  assert.match(long, /已截断/)
})

test('session disposal drops the remembered content', async () => {
  const { ctx, handlers } = makeCtx()
  const { impl } = slotFetch({ content: '状态' })
  applyStateSlot(ctx, configOf({ fetch: impl }))
  await step(handlers, { sessionId: 'gone' })
  handlers.get('session/disposed')[0]({ id: 'gone' })
  assert.equal((await step(handlers, { sessionId: 'gone' })).messages.length, 2, 'a reused id starts over')
})

test('a compaction re-injects, because the old message may be gone', async () => {
  const { ctx, handlers } = makeCtx()
  const { impl } = slotFetch({ content: '状态没变' })
  applyStateSlot(ctx, configOf({ fetch: impl }))
  assert.equal((await step(handlers)).messages.length, 2)
  assert.equal((await step(handlers)).messages.length, 1)

  handlers.get('session/event')[0]({ id: 's1' }, { type: 'compaction/summary' })

  assert.equal((await step(handlers)).messages.length, 2, 're-injected after a compaction')
})

// ---------------------------------------------------------------------------
// 0.16.0 — the mode is one enum, and exactly one channel may answer a turn.
// ---------------------------------------------------------------------------

test('resolveMode maps every accepted spelling and defaults to history', () => {
  assert.equal(resolveMode('history'), MODE_HISTORY)
  assert.equal(resolveMode('slot-before'), MODE_SLOT_BEFORE)
  assert.equal(resolveMode('slot-after'), MODE_SLOT_AFTER)
  assert.equal(resolveMode(undefined), MODE_HISTORY, 'an untouched install writes to the history')
  assert.equal(resolveMode('nonsense'), MODE_HISTORY, 'an unknown value falls back, it does not disable')
  // A non-string (a stray boolean, null) is not guessed at: it takes the
  // default. There is no published version that ever wrote one.
  assert.equal(resolveMode(false), MODE_HISTORY)
  assert.equal(resolveMode(null), MODE_HISTORY)
})

test('history mode writes to the history and never uses the request channel', async () => {
  const { ctx, handlers } = makeCtx({ withService: true })
  const { impl, calls } = slotFetch({ content: '状态' })
  applyStateSlot(ctx, configOf({ stateSlotMode: MODE_HISTORY, fetch: impl }))
  assert.equal((await step(handlers)).messages.length, 2, 'the history carried it')
  assert.equal(calls.length, 1)
})

test('a request mode takes the turn away from the history', async () => {
  const { ctx, handlers } = makeCtx({ withService: true })
  const { impl, calls } = slotFetch({ content: '状态' })
  applyStateSlot(ctx, configOf({ stateSlotMode: MODE_SLOT_AFTER, fetch: impl }))
  assert.equal((await step(handlers)).messages.length, 1, 'nothing is logged')
  assert.equal(calls.length, 0, 'and the history hook did not even call the daemon')
})

test('a request mode WITHOUT the slot bundle falls back to the history', async () => {
  // No slot bundle means no request channel. Rendering nothing would make the
  // feature silently stop working on a profile where it used to work.
  const { ctx, handlers, slots } = makeCtx({ withService: false })
  const { impl } = slotFetch({ content: '状态' })
  applyStateSlot(ctx, configOf({ stateSlotMode: MODE_SLOT_BEFORE, fetch: impl }))
  assert.equal(slots.length, 0, 'no request slot was registered')
  assert.equal((await step(handlers)).messages.length, 2, 'the history carried it anyway')
})

test('exactly ONE request slot renders, whichever placement was chosen', async () => {
  // Both placements are registered (promptInject freezes `placement` at
  // registration), so without a guard both would render and the block would be
  // injected twice — once before the prompt and once after it.
  for (const [mode, expected] of [[MODE_SLOT_BEFORE, 'before'], [MODE_SLOT_AFTER, 'after']]) {
    const { ctx, slots } = makeCtx({ withService: true })
    const { impl } = slotFetch({ content: '只能出现一次' })
    applyStateSlot(ctx, configOf({ stateSlotMode: mode, fetch: impl }))
    assert.equal(slots.length, 2, `${mode}: both are registered`)

    const context = { session: { id: 's1', header: {} }, decision: decisionOf() }
    const rendered = []
    for (const slot of slots) {
      const text = await slot.render(context)
      if (text) rendered.push(slot.placement)
    }
    assert.deepEqual(rendered, [expected], `${mode}: exactly one placement renders`)
  }
})

test('the request slot re-renders every turn, deduplication is off by design', async () => {
  // Unlogged text that is not re-sent is simply absent, so unlike the history
  // channel this one must answer the same content again on the next turn.
  const { ctx, slots } = makeCtx({ withService: true })
  const { impl } = slotFetch({ content: '没变的状态' })
  applyStateSlot(ctx, configOf({ stateSlotMode: MODE_SLOT_AFTER, fetch: impl }))
  const slot = slots.find((candidate) => candidate.placement === 'after')
  const context = { session: { id: 's1', header: {} }, decision: decisionOf() }

  const first = await slot.render(context)
  const second = await slot.render(context)
  assert.match(first, /没变的状态/)
  assert.equal(second, first, 'the same text is rendered again on the next turn')
})

test('flipping the mode needs no re-registration', async () => {
  // The mode is re-read inside render(), so a settings save takes effect on the
  // next turn. A frozen decision would make the select look dead.
  const { ctx, slots } = makeCtx({ withService: true })
  const { impl } = slotFetch({ content: '状态' })
  let mode = MODE_HISTORY
  applyStateSlot(ctx, configOf({ stateSlotMode: { get: () => mode }, fetch: impl }))
  const after = slots.find((candidate) => candidate.placement === 'after')
  const context = { session: { id: 's1', header: {} }, decision: decisionOf() }

  assert.equal(await after.render(context), null, 'history mode: the slot is idle')
  mode = MODE_SLOT_AFTER
  assert.match(await after.render(context), /状态/, 'request mode: the same registration answers')
})

test('isRequestMode only covers the two slot modes', () => {
  assert.equal(isRequestMode(MODE_HISTORY), false)
  assert.equal(isRequestMode(MODE_SLOT_BEFORE), true)
  assert.equal(isRequestMode(MODE_SLOT_AFTER), true)
})

