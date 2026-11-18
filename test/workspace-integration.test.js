/**
 * Integration test for the Host half of the workspace settings.
 *
 * Every other test builds the route handler or the store directly with fakes, so
 * none of them can see how `apply` ASSEMBLES the pieces — and that is exactly
 * where bugs hid twice: an identifier defined inside `apply` but referenced from
 * `installWorkspaceRoute` (`plainProfileConfig is not defined`, only thrown on a
 * real request), and volatile config leaves persisted as `{}`.
 *
 * So this file runs the real `apply()` against a minimal fake Cordis context and
 * drives the registered route end to end against a real store document.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply, Config } from '../lib/index.js'
import { FALLBACK_ROUTE_PATH, ROUTE_PATH } from '../lib/workspace-route.js'
import { clearStoreCache, normalizeWorkspaceKey, storePath } from '../lib/workspace-store.js'

/** Minimal Cordis context: records listeners, effects and service lookups. */
function makeContext({ services = {} } = {}) {
  const listeners = new Map()
  const registry = { ...services }
  return {
    registry,
    listeners,
    ctx: {
      logger: { info() {}, warn() {}, error() {} },
      on(event, fn) {
        const list = listeners.get(event) ?? []
        list.push(fn)
        listeners.set(event, list)
      },
      get: (name) => registry[name],
      inject(names, callback) {
        if (names.every((name) => registry[name] !== undefined)) callback(this)
      },
      effect(factory) {
        if (typeof factory === 'function') factory()
        return () => {}
      },
      fiber: { entry: { id: 'fgfg163-agentmemory-plugin' } },
    },
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 30))

/** Run one request through a registered node route. */
async function request(route, body, headers = {}) {
  const chunks = [Buffer.from(JSON.stringify(body))]
  const req = {
    method: 'POST',
    url: route.path,
    headers: { host: '127.0.0.1:7788', origin: 'http://127.0.0.1:7788', 'content-type': 'application/json', ...headers },
    on(event, fn) {
      if (event === 'data') for (const chunk of chunks) fn(chunk)
      if (event === 'end') fn()
      if (event === 'error') { /* unused */ }
      return this
    },
    destroy() {},
  }
  const res = {
    status: undefined,
    payload: '',
    writeHead(status) {
      res.status = status
      return res
    },
    setHeader() {},
    end(chunk) {
      if (typeof chunk === 'string') res.payload += chunk
      return res
    },
  }
  await route.handler(req, res)
  let json
  try {
    json = JSON.parse(res.payload)
  } catch {
    json = undefined
  }
  return { status: res.status, json }
}

/** Fresh `$DSH_HOME` for one test. */
async function withHome(run) {
  const home = mkdtempSync(join(tmpdir(), 'am-int-'))
  const workspace = join(home, 'workspace')
  mkdirSync(workspace)
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  clearStoreCache()
  try {
    await run({ home, workspace })
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    clearStoreCache()
    rmSync(home, { recursive: true, force: true })
  }
}

/** Boot the real plugin and return the registered fallback route. */
async function boot({ workspace, editedRef }) {
  const registered = []
  const { ctx } = makeContext({
    services: {
      workspaceRegistry: { list: () => [{ path: workspace, title: 'test-ws' }] },
      webServer: {
        register(route) {
          registered.push(route)
          return () => {}
        },
      },
      configEditor: {
        async edit(entry, produce) {
          editedRef.value = produce({})
        },
      },
      workingDirectory: { defaultDirectory: workspace },
    },
  })
  apply(ctx, {
    url: 'http://daemon.invalid:3111',
    secretEnv: 'AGENTMEMORY_SECRET',
    contextMaxChars: 64000,
    agentId: 'owner',
    workspace: { enabled: true },
    recall: { enabled: false },
  })
  await tick()
  const route = registered.find((entry) => entry.path === FALLBACK_ROUTE_PATH)
  assert.ok(route, `route registered; got ${JSON.stringify(registered.map((r) => r.path))}`)
  return route
}

test('two carriers never share a path', () => {
  // Same path would make a late `connection` collide with the mounted fallback
  // (`duplicate exact route`) and fail plugin activation, which is invisible
  // until a reload.
  assert.notEqual(ROUTE_PATH, FALLBACK_ROUTE_PATH)
  assert.ok(ROUTE_PATH.startsWith('/api/'), 'authenticated carrier owns /api')
  assert.ok(!FALLBACK_ROUTE_PATH.startsWith('/api/'), 'fallback stays out of the owned prefix')
})

