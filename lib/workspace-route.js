/**
 * Workspace settings API — the Host half behind the settings page.
 *
 * ## Why a route rather than the settings form
 *
 * `ctx.configForms` can only write the profile's own `cordis.patch.yml`
 * namespace. Per-workspace settings are neither a profile field nor a file the
 * form can address, so the browser needs one narrow Host entry point.
 *
 * ## Authentication
 *
 * Registered through `connection.fetch.register()` at a path under `/api`, so
 * the shared `/api` carrier authenticates the browser session before dispatch
 * and this module never touches cookies, Host or Origin. (An earlier build put
 * the route outside `/api` and authenticated it by hand; that always answered
 * 401, because only the `/api` carrier mints the cookie it was checking for.)
 *
 * ## Why there is no "write this file" request
 *
 * Every action takes a WORKSPACE PATH and nothing else. The Host decides what
 * that means (`storages/dsh-agentmemory-workspaces.json`, keyed by the
 * canonicalised path). A caller cannot name a file, a directory to create, or a
 * key outside the declared schema, so the route has no way to be steered at an
 * arbitrary path. Values are re-validated against the same key table the runtime
 * reads with, so what the page shows and what the plugin applies cannot diverge.
 */

import {
  clearWorkspaceSettings,
  deleteStore,
  listWorkspaceSettings,
  normalizeWorkspaceKey,
  readStore,
  readWorkspaceSettings,
  sanitizeWorkspaceSettings,
  storePath,
  writeWorkspaceSettings,
} from './workspace-store.js'

/**
 * Route path.
 *
 * Must live under `/api`: `connection.fetch.register()` validates it with
 * `endpointFromPath('/api', path)` and throws otherwise.
 */
export const ROUTE_PATH = '/api/dsh-agentmemory/workspace'

/**
 * Fallback path for compositions without `connection.fetch`.
 *
 * Deliberately outside `/api` — that prefix belongs to the authenticated
 * carrier. Keeping the two apart lets a late `connection` claim the
 * authenticated path without a duplicate-route failure.
 */
export const FALLBACK_ROUTE_PATH = '/dsh-agentmemory/workspace'

/** Maximum accepted request body. */
const MAX_BODY_BYTES = 64 * 1024

/** Read one JSON body with a hard size cap. */
function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolvePromise) => {
    let size = 0
    const chunks = []
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolvePromise(value)
    }
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        finish(undefined)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf-8').trim()
      if (text === '') return finish({})
      try {
        const parsed = JSON.parse(text)
        finish(parsed !== null && typeof parsed === 'object' ? parsed : undefined)
      } catch {
        finish(undefined)
      }
    })
    req.on('error', () => finish(undefined))
  })
}

