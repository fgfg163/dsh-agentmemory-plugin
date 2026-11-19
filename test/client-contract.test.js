/**
 * Static checks on the browser half.
 *
 * These exist because of a bug that shipped and was caught only by looking at a
 * screenshot: the workspace editor rendered two action buttons labelled
 * `labels.wsClearWorkspace` and `labels.wsResetDefaults`, but those keys had
 * been deleted from the `zh` table while rewriting it. The buttons rendered with
 * no text and looked like empty boxes.
 *
 * A type checker would have caught it; this package has none, so the assertion
 * is made here instead. It reads `lib/client.js` as text — the file is a browser
 * bundle that cannot be imported under Node (it calls `window.__ModuleLoader__`
 * at module scope), so parsing is the only option.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'lib', 'client.js'), 'utf-8')

/** Every label name referenced anywhere as `<something>.<name>` off a labels-like object. */
function labelReferences() {
  const names = new Set()
  // `labels.x` inside the page, and `zh.x` where the labels table is passed
  // directly (the nav title is read as `zh.nav` at registration time).
  for (const match of source.matchAll(/\b(?:labels|zh)\.([A-Za-z_$][\w$]*)/g)) names.add(match[1])
  return names
}

/** Keys declared in the `zh` label table. */
function declaredLabels() {
  const start = source.indexOf('const zh = {')
  assert.notEqual(start, -1, 'the zh label table exists')
  // The table ends at the first line that closes it at column 4.
  const end = source.indexOf('\n    }', start)
  assert.notEqual(end, -1, 'the zh label table is closed')
  const body = source.slice(start, end)
  const keys = new Set()
  for (const match of body.matchAll(/^\s{6}([A-Za-z_$][\w$]*)\s*:/gm)) keys.add(match[1])
  return keys
}

test('every label the page uses is declared', () => {
  const used = labelReferences()
  const declared = declaredLabels()
  const missing = [...used].filter((name) => !declared.has(name)).sort()
  assert.deepEqual(
    missing,
    [],
    `labels referenced but never defined (they render as empty UI): ${missing.join(', ')}`,
  )
})

test('no declared label is left unused', () => {
  // Dead labels are the same mistake in reverse: they accumulate because a
  // removed control leaves its strings behind, and the next reader cannot tell
  // whether a string is dead or simply reached by another code path.
  const used = labelReferences()
  const declared = declaredLabels()
  const unused = [...declared].filter((name) => !used.has(name)).sort()
  assert.deepEqual(unused, [], `labels declared but never used: ${unused.join(', ')}`)
})

test('the button row that shipped without labels is gone', () => {
  // The two empty boxes in the screenshot. Clearing a field already means
  // "follow global", so these controls were removed rather than relabelled.
  // Match whole identifiers: `wsConfirmClearThis` (the current per-workspace
  // delete button) legitimately starts with the old `wsConfirmClear`.
  for (const name of ['wsClearWorkspace', 'wsResetDefaults', 'wsConfirmClear', 'wsConfirmReset']) {
    const pattern = new RegExp(`\\b${name}\\b(?!\\w)`)
    assert.ok(!pattern.test(source), `${name} must not reappear without a control that uses it`)
  }
})

