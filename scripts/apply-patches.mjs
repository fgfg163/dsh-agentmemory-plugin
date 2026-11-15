#!/usr/bin/env node
/**
 * Re-apply this fork's patches to an upstream `dist/integrations/dsh.mjs`.
 *
 * Usage:
 *   node scripts/apply-patches.mjs <upstream-dsh.mjs> <output-path>
 *
 * Both arguments are required. The output is written even if it equals the
 * input path (in-place patching is fine — nothing is opened until the text has
 * been read into memory).
 *
 * ## Why this script exists
 *
 * The DSH integration is compiled into the main @agentmemory/agentmemory
 * bundle. Upstream publishes no separate package, so every `npm i -g` upgrade
 * silently reverts any local fix. This script makes re-applying them one
 * command, and — unlike the PowerShell script it replaces — it FAILS LOUDLY.
 *
 * ## The anchor trap
 *
 * `dsh.mjs` is build output, not source. `function safe(value, limit = 8e3)`
 * is what esbuild compresses `limit = 8000` into; a change to the build target
 * turns it back into `8000` and a naive string match stops finding it.
 *
 * The predecessor script (patch-agentmemory-dsh.ps1) printed a single `[warn]`
 * line in that situation and still exited 0, so "script ran fine" was no
 * evidence that the patch landed. This script instead:
 *
 *   - accepts both compressed and un-compressed spellings of the cap
 *   - asserts an EXACT expected match count for every anchor
 *   - throws on any mismatch, exiting non-zero
 *
 * Verified out: after a successful run, grep for the three PATCHED markers.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const MARKER_REMOTE_HTTP = 'PATCHED 2026-11-02'
export const MARKER_CONTEXT_CAP = 'PATCHED 2026-11-10'
export const MARKER_AGENT_ID = 'PATCHED 2026-11-15'

/** Expected occurrences of each anchor in pristine upstream 0.9.33. */
const EXPECT = {
  urlGuard: 1,
  safeSignature: 1,
  contextCallSite: 2,
  agentIdLiteral: 1,
}

class PatchError extends Error {}

/**
 * Replace `count` occurrences of `from` with `to`, asserting the exact count.
 * A partial or absent match is a hard failure: it means the anchor drifted and
 * the patch would otherwise be silently skipped.
 */
function replaceExactly(text, from, to, expected, label) {
  const found = text.split(from).length - 1
  if (found !== expected) {
    throw new PatchError(
      `${label}: expected ${expected} occurrence(s) of the anchor, found ${found}.\n` +
        `  anchor: ${JSON.stringify(from.slice(0, 120))}\n` +
        `Upstream changed shape. Inspect the new build output before patching;` +
        ` do NOT hand-edit and assume it is fine.`,
    )
  }
  return text.split(from).join(to)
}

/**
 * Patch 1 — accept remote plain-HTTP daemons that carry a bearer secret.
 *
 * Upstream rejects every non-loopback `http://` endpoint even when a secret is
 * configured, which makes a Tailscale / LAN daemon unusable. The clause that
 * enforces this is removed; protocol and embedded-credential checks stay.
 */
export function patchRemoteHttp(text) {
  const anchor =
    'if (!["http:", "https:"].includes(target.protocol) || target.username || target.password || ' +
    'secret && target.protocol !== "https:" && !isLoopbackUrl(url)) throw new Error("Invalid daemon URL");'
  const replacement =
    'if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) ' +
    `throw new Error("Invalid daemon URL"); // ${MARKER_REMOTE_HTTP}: allow remote http + bearer`
  return replaceExactly(text, anchor, replacement, EXPECT.urlGuard, 'patch 1 (remote http)')
}

/**
 * Patch 2 — give injected memory its own size ceiling.
 *
 * `safe()` caps at 8000 chars by default. That number was chosen for captured
 * tool output; the `/context` and `/session/start` payloads are injected
 * memory, and once the daemon's pinned slots together passed 8000 chars the
 * tail was cut mid-sentence with no error and no marker.
 *
 * Adds `contextMaxChars(config)` (default 64000) and passes it at both
 * injection call sites only. The 8000 capture cap is left untouched.
 */
