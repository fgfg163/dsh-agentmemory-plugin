/**
 * Per-workspace AgentMemory settings — the durable store.
 *
 * ## What changed and why
 *
 * The first design put a `.dsh-agentmemory.yml` inside each project directory
 * and drove it from six buttons in the settings page. Two problems showed up:
 *
 * 1. **"Which workspace am I saving to?"** was unanswerable from the page. The
 *    fallback directory (`workingDirectory.defaultDirectory`) is the process
 *    default, not the workspace the user was looking at, so an empty box wrote
 *    somewhere unrelated.
 * 2. **Every change needed a manual save**, which is not how the rest of the
 *    settings UI behaves (`dsh-lan-tool`, `dsh-workspace-settings` and the
 *    official sections all save on change).
 *
 * So the settings now live in ONE JSON document under `$DSH_HOME/storages/`,
 * keyed by workspace path, and an edit is persisted immediately. This is the
 * same shape `dsh-lan-tool` uses for its own state file and the same place DSH
 * keeps every other plugin's data (`storages/`).
 *
 * ## Why a hand-written store rather than `ctx.storageDomain`
 *
 * `storageDomain` is the official durable layer, but it requires declaring a
 * schema-versioned domain and importing `@deepseek-ai/dsh-storage-domain` as a
 * dependency. This plugin's data is one small map that is read on session start
 * and written on a settings edit; a dependency on an internal package (whose
 * exports are not a stability promise for third-party plugins) buys nothing
 * here. The file format is plain JSON that a user can read and repair.
 *
 * ## Key normalisation
 *
 * A workspace is identified by its directory path. The same directory reaches
 * this module written several ways — trailing separator, mixed case on Windows,
 * symlinked ancestors — and two spellings of one directory must NOT become two
 * independent settings blocks. `normalizeWorkspaceKey` reduces them to one
 * canonical string, and `realpath` is used when the path exists so a symlink
 * resolves to its target.
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'

/** Store schema version; bump when the shape changes incompatibly. */
export const STORE_VERSION = 1

/** File name inside the storages directory. */
const STORE_FILE = 'dsh-agentmemory-workspaces.json'

/** Keys the store may hold per workspace, mirroring the plugin's config. */
const WORKSPACE_KEYS = {
  url: 'string',
  secretEnv: 'string',
  contextMaxChars: 'number',
  agentId: 'string',
  recallAgentId: 'string',
}

/** Nested `recall` keys the store may hold. */
const RECALL_KEYS = {
  enabled: 'boolean',
  limit: 'number',
  maxChars: 'number',
  entryMaxChars: 'number',
  fetchTimeoutMs: 'number',
  queryMaxChars: 'number',
  minConfidence: 'number',
  includeLessons: 'boolean',
  tailRatio: 'number',
  minQueryChars: 'number',
}

/** Process-level cache: the parsed document plus the stat it came from. */
let cache