test('the settings page never calls a route action the Host does not serve', async () => {
  // The page and the Host are two files with one contract; a typo in the action
  // name is a 400 at runtime and silence in review.
  const route = readFileSync(join(here, '..', 'lib', 'workspace-route.js'), 'utf-8')
  const served = new Set()
  for (const match of route.matchAll(/^\s{4}(?:async\s+)?(?:'([\w-]+)'|([\w$]+))\s*\(/gm)) {
    const name = match[1] ?? match[2]
    if (name === 'constructor' || name === 'if' || name === 'for' || name === 'while') continue
    served.add(name)
  }
  // The three actions the page actually uses; `write-global` and `reset-all` are
  // served for completeness but not called from this page.
  for (const action of ['status', 'save', 'clear']) {
    assert.ok(served.has(action), `Host serves "${action}" (found: ${[...served].join(', ')})`)
  }
  for (const match of source.matchAll(/callRoute\('([^']+)'/g)) {
    assert.ok(served.has(match[1]), `page calls "${match[1]}", which the Host does not serve`)
  }
})

test('the global save omits cleared fields instead of storing blanks', () => {
  // A real config file once got `agentId: ""` written into it, which the
  // runtime reads as an explicit empty id rather than "unset". The save now
  // deletes blank keys so the default applies.
  const save = source.slice(source.indexOf('const commitGlobal'))
  assert.ok(save.length > 0, 'commitGlobal exists')
  assert.ok(save.includes("if (cleaned.agentId === '') delete cleaned.agentId"), 'blank agentId is dropped')
  assert.ok(save.includes("if (cleaned.url === '') delete cleaned.url"), 'blank url is dropped')
  // Nothing writes a literal empty string into the stored value.
  assert.ok(!/agentId: ''/.test(save), 'no empty-string agentId is persisted')
})

test('an unchanged form does not send a write', () => {
  // The debounce fires on a keystroke boundary even when the value ends up the
  // same; posting that would rewrite the file and flash a save notice.
  const save = source.slice(source.indexOf('const commitGlobal'))
  assert.ok(save.includes('JSON.stringify(cleaned) === JSON.stringify(base)'), 'compares before writing')
})

test('the global form autosaves instead of requiring a button', () => {
  // The Save/Discard pair is gone: an edit schedules a debounced write.
  assert.ok(source.includes('scheduleGlobalSave(next)'), 'edits schedule a save')
  // Match the label reference exactly: `labels.saveFailed` is a different key.
  assert.ok(!/labels\.save\b/.test(source), 'no Save label is referenced')
})

test('no early return appears before the last hook in the page component', () => {
  // React requires the same hook count on every render. Returning before a hook
  // skips it, which silently unmounts the effect that loads the data — the page
  // then stays on "connecting" forever. This shipped once and was only caught
  // by opening it in a browser.
  const page = source.slice(source.indexOf('const AgentMemoryPage'))
  const body = page.slice(0, page.indexOf('const disabled ='))
  const lines = body.split('\n')

  let lastHook = -1
  lines.forEach((line, index) => {
    if (/react\.use(State|Effect|Memo|Ref|Callback)\(/.test(line)) lastHook = index
  })
  assert.ok(lastHook > 0, 'the component uses hooks')

  const earlyReturns = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^\s{6}if \(.*\) \{\s*$/.test(line) || /^\s{6}return react\.createElement/.test(line))
  const beforeHooks = earlyReturns.filter(({ index }) => index < lastHook)
  assert.deepEqual(
    beforeHooks.map((r) => r.index),
    [],
    `early return before the last hook at line ${lastHook}: ${beforeHooks.map((r) => r.line.trim()).join(' | ')}`,
  )
})

test('every helper the page calls is defined in the bundle', () => {
  // `normalizeGlobal(...)` shipped without a definition. `node --check` cannot
  // see it (it is valid syntax), the unit tests cannot import the bundle (it
  // calls window.__ModuleLoader__ at module scope), and the page just stayed on
  // "connecting". So the names are checked textually.
  const declared = new Set()
  for (const match of source.matchAll(/\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g)) declared.add(match[1])
  for (const match of source.matchAll(/\bconst\s*\{([^}]+)\}\s*=/g)) {
    for (const part of match[1].split(',')) {
      const name = part.split(':').pop().trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name)
    }
  }
  for (const match of source.matchAll(/const\s*\[([^\]]+)\]\s*=/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name)
    }
  }

  // Local helpers used by the settings page, by name.
  const helpers = ['callRoute', 'loadWorkspace', 'saveOverride', 'commitGlobal', 'scheduleGlobalSave', 'AgentMemoryPage', 'Row', 'NumberInput']
  const missing = helpers.filter((name) => !declared.has(name))
  assert.deepEqual(missing, [], `helpers called but never declared: ${missing.join(', ')}`)
})

test('a failed store read still leaves the loading state', () => {
  // The page renders a "connecting" placeholder while `remote` is null. The
  // error path used to `return` without setting it, so any unreachable route —
  // including a plain 401 in a browser without a session — left the panel
  // spinning forever with no visible reason.
  const load = source.slice(source.indexOf('const loadWorkspace'), source.indexOf('const saveOverride'))
  const errorBranch = load.slice(load.indexOf('setWsState({ phase: \'error\' })'))
  const branchEnd = errorBranch.indexOf('return')
  const inside = errorBranch.slice(0, branchEnd)
  assert.ok(inside.includes('setRemote('), 'the error branch must set a value so the panel renders')
  assert.ok(source.includes('storeUnreachable'), 'and the page must say the values are defaults')
})