export function patchContextCap(text) {
  const helper = [
    `// ${MARKER_CONTEXT_CAP}: the /context and /session/start bodies are injected memory,`,
    '// not capture output, so the 8e3 capture cap cut them mid-sentence once the',
    '// pinned slots together exceeded it (user_preferences was lost every session).',
    '// Kept a separate, larger ceiling and made it configurable.',
    '// 64e3 because the live DSH project context measures ~34.3e3 chars and grows',
    '// with every session summary; a cap that close would keep clipping silently.',
    'function contextMaxChars(config) {',
    '\tconst raw = config && config.contextMaxChars !== void 0 ? config.contextMaxChars : process.env.AGENTMEMORY_CONTEXT_MAX_CHARS;',
    '\tconst parsed = Number.parseInt(raw, 10);',
    '\treturn Number.isFinite(parsed) && parsed > 0 ? parsed : 64e3;',
    '}',
  ].join('\n')

  // Accept both the compressed (`8e3`) and expanded (`8000`) spellings.
  const safeMatch = text.match(/function safe\(value, limit = (?:8e3|8000)\) \{/)
  if (!safeMatch) {
    throw new PatchError(
      'patch 2 (context cap): could not find the safe() signature.\n' +
        'Expected `function safe(value, limit = 8e3) {` or `... = 8000) {`.',
    )
  }
  if (text.split(safeMatch[0]).length - 1 !== EXPECT.safeSignature) {
    throw new PatchError('patch 2 (context cap): safe() signature appears more than once.')
  }
  // Insert the helper directly above safe(), keeping its own signature intact.
  text = text.replace(safeMatch[0], `${helper}\n${safeMatch[0]}`)

  // Both injection call sites take the new ceiling.
  return replaceExactly(
    text,
    '.body.context);',
    '.body.context, contextMaxChars(config));',
    EXPECT.contextCallSite,
    'patch 2 (call sites)',
  )
}

/** Patch 3 — drop a sourceMappingURL pointing at a map this package omits. */
export function stripSourceMapTrailer(text) {
  return text.replace(/\r?\n\/\/# sourceMappingURL=dsh\.mjs\.map\s*$/, '')
}

/**
 * Patch 4 — make `agentId` configurable instead of a hardcoded `"dsh"`.
 *
 * The daemon treats `agentId` as a hard filter: a row whose id does not match
 * the filter is dropped, not merely ranked lower. Upstream writes `"dsh"`, so a
 * store that already holds rows under another id (the daemon's own `AGENT_ID`,
 * classically `owner`) is split in two the moment this plugin starts writing.
 *
 * For harnesses that intentionally share one memory store, every writer must use
 * the same id — that is why this is a config knob and not a fixed constant.
 * Default stays `"owner"` to match the daemon fallback.
 */
export function patchAgentId(text) {
  const helper = [
    `// ${MARKER_AGENT_ID}: the daemon treats agentId as a hard filter`,
    '// (`record.agentId !== filterAgentId` drops the row outright), so harnesses meant',
    '// to share one memory store must write the SAME id. Upstream hardcodes "dsh",',
    '// which splits one person across two ids the moment historic rows say "owner".',
    '// Default "owner" matches the daemon\'s own AGENT_ID fallback; override it when a',
    '// shared store already contains rows under a different id.',
    'function resolveAgentId(config) {',
    '\tconst pick = (value) => {',
    '\t\tconst trimmed = typeof value === "string" ? value.trim() : "";',
    '\t\treturn trimmed || void 0;',
    '\t};',
    '\tconst raw = pick(config && config.agentId) ?? pick(process.env.AGENTMEMORY_AGENT_ID);',
    '\treturn raw || "owner";',
    '}',
  ].join('\n')

  // Anchor: the hardcoded literal upstream ships inside /session/start.
  const anchor = 'agentId: "dsh"'
  const replaced = replaceExactly(text, anchor, 'agentId: resolveAgentId(config)',
    EXPECT.agentIdLiteral, 'patch 4 (agentId)')

  // Put the helper next to contextMaxChars() so both config readers live together.
  const m = replaced.match(/function safe\(value, limit = (?:8e3|8000)\) \{/)
  if (!m) {
    throw new PatchError(
      'patch 4 (agentId): could not find the safe() signature to anchor the helper.\n' +
        'Expected `function safe(value, limit = 8e3) {` or `... = 8000) {`.',
    )
  }
  if (replaced.split(m[0]).length - 1 !== 1) {
    throw new PatchError('patch 4 (agentId): safe() signature appears more than once.')
  }
  return replaced.replace(m[0], `${helper}\n${m[0]}`)
}

/**
 * Apply all patches to `source` and return the result.
 * Throws `PatchError` if any anchor drifted.
 */
export function applyAll(source) {
  let text = source
  text = patchRemoteHttp(text)
  text = patchContextCap(text)
  text = patchAgentId(text)
  text = stripSourceMapTrailer(text)
  verify(text)
  return text
}

/**
 * Post-conditions. Every one of these must hold or the output is not shippable.
 */
export function verify(text) {
  const checks = [
    [text.includes(MARKER_REMOTE_HTTP), `marker "${MARKER_REMOTE_HTTP}" present`],
    [text.includes(MARKER_CONTEXT_CAP), `marker "${MARKER_CONTEXT_CAP}" present`],
    [text.includes(MARKER_AGENT_ID), `marker "${MARKER_AGENT_ID}" present`],
    [(text.match(/contextMaxChars\(config\)\)/g) || []).length === 2, 'both injection call sites patched'],
    [text.includes('function contextMaxChars(config)'), 'contextMaxChars helper defined'],
    [text.includes('function resolveAgentId(config)'), 'resolveAgentId helper defined'],
    [text.includes('agentId: resolveAgentId(config)'), 'agentId is configurable, not hardcoded'],
    [!text.includes('agentId: "dsh"'), 'hardcoded agentId "dsh" gone'],
    [!text.includes('!isLoopbackUrl(url)) throw'), 'remote-http guard clause removed'],
    [!/sourceMappingURL=dsh\.mjs\.map/.test(text), 'sourceMappingURL trailer removed'],
    [text.includes('export { apply, name }'), 'plugin exports intact'],
  ]
  const failed = checks.filter(([ok]) => !ok).map(([, label]) => label)
  if (failed.length) throw new PatchError(`post-check failed: ${failed.join('; ')}`)
}

export { PatchError }

// --- CLI -------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('apply-patches.mjs')) {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) {
    console.error('usage: node scripts/apply-patches.mjs <upstream-dsh.mjs> <output-path>')
    process.exit(2)
  }
  try {
    const src = readFileSync(resolve(input), 'utf8')
    const out = applyAll(src)
    writeFileSync(resolve(output), out, 'utf8')
    console.log(`[ok] patched ${resolve(input)} -> ${resolve(output)}`)
    console.log(`[ok] ${src.length} -> ${out.length} chars (+${out.length - src.length})`)
    console.log('[next] grep the output for the three PATCHED markers before publishing')
  } catch (error) {
    if (error instanceof PatchError) {
      console.error(`[FAIL] ${error.message}`)
      process.exit(1)
    }
    throw error
  }
}