/** `$DSH_HOME`, matching how every other DSH data file is located. */
export function dshHome() {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

/** Absolute path of the store document. */
export function storePath() {
  return join(dshHome(), 'storages', STORE_FILE)
}

/**
 * Canonical key for one workspace directory.
 *
 * Trailing separators are dropped, the path is made absolute, and — when it
 * exists — resolved through `realpath` so a symlinked project does not get a
 * second block. Case is preserved: on a case-insensitive filesystem two
 * spellings still answer to one directory, but folding case here would corrupt
 * paths on a case-sensitive one, so the risk stays where the OS owns it.
 *
 * @param cwd - any spelling of the directory.
 * @returns the key, or `undefined` when there is no usable path.
 */
export function normalizeWorkspaceKey(cwd) {
  if (typeof cwd !== 'string') return undefined
  const trimmed = cwd.trim()
  if (trimmed === '') return undefined
  let absolute = resolve(trimmed)
  // `resolve` keeps a trailing separator only for the filesystem root.
  if (absolute.length > 1 && absolute.endsWith(sep)) absolute = absolute.slice(0, -1)
  try {
    if (statSync(absolute).isDirectory()) return realpathSync(absolute)
  } catch {
    // A directory that does not exist yet still gets a stable key.
  }
  return absolute
}

/** An empty document. */
function emptyStore() {
  return { version: STORE_VERSION, global: {}, workspaces: {} }
}

/**
 * Read and cache the document.
 *
 * A corrupt file is reported rather than silently replaced: wiping it would
 * discard every workspace's settings because of one bad byte, and the caller
 * can decide to show the user.
 *
 * @returns `{ store, error }`; `store` is always usable.
 */
export function readStore() {
  const path = storePath()
  let stat
  try {
    stat = statSync(path)
  } catch {
    cache = undefined
    return { store: emptyStore(), error: undefined, path }
  }
  if (cache !== undefined && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) {
    return { store: cache.store, error: cache.error, path }
  }
  let store = emptyStore()
  let error
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    if (parsed !== null && typeof parsed === 'object' && parsed.workspaces !== null && typeof parsed.workspaces === 'object') {
      store = {
        version: Number.isInteger(parsed.version) ? parsed.version : STORE_VERSION,
        // Older files have no `global` block; an empty object means "all
        // defaults", which is exactly how a pre-migration install behaved.
        global: parsed.global !== null && typeof parsed.global === 'object' && !Array.isArray(parsed.global) ? parsed.global : {},
        workspaces: parsed.workspaces,
      }
    } else {
      error = 'store file has an unexpected shape; using empty settings'
    }
  } catch (cause) {
    error = `store file is not readable JSON: ${cause?.message ?? cause}`
  }
  cache = { mtimeMs: stat.mtimeMs, size: stat.size, store, error }
  return { store, error, path }
}

/**
 * Persist the document atomically.
 *
 * Write-temp-then-rename so a crash mid-write cannot leave a truncated file
 * that would look like "all my workspace settings vanished".
 *
 * @param store - the document to write.
 */
export function writeStore(store) {
  const path = storePath()
  mkdirSync(dirname(path), { recursive: true })
  const document = {
    version: STORE_VERSION,
    // Always emitted, even when empty: a reader should see that this file is
    // the single home of the plugin's configuration, not just the overrides.
    global: store.global ?? {},
    workspaces: store.workspaces ?? {},
  }
  const body = `${JSON.stringify(document, null, 2)}\n`
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, body, 'utf-8')
  renameSync(temporary, path)
  cache = undefined
  return path
}

/**
 * Keep only known, correctly typed keys.
 *
 * @param input - arbitrary object, typically straight from the browser.
 * @returns a plain object safe to store.
 */
export function sanitizeWorkspaceSettings(input) {
  const out = {}
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return out
  for (const [key, kind] of Object.entries(WORKSPACE_KEYS)) {
    if (typeof input[key] === kind) out[key] = input[key]
  }
  const recall = input.recall
  if (recall !== null && typeof recall === 'object' && !Array.isArray(recall)) {
    const kept = {}
    for (const [key, kind] of Object.entries(RECALL_KEYS)) {
      if (typeof recall[key] === kind) kept[key] = recall[key]
    }
    if (Object.keys(kept).length > 0) out.recall = kept
  }
  return out
}

/**
 * Settings stored for one workspace.
 *
 * @param cwd - the workspace directory.
 * @returns the stored block, or `undefined` when this workspace has none.
 */
export function readWorkspaceSettings(cwd) {
  const key = normalizeWorkspaceKey(cwd)
  if (key === undefined) return undefined
  const { store } = readStore()
  const entry = store.workspaces[key]
  if (entry === null || typeof entry !== 'object') return undefined
  const settings = sanitizeWorkspaceSettings(entry)
  return Object.keys(settings).length > 0 ? settings : undefined
}

/**
 * Merge one workspace's settings into a base config.
 *
 * Same merge contract as the directory-file design: only the keys this
 * workspace names change, everything else falls back to the profile value.
 *
 * @param base - the profile config, already unwrapped.
 * @param cwd - the workspace directory.
 * @returns the merged config.
 */