test('apply() assembles the route and it answers real requests', async () => {
  await withHome(async ({ workspace }) => {
    const editedRef = { value: undefined }
    const route = await boot({ workspace, editedRef })

    // status must not throw "plainProfileConfig is not defined".
    const status = await request(route, { action: 'status' })
    assert.equal(status.status, 200, `status failed: ${JSON.stringify(status.json)}`)
    assert.equal(status.json.ok, true)
    assert.equal(status.json.profile.agentId, 'owner')
    assert.ok(!JSON.stringify(status.json).includes('":{}'), 'no volatile reference leaked as {}')
    assert.equal(status.json.storePath, storePath())

    // save on change, per workspace
    const saved = await request(route, { action: 'save', workspace, settings: { agentId: 'ui', recall: { limit: 2 } } })
    assert.equal(saved.status, 200, JSON.stringify(saved.json))
    assert.equal(saved.json.key, normalizeWorkspaceKey(workspace))

    const afterSave = await request(route, { action: 'status', workspace })
    assert.equal(afterSave.json.workspace.agentId, 'ui')
    assert.equal(afterSave.json.workspace.recall.limit, 2)
    assert.equal(afterSave.json.workspaceCount, 1)

    // the document on disk really holds it
    const onDisk = JSON.parse(readFileSync(storePath(), 'utf-8'))
    assert.equal(onDisk.workspaces[normalizeWorkspaceKey(workspace)].agentId, 'ui')

    // clearing removes just this one
    const cleared = await request(route, { action: 'clear', workspace })
    assert.equal(cleared.status, 200)
    assert.equal(cleared.json.removed, true)
    const afterClear = await request(route, { action: 'status', workspace })
    assert.equal(afterClear.json.workspace, null)

    // The global config now lives in the store, not in cordis.patch.yml.
    const global = await request(route, { action: 'write-global', config: { agentId: 'global-ui', recall: { limit: 8 } } })
    assert.equal(global.status, 200, JSON.stringify(global.json))
    const globalOnDisk = JSON.parse(readFileSync(storePath(), 'utf-8'))
    assert.equal(globalOnDisk.global.agentId, 'global-ui')
    assert.equal(globalOnDisk.global.recall.limit, 8)
    // The profile editor must NOT have been used: nothing is written to YAML.
    assert.equal(editedRef.value, undefined, 'cordis.patch.yml is left untouched')

    // reset-all wipes the store document itself
    await request(route, { action: 'save', workspace, settings: { agentId: 'again' } })
    const reset = await request(route, { action: 'reset-all' })
    assert.equal(reset.status, 200)
    assert.equal(reset.json.removed, true)
    assert.ok(!existsSync(storePath()), 'store document gone')
  })
})

test('the picker lists registered workspaces, not only customised ones', async () => {
  // The first design listed only workspaces that ALREADY had overrides, which
  // made the first override impossible to create — a dead end that only shows
  // up on a fresh install.
  await withHome(async ({ workspace }) => {
    const route = await boot({ workspace, editedRef: { value: undefined } })

    const fresh = await request(route, { action: 'status' })
    assert.equal(fresh.json.workspaceCount, 0, 'nothing customised yet')
    assert.equal(fresh.json.workspaces.length, 1, 'but the registered workspace is offered')
    assert.equal(fresh.json.workspaces[0].path, workspace)
    assert.equal(fresh.json.workspaces[0].customised, false)
    assert.equal(fresh.json.workspaces[0].title, 'test-ws')

    // After saving, the same workspace is now marked as customised.
    await request(route, { action: 'save', workspace, settings: { agentId: 'x' } })
    const after = await request(route, { action: 'status' })
    assert.equal(after.json.workspaceCount, 1)
    assert.equal(after.json.workspaces[0].customised, true)
  })
})

test('a customised workspace missing from the registry is still listed', async () => {
  // A workspace can be removed from the sidebar while its settings survive; the
  // page must not strand them.
  await withHome(async ({ home, workspace }) => {
    const { writeWorkspaceSettings } = await import('../lib/workspace-store.js')
    const orphan = join(home, 'removed-workspace')
    mkdirSync(orphan)
    writeWorkspaceSettings(orphan, { agentId: 'orphan' })

    const route = await boot({ workspace, editedRef: { value: undefined } })
    const status = await request(route, { action: 'status' })
    const paths = status.json.workspaces.map((row) => row.path)
    assert.ok(paths.includes(workspace), 'registered one still listed')
    assert.ok(paths.includes(orphan), 'orphaned one still reachable')
  })
})

test('a cross-site request is refused by the fallback', async () => {
  await withHome(async ({ workspace }) => {
    const route = await boot({ workspace, editedRef: { value: undefined } })
    const run = (headers) => request(route, { action: 'save', workspace, settings: { agentId: 'x' } }, headers)

    assert.equal((await run({ origin: 'http://evil.example' })).status, 403)
    assert.equal((await run({ host: '10.0.0.5:7788' })).status, 403)
    assert.equal((await run({ 'sec-fetch-site': 'cross-site' })).status, 403)
    // A refused call must not have changed the store. `apply` may already have
    // created it (the one-time import from a profile row), so compare content
    // rather than existence.
    const beforeSameOrigin = existsSync(storePath()) ? readFileSync(storePath(), 'utf-8') : undefined
    assert.ok(!(beforeSameOrigin ?? '').includes('"agentId": "x"'), 'refused writes left no trace')

    // Same-origin goes through.
    assert.equal((await run({ origin: 'http://127.0.0.1:7788' })).status, 200)
    assert.ok(readFileSync(storePath(), 'utf-8').includes('"agentId": "x"'), 'the accepted write landed')
  })
})

test('the workspace block is declared in the exported schema', () => {
  // `apply` reads config.workspace; an undeclared block would be dropped by a
  // settings-form save, silently disabling the layer.
  const resolved = Config({ workspace: { enabled: true } })
  assert.ok(resolved.workspace !== undefined)
  assert.ok('enabled' in resolved.workspace)
})
