/**
 * End-to-end probe: does the lesson cap actually reach the injected message?
 *
 * Unlike the unit tests (which call `trimLessons` directly), this drives the
 * REAL `apply()` against a fake Cordis context, fires the `agent/pre-step` hook
 * the same way the host does, and inspects the message the plugin appends.
 * That difference matters: the config ladder and the two injection call sites
 * are outside anything a direct-call unit test can reach.
 *
 * It talks to a REAL daemon, so it also proves the trim happens on the real
 * `/context` payload rather than on a hand-built fixture.
 *
 * ---------------------------------------------------------------------------
 * WHAT YOU NEED TO RUN IT
 * ---------------------------------------------------------------------------
 *
 * Required — it will not run without these:
 *
 *   1. Node.js 20+ (uses top-level await and `AbortSignal.any`).
 *   2. This package installed with its dependencies, i.e. inside a DSH profile
 *      (`<DSH_HOME>/profiles/<profile>/node_modules/@fgfg163/dsh-agentmemory-plugin`).
 *      Unpacking the tarball into an empty directory and running it there fails
 *      with `Cannot find package '@deepseek-ai/schemastery'` — that dependency
 *      comes from the DSH install, not from this package.
 *   3. A reachable agentmemory daemon, v0.9.x, already holding some lessons.
 *      With an empty store there is no `## Lessons Learned` section and the
 *      probe asserts out rather than passing vacuously.
 *   4. A bearer secret for that daemon, stored where the plugin's credentials
 *      seam looks for it. Default is `<DSH_HOME>/.credentials.yaml`:
 *
 *          refs:
 *            AGENTMEMORY_SECRET: <secret>
 *
 *      The daemon answers 401 without it, which the plugin reports only as
 *      "daemon rejected the request".
 *
 * Optional — every one has a working default:
 *
 *   AM_PROBE_PLUGIN       directory containing this plugin's `lib/`
 *                         (default: the parent of this file's directory)
 *   AM_PROBE_CREDENTIALS  path to the credentials file
 *                         (default: $DSH_HOME/.credentials.yaml,
 *                          else $HOME/.dsh, else %USERPROFILE%\.dsh)
 *   AM_PROBE_URL          daemon base URL (default: http://localhost:3111)
 *
 * Usage:
 *
 *     node test/probe-lessons.mjs <cap>
 *
 *   <cap> is the `contextMaxLessons` value to exercise. Use 0 as the control:
 *   it must inject every lesson the daemon sent, which is what proves a
 *   positive cap is doing the work rather than the daemon happening to send few.
 *
 *   Note that a value saved in the plugin's own store
 *   (`<DSH_HOME>/storages/dsh-agentmemory-workspaces.json`) OUTRANKS the <cap>
 *   argument here, because that is the same precedence the running plugin uses.
 *   Clear the key if a run disagrees with the argument.
 *
 * Exit status is 0 on success. It is a developer tool, not part of the runtime.
 */

import assert from 'node:assert/strict'

// Path handling is deliberately the standard-library route. The first attempt
// derived the default from `new URL('..', import.meta.url).pathname` and
// trimmed the leading slash; on Windows that pathname is "/C:/dir/", so the
// result was a bare "C:\dir" and the ESM loader rejected it ("Only URLs with a
// scheme in: file, data, and node are supported"). `pathToFileURL` is the
// inverse of `fileURLToPath` and works on both platforms.
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN = process.env.AM_PROBE_PLUGIN ?? resolve(HERE, '..')
const CREDENTIALS = process.env.AM_PROBE_CREDENTIALS
  ?? `${process.env.DSH_HOME ?? `${process.env.HOME ?? process.env.USERPROFILE}/.dsh`}/.credentials.yaml`
const DAEMON = process.env.AM_PROBE_URL ?? 'http://localhost:3111'
const { apply } = await import(pathToFileURL(resolve(PLUGIN, 'lib/index.js')).href)

/**
 * The URL the plugin will ACTUALLY call.
 *
 * `url: DAEMON` in the config below is only a fallback: the plugin's
 * `profileConfig()` lets a value in its own store outrank the config object, so
 * on a machine that has already saved a daemon URL, `AM_PROBE_URL` is ignored.
 * Reporting both is the difference between "my cap logic is broken" and "I
 * pointed it at the wrong daemon" — an actual confusion while writing this.
 */
function effectiveUrl() {
  try {
    const store = JSON.parse(readFileSync(
      `${process.env.DSH_HOME ?? `${process.env.HOME ?? process.env.USERPROFILE}/.dsh`}/storages/dsh-agentmemory-workspaces.json`,
      'utf8',
    ))
    const saved = store?.global?.url
    if (typeof saved === 'string' && saved.trim() !== '') return saved.replace(/\/$/, '')
  } catch {
    // No store yet — the config we pass is what the plugin will use.
  }
  return DAEMON
}

// ---- fake Cordis context -------------------------------------------------
const listeners = new Map()
const effects = []
const services = {}
// The plugin reaches the credentials service through `ctx.get('credentials')`,
// NOT `ctx.credentials` — getting this wrong makes every request go out without
// a bearer token and shows up only as "daemon rejected the request".
services.credentials = {
  async resolve() {
    const fs = await import('node:fs')
    let text
    try {
      text = fs.readFileSync(CREDENTIALS, 'utf8')
    } catch (error) {
      throw new Error(`cannot read credentials at ${CREDENTIALS} (set AM_PROBE_CREDENTIALS): ${error?.message ?? error}`)
    }
    const m = /AGENTMEMORY_SECRET:\s*(\S+)/.exec(text)
    if (!m) throw new Error(`no AGENTMEMORY_SECRET in ${CREDENTIALS}`)
    // The plugin reads `hit.value`, not the return value itself. Returning a
    // bare string makes it fall through to the legacy paths, send no bearer,
    // and the only symptom is a 401 that the plugin logs as
    // "daemon rejected the request".
    return { value: m[1] }
  },
}