/** Send one JSON response on a node ServerResponse. */
function send(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

/**
 * Build the request handler and the carrier-agnostic dispatcher.
 *
 * @param options.resolveDirectory - maps the page's "current" choice to a real
 *   directory; see `currentWorkspace` in lib/index.js.
 * @param options.listWorkspaces - every registered DSH workspace as
 *   `[{ path, title }]`; the page's picker is built from this.
 * @param options.applyProfile - reads the live profile config as plain values.
 * @param options.writeProfile - persists plain values into the profile config.
 * @param options.logger - plugin logger.
 * @returns `{ handler, dispatch }`; both share one implementation.
 */
export function createWorkspaceRouteHandler(options) {
  const { resolveDirectory, listWorkspaces, applyProfile, writeProfile, logger } = options

  /**
   * Where a WRITE goes: only a directory the caller named.
   *
   * There is deliberately no fallback here. Until 0.13.4 a request without a
   * workspace fell back to `workingDirectory.defaultDirectory`, which in the
   * desktop host is the PROFILE directory (`%DSH_HOME%\profiles\desktop`) —
   * not a project at all. The settings page loads without a selection on its
   * first render, adopted that key, and the next keystroke created a settings
   * block for `profiles\desktop`. It then appeared in the picker as a second,
   * bogus workspace and could never be removed from the page while it stayed
   * selected.
   *
   * So: a write must name its target. `undefined` is an error, not a default.
   */
  const requiredTarget = (body) => {
    const wanted = typeof body?.workspace === 'string' ? body.workspace.trim() : ''
    if (wanted === '') return { error: 'no workspace was named; pick one before editing' }
    const dir = resolveDirectory(wanted)
    if (dir === undefined) return { error: 'that workspace directory is not usable' }
    return { dir, key: normalizeWorkspaceKey(dir) }
  }

  /** Every registered workspace, or none when the service is absent. */
  const registeredRows = () => (typeof listWorkspaces === 'function' ? listWorkspaces() : [])

  const actions = {
    /**
     * Everything the page needs on open: the profile config, the workspace
     * list, and this workspace's stored settings.
     */
    async status(body) {
      const { store, error, path } = readStore()
      const listed = listWorkspaceSettings()
      // Which directory the page is asking about, IF it asked about one.
      //
      // No fallback to the process/profile directory: that value is not a
      // workspace, and handing it back as `workspaceKey` made the page select
      // it and then save every edit into it (0.13.4 regression fix). A page
      // that names nothing gets `workspaceKey: null` and shows "pick one".
      const asked = typeof body?.workspace === 'string' ? body.workspace.trim() : ''
      const target = asked === '' ? { key: undefined, dir: undefined } : (() => {
        const dir = resolveDirectory(asked)
        return dir === undefined ? { key: undefined, dir: undefined } : { key: normalizeWorkspaceKey(dir), dir }
      })()
      // The picker lists every REGISTERED workspace, not just the ones that
      // already have settings: choosing from an "already customised" list only
      // would make the first override impossible to create.
      const registered = registeredRows()
      const customised = new Set(Object.keys(store.workspaces))
      const picker = registered.map((row) => ({
        path: row.path,
        title: row.title,
        customised: customised.has(normalizeWorkspaceKey(row.path)),
        registered: true,
      }))
      // A workspace with settings but no registration (deleted from the sidebar)
      // is still reachable, so it is not silently stranded. It is marked
      // `registered: false` so the page can say "this directory is not a DSH
      // workspace any more" instead of presenting it as a normal choice — that
      // indistinguishable row is what made a stray `profiles\desktop` block look
      // like a real second workspace.
      const orphans = []
      for (const row of listed.rows) {
        if (picker.some((entry) => normalizeWorkspaceKey(entry.path) === normalizeWorkspaceKey(row.path))) continue
        const added = { path: row.path, title: undefined, customised: true, registered: false }
        picker.push(added)
        orphans.push(row.path)
      }
      return {
        status: 200,
        body: {
          ok: true,
          storePath: path,
          storeError: error ?? listed.error ?? null,
          profile: applyProfile(),
          workspaces: picker,
          /** Directories holding settings that no DSH workspace answers to. */
          orphaned: orphans,
          workspaceKey: target.key ?? null,
          workspace: target.key === undefined ? null : readWorkspaceSettings(target.dir) ?? null,
          // Total count so the page can say "3 workspaces customised".
          workspaceCount: Object.keys(store.workspaces).length,
        },
      }
    },

    /**
     * Persist one workspace's settings. Called on every edit — the page saves
     * on change, so this must be cheap and idempotent.
     */
    async save(body) {
      const target = requiredTarget(body)
      if (target.error) return { status: 400, body: { ok: false, reason: target.error } }
      const result = writeWorkspaceSettings(target.dir, body.settings)
      if (!result.ok) return { status: 400, body: { ok: false, reason: result.reason } }
      return {
        status: 200,
        body: {
          ok: true,
          key: result.key,
          settings: result.settings,
          cleared: Object.keys(result.settings).length === 0,
        },
      }
    },

    /** Remove this workspace's settings, leaving every other workspace alone. */
    async clear(body) {
      const target = requiredTarget(body)
      if (target.error) return { status: 400, body: { ok: false, reason: target.error } }
      const result = clearWorkspaceSettings(target.dir)
      if (!result.ok) return { status: 400, body: { ok: false, reason: result.reason } }
      return { status: 200, body: { ok: true, removed: result.removed, key: result.key } }
    },

    /** Plain profile values, for the page's "follow global" display. */
    async 'read-global'() {
      return { status: 200, body: { ok: true, config: applyProfile() } }
    },

    /**
     * Write the profile config.
     *
     * Kept because the workspace blocks are *overrides*: the page still needs a
     * way to edit the thing they override.
     */
    async 'write-global'(body) {
      const values = sanitizeWorkspaceSettings(body?.config)
      if (Object.keys(values).length === 0) {
        return { status: 400, body: { ok: false, reason: 'nothing to save: no known keys in the payload' } }
      }
      const result = await writeProfile(values)
      if (!result.ok) return { status: 409, body: { ok: false, reason: result.reason } }
      return { status: 200, body: { ok: true, saved: Object.keys(values) } }
    },

    /** Drop every workspace override at once. */
    async 'reset-all'() {
      const removed = deleteStore()
      return { status: 200, body: { ok: true, removed } }
    },
  }

  /** Body-first so a rejected request never leaves an unread stream behind. */
  const handler = async function handler(req, res) {
    const body = req.method === 'POST' ? await readBody(req) : {}
    if (body === undefined) {
      send(res, 413, { ok: false, reason: 'request body is too large or not valid JSON' })
      return
    }
    if (req.method !== 'POST') {
      send(res, 405, { ok: false, reason: 'use POST' })
      return
    }
    const result = await dispatch(body)
    send(res, result.status, result.body)
  }

  /**
   * Dispatch over an already-parsed body.
   *
   * Split out so the Fetch carrier and the node handler share one
   * implementation; a second copy would be free to drift.
   */
  async function dispatch(body) {
    const action = body?.action
    if (typeof action !== 'string' || !Object.prototype.hasOwnProperty.call(actions, action)) {
      return { status: 400, body: { ok: false, reason: `unknown action ${JSON.stringify(action)}` } }
    }
    try {
      return await actions[action](body)
    } catch (error) {
      logger?.warn?.(`agentmemory workspace route: ${error?.message ?? error}`)
      return { status: 500, body: { ok: false, reason: String(error?.message ?? error) } }
    }
  }

  return { handler, dispatch }
}

export { storePath }