export function applyWorkspaceSettings(base, cwd) {
  const settings = readWorkspaceSettings(cwd)
  if (settings === undefined) return base
  const merged = { ...base, recall: { ...(base.recall ?? {}) } }
  for (const [key, value] of Object.entries(settings)) {
    if (key === 'recall') Object.assign(merged.recall, value)
    else merged[key] = value
  }
  return merged
}

/**
 * Replace one workspace's settings.
 *
 * @param cwd - the workspace directory.
 * @param input - arbitrary settings object.
 * @returns `{ ok, key, settings }` or `{ ok: false, reason }`.
 */
export function writeWorkspaceSettings(cwd, input) {
  const key = normalizeWorkspaceKey(cwd)
  if (key === undefined) return { ok: false, reason: 'no workspace directory was given' }
  const settings = sanitizeWorkspaceSettings(input)
  const { store } = readStore()
  const workspaces = { ...store.workspaces }
  if (Object.keys(settings).length === 0) delete workspaces[key]
  else workspaces[key] = settings
  // Carry the global block through: writing workspaces must never erase it.
  writeStore({ version: STORE_VERSION, global: store.global, workspaces })
  return { ok: true, key, settings }
}

/**
 * Remove one workspace's settings.
 *
 * @param cwd - the workspace directory.
 * @returns `{ ok, removed }`.
 */
export function clearWorkspaceSettings(cwd) {
  const key = normalizeWorkspaceKey(cwd)
  if (key === undefined) return { ok: false, removed: false, reason: 'no workspace directory was given' }
  const { store } = readStore()
  if (!(key in store.workspaces)) return { ok: true, removed: false, key }
  const workspaces = { ...store.workspaces }
  delete workspaces[key]
  // Carry the global block through: writing workspaces must never erase it.
  writeStore({ version: STORE_VERSION, global: store.global, workspaces })
  return { ok: true, removed: true, key }
}

/**
 * Every workspace that has settings, for the page's summary list.
 *
 * @returns `[{ path, settings }]`, most recently written first is not tracked,
 *   so this is the store's own insertion order.
 */
export function listWorkspaceSettings() {
  const { store, error } = readStore()
  const rows = []
  for (const [path, value] of Object.entries(store.workspaces)) {
    const settings = sanitizeWorkspaceSettings(value)
    if (Object.keys(settings).length > 0) rows.push({ path, settings })
  }
  return { rows, error }
}

/**
 * Settings that apply to every workspace unless a workspace overrides them.
 *
 * These used to live in the profile's `cordis.patch.yml`, where DSH's settings
 * service read and wrote them. They moved here so that ALL of this plugin's
 * configuration lives in one directory (`$DSH_HOME/storages/`), matching how
 * every other section of DSH stores its data and making a backup a single copy.
 *
 * The cost is real and worth stating: the profile patch no longer carries these
 * values, so DSH's generated settings form no longer edits them — this plugin's
 * own page is the only editor. `cordis.patch.yml` keeps the mount row (`id` and
 * `name`), which is all DSH needs to load the plugin.
 */
export const GLOBAL_DEFAULTS = Object.freeze({
  url: '',
  secretEnv: 'AGENTMEMORY_SECRET',
  contextMaxChars: 64000,
  agentId: 'owner',
  // Empty on purpose: no filter. Sending an id here would hide every row
  // written under a different one, and this store already contains rows from
  // several clients (see lib/recall.js "Scope").
  recallAgentId: '',
  workspace: { enabled: true, allowEndpointOverride: false },
  recall: {
    enabled: true,
    limit: 5,
    maxChars: 4000,
    fetchTimeoutMs: 1200,
    queryMaxChars: 800,
    minConfidence: 0.5,
    includeLessons: false,
    tailRatio: 0.95,
    minQueryChars: 8,
  },
})

/** Keys the global block may carry. */
const GLOBAL_KEYS = {
  url: 'string',
  secretEnv: 'string',
  contextMaxChars: 'number',
  agentId: 'string',
  recallAgentId: 'string',
}