const ctx = {
  logger: { info() {}, warn() {}, error() {}, debug() {} },
  on(event, fn) {
    const list = listeners.get(event) ?? []
    list.push(fn)
    listeners.set(event, list)
  },
  get: (name) => services[name],
  inject(names, cb) {
    // Recall is optional and absent here, which is the capture-only shape we
    // want: it proves the /context injection path needs no prompt-slot bundle.
    // Never call `cb` with a fake service — that is what silently swallowed the
    // hook registration on the first attempt.
  },
  effect(fn) {
    effects.push(fn())
  },
}

// ---- capture the injected message ---------------------------------------
let injectedMessage = null

function runHook({ project, sessionId }) {
  const session = { id: sessionId, events: [], append() {} }
  const state = session
  const agent = { session }
  // `listeners` maps an event to an ARRAY of handlers (an event can have many);
  // indexing is required, and forgetting it fails later as "hook is not a
  // function" rather than at the lookup.
  const hook = (listeners.get('agent/pre-step') ?? [])[0]
  if (!hook) throw new Error('pre-step hook was never registered')

  const fire = async (event, ...args) => {
    for (const fn of listeners.get(event) ?? []) await fn(...args)
  }

  return (async () => {
    await fire('session/created', session)
    const decision = await hook(
      { agent, signal: { aborted: false } },
      async () => ({ kind: 'enter', messages: [{ role: 'user', content: 'hello' }] }),
    )
    return decision
  })()
}

// ---- drive ----------------------------------------------------------------
const countLessons = (text) => {
  const at = text.indexOf('## Lessons Learned')
  if (at === -1) return 0
  return text
    .slice(at)
    .split('\n')
    .filter((line) => /^\s*-\s/.test(line)).length
}

// One cap per process: the plugin keeps module-level state (registered hooks,
// per-session state), so running two configs in one process measures the first
// one twice. Usage: node probe-lessons.mjs <cap>
const cap = Number(process.argv[2] ?? '3')
const result = {}
{
  // A plain object, NOT `new Config(...)`: every field of the real Config is a
  // volatile REFERENCE (`{ get }`), so `String(config.url)` yields
  // "[object Object]" and every request silently fails with a bogus URL. The
  // host passes the plugin an already-unwrapped view; mirror that here.
  const cfg = {
    url: DAEMON,
    secretEnv: 'AGENTMEMORY_SECRET',
    contextMaxChars: 64000,
    contextMaxLessons: cap,
    agentId: 'owner',
    recallAgentId: '',
    workspace: { enabled: true, allowEndpointOverride: false },
    recall: { enabled: false },
  }
  await apply(ctx, cfg)
  // Always state the endpoint actually in use. `url: DAEMON` below is only a
  // fallback — the plugin lets a saved store value win — so a run can silently
  // talk to a different daemon than AM_PROBE_URL names.
  const usedUrl = effectiveUrl()
  console.log(`cap=${cap}: daemon ${usedUrl}${usedUrl === DAEMON ? '' : `  (AM_PROBE_URL was ${DAEMON}; the plugin store outranks it)`}`)
  const decision = await runHook({ project: 'dsh', sessionId: `probe-cap-${cap}` })
  const message = decision.messages.find((m) => m.source?.kind === 'agentmemory')
  if (!message) {
    throw new Error([
      `cap=${cap}: no agentmemory message was injected — the plugin returns null`,
      `when the daemon is unreachable or rejects the credential.`,
      `  requested URL : ${DAEMON}`,
      `  plugin's URL  : ${effectiveUrl()}${effectiveUrl() === DAEMON ? '' : '  ← a value in the plugin store outranks AM_PROBE_URL'}`,
      `  credentials   : ${CREDENTIALS}`,
      `Check the daemon by hand:`,
      `  curl -s -o /dev/null -w '%{http_code}\\n' -X POST ${effectiveUrl()}/agentmemory/context \\`,
      `    -H "authorization: Bearer <secret>" -H "content-type: application/json" \\`,
      `    -d '{"sessionId":"probe","project":"dsh"}'`,
      `A 401 means the secret; a 000 means the endpoint.`,
    ].join('\n'))
  }
  const text = message.content[0].text
  const lessons = countLessons(text)
  result[cap] = { lessons, chars: text.length }
  console.log(`cap=${cap}: injected ${lessons} lessons, ${text.length} chars`)
}

// cap=0 is the CONTROL: every lesson the daemon sent must survive, which is
// what proves the cap above is doing the work rather than the daemon
// happening to send only three.
assert.ok(result[cap], `cap=${cap} produced no result`)
if (cap === 0) {
  assert.ok(result[0].lessons >= 4, `control: expected the untrimmed block to carry the daemon's full list, got ${result[0].lessons}`)
} else {
  assert.equal(result[cap].lessons, cap, `cap=${cap} should inject exactly ${cap} lessons, got ${result[cap].lessons}`)
}
console.log(`PROBE OK: cap=${cap} honoured on the real injection path`)