/*
 * 0.13.2 — the settings page must expose TWO agent id fields.
 *
 * The whole point of the split is that a user can label captured rows and
 * filter recall independently. A regression that remerged them into one row
 * would still pass every other test (the Host accepts both keys), so the page
 * contract is asserted here: two distinct inputs, distinct ids, and a blank
 * read id that says what blank means.
 */
test('the page renders separate write and read agent id fields', () => {
  assert.ok(source.includes("id: 'am-agent'"), 'the write id field exists')
  assert.ok(source.includes("id: 'am-recall-agent'"), 'the read id field exists')
  assert.ok(source.includes("setPath(['recallAgentId']"), 'the read id is editable on its own path')
  assert.ok(source.includes("setPath(['agentId']"), 'the write id is still editable')
  // Two rows, not one control with two labels.
  assert.ok(source.includes('labels.recallAgentIdTitle'), 'the read id row is labelled')
  assert.ok(source.includes('labels.agentIdTitle'), 'the write id row is labelled')
})

test('the read id field says that blank means no filter', () => {
  // Without this the field looks empty-and-broken rather than deliberately off,
  // and users type "owner" to "fix" it — which is the filter this split avoids.
  const row = source.slice(source.indexOf("id: 'am-recall-agent'"))
  assert.ok(row.includes("placeholder: '留空＝不过滤'"), 'blank is explained in the field itself')
})

test('clearing the read id is sent, not dropped', () => {
  // `url` / `agentId` are dropped when blank so the default applies. The read id
  // must NOT be dropped: the Host merges what the page sends, so an absent key
  // leaves the old filter in place and clearing the field silently does nothing.
  const save = source.slice(source.indexOf('const commitGlobal'))
  assert.ok(!save.includes("if (cleaned.recallAgentId === '')"), 'a blank read id is not deleted from the payload')
  assert.ok(!/recallAgentId: ''/.test(source.split('const commitGlobal')[0]), 'the old empty-string guard is gone')
})

/*
 * The workspace override rows are generated from one loop, so a missing width
 * silently falls back to whatever the last hand-written value was — which is
 * how every field ended up the same 220px box, an id field as wide as a
 * five-digit character ceiling. These assertions pin the per-field widths to
 * the same numbers the hand-written global rows use.
 */
test('every workspace override field declares its own width', () => {
  const table = source.slice(source.indexOf('const WS_OVERRIDE_FIELDS'), source.indexOf(']', source.indexOf('const WS_OVERRIDE_FIELDS')))
  const entries = [...table.matchAll(/\{\s*key:\s*'([\w]+)'[^}]*\}/g)]
  assert.ok(entries.length >= 8, `the field table parsed (found ${entries.length})`)
  for (const entry of entries) {
    assert.match(entry[0], /\bwidth:\s*\d+/, `${entry[1]} declares a width`)
  }
})

test('the workspace rows actually use the declared width', () => {
  // Declaring widths but rendering a literal would pass the test above and
  // still look uniform, so the render path is asserted separately.
  const render = source.slice(source.indexOf('...WS_OVERRIDE_FIELDS.map'))
  assert.ok(render.includes('width: field.width'), 'the input uses field.width')
  assert.ok(!/width:\s*220/.test(render.slice(0, 1200)), 'no hardcoded 220 remains in the override rows')
})

test('ids are narrower than long numbers, matching the global rows', () => {
  // A shape assertion rather than exact values: it catches a reformat that
  // collapses the table back to one width, without pinning every future edit.
  const table = source.slice(source.indexOf('const WS_OVERRIDE_FIELDS'), source.indexOf(']', source.indexOf('const WS_OVERRIDE_FIELDS')))
  const widthOf = (key) => {
    const hit = table.match(new RegExp(`key: '${key}'[^}]*width: (\\d+)`))
    return hit ? Number(hit[1]) : undefined
  }
  assert.equal(widthOf('agentId'), 180, 'ids get the global id width')
  assert.equal(widthOf('maxChars'), 140, 'the long ceiling matches the global one')
  assert.equal(widthOf('minConfidence'), 100, 'a 0..1 value needs the least room')
})