/** Nested keys under `global.workspace`. */
const GLOBAL_WORKSPACE_KEYS = {
  enabled: 'boolean',
  allowEndpointOverride: 'boolean',
}

/**
 * Keep only known, correctly typed global keys, filling gaps from the defaults.
 *
 * Unlike the workspace block, a missing global key takes its DEFAULT rather than
 * falling back to another layer: there is no other layer any more.
 *
 * @param input - arbitrary object, typically straight from the browser.
 * @returns a complete global config.
 */
export function sanitizeGlobalSettings(input) {
  const out = {
    ...GLOBAL_DEFAULTS,
    workspace: { ...GLOBAL_DEFAULTS.workspace },
    recall: { ...GLOBAL_DEFAULTS.recall },
  }
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return out
  for (const [key, kind] of Object.entries(GLOBAL_KEYS)) {
    if (typeof input[key] === kind) out[key] = input[key]
  }
  const workspace = input.workspace
  if (workspace !== null && typeof workspace === 'object' && !Array.isArray(workspace)) {
    for (const [key, kind] of Object.entries(GLOBAL_WORKSPACE_KEYS)) {
      if (typeof workspace[key] === kind) out.workspace[key] = workspace[key]
    }
  }
  const recall = input.recall
  if (recall !== null && typeof recall === 'object' && !Array.isArray(recall)) {
    for (const [key, kind] of Object.entries(RECALL_KEYS)) {
      if (typeof recall[key] === kind) out.recall[key] = recall[key]
    }
  }
  return out
}

/**
 * The global config, with defaults filled in.
 *
 * @returns `{ config, error }`; `config` is always complete.
 */
export function readGlobalSettings() {
  const { store, error } = readStore()
  return { config: sanitizeGlobalSettings(store.global), error }
}

/**
 * Replace the stored global config.
 *
 * Only keys that DIFFER from the defaults are written, so a fresh install keeps
 * a tiny file and a reader can see at a glance what was customised.
 *
 * @param input - arbitrary settings object.
 * @returns `{ ok, config }`.
 */
export function writeGlobalSettings(input) {
  const config = sanitizeGlobalSettings(input)
  const compact = {}
  for (const [key, kind] of Object.entries(GLOBAL_KEYS)) {
    if (config[key] !== GLOBAL_DEFAULTS[key] && typeof config[key] === kind) compact[key] = config[key]
  }
  const workspace = {}
  for (const [key, kind] of Object.entries(GLOBAL_WORKSPACE_KEYS)) {
    if (config.workspace[key] !== GLOBAL_DEFAULTS.workspace[key] && typeof config.workspace[key] === kind) {
      workspace[key] = config.workspace[key]
    }
  }
  if (Object.keys(workspace).length > 0) compact.workspace = workspace
  const recall = {}
  for (const [key, kind] of Object.entries(RECALL_KEYS)) {
    if (config.recall[key] !== GLOBAL_DEFAULTS.recall[key] && typeof config.recall[key] === kind) {
      recall[key] = config.recall[key]
    }
  }
  if (Object.keys(recall).length > 0) compact.recall = recall

  const { store } = readStore()
  writeStore({ version: STORE_VERSION, global: compact, workspaces: store.workspaces })
  return { ok: true, config }
}

/**
 * Settings that apply to every workspace unless a workspace overrides them.
 *
 * Read at session start; the merged result then flows through the same path
 * that used to read the profile config.
 */
export function globalSettings() {
  return readGlobalSettings().config
}

/** Drop the in-process cache; used by tests and after an external edit. */
export function clearStoreCache() {
  cache = undefined
}

/**
 * Delete the store document, if it exists.
 *
 * Only used by "reset defaults" — a workspace-level clear and a full reset are
 * different operations and the page exposes them separately.
 */
export function deleteStore() {
  const path = storePath()
  if (!existsSync(path)) return false
  unlinkSync(path)
  cache = undefined
  return true
}
