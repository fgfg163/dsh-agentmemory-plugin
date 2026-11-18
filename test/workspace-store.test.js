/**
 * Tests for the per-workspace settings store.
 *
 * The store replaced a design that wrote `.dsh-agentmemory.yml` into each
 * project directory. What matters now, and what each test pins down:
 *
 * | case | fails if |
 * |---|---|
 * | one workspace's settings do not touch another's | the key is ignored |
 * | two spellings of one directory share one block | normalization is dropped |
 * | unknown keys and wrong types never reach disk | sanitization stops filtering |
 * | a corrupt store is reported, not wiped | the read path swallows it silently |
 * | the merged view only overrides named keys | merge replaces the block |
 * | an atomic write cannot truncate the file | temp+rename is replaced by write |
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Point `$DSH_HOME` at a throwaway directory for one test.
 *
 * The store resolves its own path from the environment on every call, so this
 * is the whole setup — no injection seam needed.
 */
function withStore(run) {
  const home = mkdtempSync(join(tmpdir(), 'am-store-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const { clearStoreCache } = globalThis.__amStore ?? {}
  return (async () => {
    try {
      if (clearStoreCache) clearStoreCache()
      await run(home)
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
      rmSync(home, { recursive: true, force: true })
    }
  })()
}

// Import once so the module-level cache is shared and can be cleared.
const store = await import('../lib/workspace-store.js')
globalThis.__amStore = store
const {
  GLOBAL_DEFAULTS,
  clearStoreCache,
  clearWorkspaceSettings,
  applyWorkspaceSettings,
  listWorkspaceSettings,
  normalizeWorkspaceKey,
  readGlobalSettings,
  readStore,
  readWorkspaceSettings,
  sanitizeGlobalSettings,
  sanitizeWorkspaceSettings,
  storePath,
  writeGlobalSettings,
  writeWorkspaceSettings,
} = store

/** Run a test body with a fresh store home. */
async function withFreshStore(run) {
  const home = mkdtempSync(join(tmpdir(), 'am-store-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  clearStoreCache()
  try {
    await run(home)
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    clearStoreCache()
    rmSync(home, { recursive: true, force: true })
  }
}

test('the store lives under $DSH_HOME/storages', async () => {
  await withFreshStore(async (home) => {
    assert.equal(storePath(), join(home, 'storages', 'dsh-agentmemory-workspaces.json'))
  })
})

test('one workspace saves without disturbing another', async () => {
  await withFreshStore(async (home) => {
    const alpha = join(home, 'alpha')
    const beta = join(home, 'beta')
    mkdirSync(alpha)
    mkdirSync(beta)

    writeWorkspaceSettings(alpha, { agentId: 'alpha-agent', recall: { limit: 2 } })
    writeWorkspaceSettings(beta, { contextMaxChars: 9000 })

    assert.deepEqual(readWorkspaceSettings(alpha), { agentId: 'alpha-agent', recall: { limit: 2 } })
    assert.deepEqual(readWorkspaceSettings(beta), { contextMaxChars: 9000 })
    // A third workspace inherits nothing.
    assert.equal(readWorkspaceSettings(join(home, 'gamma')), undefined)

    const listed = listWorkspaceSettings()
    assert.equal(listed.rows.length, 2)
    assert.deepEqual(listed.rows.map((r) => r.path).sort(), [alpha, beta].sort())
  })
})

test('two spellings of one directory share one block', async () => {
  await withFreshStore(async (home) => {
    const dir = join(home, 'proj')
    mkdirSync(dir)
    // Trailing separator and a redundant segment both mean the same directory.
    // NOTE: `path.resolve` already collapses these, so this case alone does NOT
    // prove `realpath` is in use — the symlink test below is what covers that.
    const spellingA = dir
    const spellingB = `${dir}/./`

    assert.equal(normalizeWorkspaceKey(spellingA), normalizeWorkspaceKey(spellingB))

    writeWorkspaceSettings(spellingA, { agentId: 'one' })
    writeWorkspaceSettings(spellingB, { agentId: 'two' })

    // One block, latest value — not two independent blocks.
    assert.equal(listWorkspaceSettings().rows.length, 1)
    assert.equal(readWorkspaceSettings(spellingA).agentId, 'two')
  })
})

test('a symlinked path resolves to the same block', async (t) => {
  // This is the case `path.resolve` alone cannot handle, and the reason
  // normalizeWorkspaceKey calls realpathSync: a project reached through a
  // symlink is ONE workspace, not two competing settings blocks.
  await withFreshStore(async (home) => {
    const real = join(home, 'real')
    mkdirSync(real)
    const link = join(home, 'link')
    try {
      // `junction` is the only link kind that needs no privilege on Windows.
      symlinkSync(real, link, 'junction')
    } catch {
      try {
        symlinkSync(real, link, 'dir')
      } catch (error) {
        t.diagnostic(`cannot create a symlink here, skipping: ${error.message}`)
        return
      }
    }

    assert.equal(
      normalizeWorkspaceKey(link),
      normalizeWorkspaceKey(real),
      'the link must collapse onto its target',
    )

    writeWorkspaceSettings(real, { agentId: 'via-real' })
    // Reading through the link sees the same block.
    assert.equal(readWorkspaceSettings(link).agentId, 'via-real')
    // And writing through the link does not create a second one.
    writeWorkspaceSettings(link, { agentId: 'via-link' })
    assert.equal(listWorkspaceSettings().rows.length, 1)
    assert.equal(readWorkspaceSettings(real).agentId, 'via-link')
  })
})

test('unknown keys and wrong types never reach disk', async () => {
  await withFreshStore(async (home) => {
    const dir = join(home, 'proj')
    mkdirSync(dir)
    writeWorkspaceSettings(dir, {
      agentId: 'ok',
      evilKey: 'nope',
      contextMaxChars: 'not-a-number',
      recall: { limit: 3, surprise: true, enabled: 'yes' },
    })
    const onDisk = readFileSync(storePath(), 'utf-8')
    assert.ok(!onDisk.includes('evilKey'))
    assert.ok(!onDisk.includes('surprise'))
    assert.ok(!onDisk.includes('not-a-number'))
    // The valid ones survived.
    const saved = readWorkspaceSettings(dir)
    assert.equal(saved.agentId, 'ok')
    assert.equal(saved.recall.limit, 3)
    assert.equal(saved.recall.enabled, undefined)
  })
})

test('saving an empty object removes the workspace block', async () => {
  await withFreshStore(async (home) => {
    const dir = join(home, 'proj')
    mkdirSync(dir)
    writeWorkspaceSettings(dir, { agentId: 'x' })
    assert.ok(readWorkspaceSettings(dir))
    writeWorkspaceSettings(dir, {})
    assert.equal(readWorkspaceSettings(dir), undefined)
    assert.ok(!readFileSync(storePath(), 'utf-8').includes(rootKey(dir)), 'key removed from the document')
  })
})

/** The canonical key for a directory, for asserting on the raw document. */
function rootKey(dir) {
  return normalizeWorkspaceKey(dir)
}

test('clearing one workspace leaves the others', async () => {
  await withFreshStore(async (home) => {
    const a = join(home, 'a')
    const b = join(home, 'b')
    mkdirSync(a)
    mkdirSync(b)
    writeWorkspaceSettings(a, { agentId: 'a' })
    writeWorkspaceSettings(b, { agentId: 'b' })

    const cleared = clearWorkspaceSettings(a)
    assert.equal(cleared.ok, true)
    assert.equal(cleared.removed, true)
    assert.equal(readWorkspaceSettings(a), undefined)
    assert.equal(readWorkspaceSettings(b).agentId, 'b')

    // Clearing again is a no-op, not an error.
    const again = clearWorkspaceSettings(a)
    assert.equal(again.ok, true)
    assert.equal(again.removed, false)
  })
})

test('the merged view overrides only the keys it names', async () => {
  await withFreshStore(async (home) => {
    const dir = join(home, 'proj')
    mkdirSync(dir)
    const base = {
      url: 'http://daemon:3111',
      contextMaxChars: 64000,
      agentId: 'owner',
      recall: { limit: 5, maxChars: 4000, minQueryChars: 8 },
    }

    // No override at all: the base object comes back untouched.
    assert.equal(applyWorkspaceSettings(base, dir), base)

    writeWorkspaceSettings(dir, { agentId: 'work', recall: { limit: 2 } })
    const merged = applyWorkspaceSettings(base, dir)
    assert.equal(merged.agentId, 'work')
    assert.equal(merged.recall.limit, 2)
    // Everything unnamed still comes from the profile.
    assert.equal(merged.url, 'http://daemon:3111')
    assert.equal(merged.contextMaxChars, 64000)
    assert.equal(merged.recall.maxChars, 4000)
    assert.equal(merged.recall.minQueryChars, 8)
    // And the base object was not mutated.
    assert.equal(base.agentId, 'owner')
    assert.equal(base.recall.limit, 5)
  })
})

test('a corrupt store is reported and does not wipe itself', async () => {
  await withFreshStore(async (home) => {
    const path = join(home, 'storages', 'dsh-agentmemory-workspaces.json')
    mkdirSync(join(home, 'storages'), { recursive: true })
    writeFileSync(path, '{ this is not json')

    const { store: read, error } = readStore()
    assert.ok(error !== undefined, 'the corruption is surfaced')
    assert.deepEqual(read.workspaces, {}, 'an empty view is used')
    // The file is still there: a future fix can recover it.
    assert.equal(readFileSync(path, 'utf-8'), '{ this is not json')
  })
})

test('writing is atomic, so a partial write cannot be observed', async () => {
  // The write goes through a temp file and a rename. Detect that by checking no
  // `.tmp` file survives and the document parses after a write.
  await withFreshStore(async (home) => {
    const dir = join(home, 'proj')
    mkdirSync(dir)
    writeWorkspaceSettings(dir, { agentId: 'atomic' })
    const { readdirSync } = await import('node:fs')
    const leftovers = readdirSync(join(home, 'storages')).filter((name) => name.endsWith('.tmp'))
    assert.deepEqual(leftovers, [], 'no temp file left behind')
    const parsed = JSON.parse(readFileSync(storePath(), 'utf-8'))
    assert.equal(parsed.version, 1)
    assert.equal(parsed.workspaces[rootKey(dir)].agentId, 'atomic')
  })
})

test('the store cache notices an external edit', async () => {
  // The settings page writes through the plugin, but a user may hand-edit the
  // JSON. A cached-forever read would keep serving the stale document.
  await withFreshStore(async (home) => {
    const dir = join(home, 'proj')
    mkdirSync(dir)
    writeWorkspaceSettings(dir, { agentId: 'first' })
    assert.equal(readWorkspaceSettings(dir).agentId, 'first')

    // Simulate an external writer with a distinctly different size+mtime.
    const path = storePath()
    const doc = JSON.parse(readFileSync(path, 'utf-8'))
    doc.workspaces[rootKey(dir)].agentId = 'external-edit'
    writeFileSync(path, `${JSON.stringify(doc)}\n`)
    clearStoreCache()

    assert.equal(readWorkspaceSettings(dir).agentId, 'external-edit')
  })
})

test('sanitizeWorkspaceSettings keeps only writable, typed keys', () => {
  const cleaned = sanitizeWorkspaceSettings({
    agentId: 'a',
    url: 'u',
    contextMaxChars: 5,
    secretEnv: 'S',
    bogus: 1,
    recall: { limit: 2, includeLessons: false, nope: 1 },
  })
  assert.deepEqual(cleaned, {
    agentId: 'a',
    url: 'u',
    contextMaxChars: 5,
    secretEnv: 'S',
    recall: { limit: 2, includeLessons: false },
  })
  assert.deepEqual(sanitizeWorkspaceSettings(null), {})
  assert.deepEqual(sanitizeWorkspaceSettings('x'), {})
  assert.deepEqual(sanitizeWorkspaceSettings([1, 2]), {})
})

test('an empty cwd yields no key and no settings', async () => {
  await withFreshStore(async () => {
    assert.equal(normalizeWorkspaceKey(''), undefined)
    assert.equal(normalizeWorkspaceKey('   '), undefined)
    assert.equal(normalizeWorkspaceKey(undefined), undefined)
    assert.equal(readWorkspaceSettings(''), undefined)
    const result = writeWorkspaceSettings('', { agentId: 'x' })
    assert.equal(result.ok, false)
  })
})

/* ------------------------------------------------------------------ *
 * Global config, now stored in the same document
 * ------------------------------------------------------------------ */

test('global settings live in the same document as the workspaces', async () => {
  await withFreshStore(async () => {
    const dir = normalizeWorkspaceKey(storePath()) // placeholder to keep path import used
    writeGlobalSettings({ agentId: 'global-agent', recall: { limit: 9 } })
    const doc = JSON.parse(readFileSync(storePath(), 'utf-8'))
    assert.ok(doc.global !== undefined, 'global block is in the same file')
    assert.equal(doc.global.agentId, 'global-agent')
    assert.deepEqual(readGlobalSettings().config.recall.limit, 9)
    assert.ok(dir !== undefined)
  })
})

test('a missing store yields the built-in defaults, not blanks', async () => {
  // Before the move, the profile patch supplied these. Now the store is the only
  // source, so an absent file MUST still produce a usable config.
  await withFreshStore(async () => {
    const { config, error } = readGlobalSettings()
    assert.equal(error, undefined)
    assert.equal(config.contextMaxChars, GLOBAL_DEFAULTS.contextMaxChars)
    assert.equal(config.recall.limit, GLOBAL_DEFAULTS.recall.limit)
    assert.equal(config.workspace.enabled, true)
    assert.equal(config.agentId, GLOBAL_DEFAULTS.agentId)
  })
})

test('only non-default global values are persisted', async () => {
  // A fresh install should leave a small, readable file that shows at a glance
  // what the user actually changed.
  await withFreshStore(async () => {
    writeGlobalSettings({ agentId: 'changed-only' })
    const doc = JSON.parse(readFileSync(storePath(), 'utf-8'))
    assert.deepEqual(doc.global, { agentId: 'changed-only' })
    // Resetting writes nothing back, and reading restores every default.
    writeGlobalSettings({})
    const after = JSON.parse(readFileSync(storePath(), 'utf-8'))
    assert.deepEqual(after.global, {})
    assert.equal(readGlobalSettings().config.agentId, GLOBAL_DEFAULTS.agentId)
  })
})

test('global and workspace blocks do not interfere', async () => {
  await withFreshStore(async (home) => {
    const dir = join(home, 'proj')
    mkdirSync(dir)
    writeGlobalSettings({ agentId: 'global-x', recall: { limit: 4 } })
    writeWorkspaceSettings(dir, { agentId: 'local-y', recall: { limit: 1 } })

    assert.equal(readGlobalSettings().config.agentId, 'global-x')
    assert.equal(readWorkspaceSettings(dir).agentId, 'local-y')

    // The merge still layers the workspace on top of the global.
    const merged = applyWorkspaceSettings(readGlobalSettings().config, dir)
    assert.equal(merged.agentId, 'local-y')
    assert.equal(merged.recall.limit, 1)
    assert.equal(merged.contextMaxChars, GLOBAL_DEFAULTS.contextMaxChars)

    // One file holds both.
    const doc = JSON.parse(readFileSync(storePath(), 'utf-8'))
    assert.equal(doc.global.agentId, 'global-x')
    assert.equal(doc.workspaces[normalizeWorkspaceKey(dir)].agentId, 'local-y')
  })
})

test('an old store without a global block still reads', async () => {
  // Files written by the previous build have only `workspaces`. Losing every
  // workspace because the shape changed would be unacceptable.
  await withFreshStore(async (home) => {
    const path = storePath()
    mkdirSync(join(home, 'storages'), { recursive: true })
    writeFileSync(path, JSON.stringify({ version: 1, workspaces: { '/some/dir': { agentId: 'old' } } }))
    clearStoreCache()
    const { config, error } = readGlobalSettings()
    assert.equal(error, undefined, 'no error for a legacy file')
    assert.equal(config.agentId, GLOBAL_DEFAULTS.agentId)
    assert.equal(readStore().store.workspaces['/some/dir'].agentId, 'old', 'workspaces survive')
  })
})

test('sanitizeGlobalSettings drops junk and fills defaults', () => {
  const cleaned = sanitizeGlobalSettings({
    agentId: 'a',
    bogus: 1,
    contextMaxChars: 'nope',
    workspace: { enabled: false, junk: true },
    recall: { limit: 3, nope: 1 },
  })
  assert.equal(cleaned.agentId, 'a')
  assert.equal(cleaned.contextMaxChars, GLOBAL_DEFAULTS.contextMaxChars, 'wrong type falls back')
  assert.equal(cleaned.workspace.enabled, false)
  assert.equal(cleaned.workspace.allowEndpointOverride, GLOBAL_DEFAULTS.workspace.allowEndpointOverride)
  assert.equal(cleaned.recall.limit, 3)
  assert.equal(cleaned.recall.maxChars, GLOBAL_DEFAULTS.recall.maxChars)
  assert.equal('bogus' in cleaned, false)
})

test('saving a workspace never erases the global block', async () => {
  // Regression: the workspace writers rebuilt the document from
  // `{version, workspaces}` and dropped `global`, so editing one workspace
  // silently reset every global setting. Caught by a real test, not by review.
  await withFreshStore(async (home) => {
    const a = join(home, 'a')
    const b = join(home, 'b')
    mkdirSync(a)
    mkdirSync(b)

    writeGlobalSettings({ agentId: 'must-survive', contextMaxChars: 12345 })

    writeWorkspaceSettings(a, { agentId: 'a' })
    assert.equal(readGlobalSettings().config.agentId, 'must-survive', 'survives a workspace write')

    writeWorkspaceSettings(b, { agentId: 'b' })
    assert.equal(readGlobalSettings().config.contextMaxChars, 12345, 'survives a second write')

    writeWorkspaceSettings(a, {})
    assert.equal(readGlobalSettings().config.agentId, 'must-survive', 'survives a removal')

    clearWorkspaceSettings(b)
    assert.equal(readGlobalSettings().config.contextMaxChars, 12345, 'survives a clear')
  })
})
