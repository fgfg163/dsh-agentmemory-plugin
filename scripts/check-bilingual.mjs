/**
 * What this catches, and what it does not.
 *
 * Catches (each confirmed by making it fail):
 *   - a section present in one half and missing in the other
 *   - a table row dropped from one half
 *   - a config key named in one half only
 *   - an unbalanced code fence (which would swallow the rest of the half)
 *
 * Does NOT catch: prose that is present but much shorter than its counterpart.
 * Comparing length across languages is unsound — Chinese is denser, so a
 * legitimate translation can be a third the character count, and every
 * threshold tried (ratio-based, absolute) flagged correct text as a stub. The
 * check therefore only fires when one side has NO prose. Treat a too-brief
 * translation as a review concern, not something this file can prove.
 */
import { readFileSync } from 'node:fs'

const FILE = new URL('../WHATS-NEW-0.11.md', import.meta.url)
const doc = readFileSync(FILE, 'utf8')

const SPLIT = '\n# 简体中文\n'
const idx = doc.indexOf(SPLIT)
if (idx < 0) {
  console.error('[FAIL] no "# 简体中文" separator found')
  process.exit(1)
}
const en = doc.slice(0, idx)
const zh = doc.slice(idx + SPLIT.length)

const problems = []
const ok = []
const check = (label, pass, detail = '') => {
  if (pass) ok.push(label)
  else problems.push(`${label}${detail ? ` — ${detail}` : ''}`)
}

/**
 * Split a half into top-level sections and measure each one.
 *
 * Deliberately ignores heading TEXT (it is translated, so it never matches) and
 * measures what a reader consumes: fenced code blocks, table body rows, bullets.
 */
function measure(half) {
  const lines = half.split('\n')
  const sections = []
  let current = { title: '', code: 0, rows: 0, bullets: 0, subs: 0, prose: 0 }
  let inFence = false

  const push = () => {
    if (current.title || current.code || current.rows || current.bullets || current.prose) sections.push(current)
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence
      if (!inFence) current.code += 1
      continue
    }
    if (inFence) continue

    if (/^## (.+)$/.test(line)) {
      push()
      current = { title: line.replace(/^## /, '').trim(), code: 0, rows: 0, bullets: 0, subs: 0, prose: 0 }
      continue
    }
    if (/^### /.test(line)) {
      current.subs += 1
      continue
    }
    // A table body row: starts and ends with a pipe, and is not the separator.
    if (/^\|.*\|$/.test(line.trim()) && !/^\|[\s:|-]+\|$/.test(line.trim())) {
      current.rows += 1
      continue
    }
    if (/^\s*(\d+\.|[-*])\s+/.test(line)) {
      current.bullets += 1
      continue
    }
    // Anything else that is not blank counts as prose.
    if (line.trim().length > 0) current.prose += line.trim().length
  }
  push()
  return sections
}

const enSec = measure(en)
const zhSec = measure(zh)

check('same number of top-level sections', enSec.length === zhSec.length,
  `en=${enSec.length} zh=${zhSec.length}\n  en: ${JSON.stringify(enSec.map((s) => s.title))}\n  zh: ${JSON.stringify(zhSec.map((s) => s.title))}`)

// Pair by position. A dropped section shifts everything after it, so the first
// mismatch points straight at the gap.
const n = Math.min(enSec.length, zhSec.length)
for (let i = 0; i < n; i += 1) {
  const a = enSec[i]
  const b = zhSec[i]
  const tag = `section ${i + 1} (en "${a.title}" / zh "${b.title}")`
  check(`${tag}: same code blocks`, a.code === b.code, `en=${a.code} zh=${b.code}`)
  check(`${tag}: same table rows`, a.rows === b.rows, `en=${a.rows} zh=${b.rows}`)
  check(`${tag}: same subsections`, a.subs === b.subs, `en=${a.subs} zh=${b.subs}`)
  // Bullets vary a little with wording; allow a small drift but not a lost list.
  check(`${tag}: comparable bullet count`, Math.abs(a.bullets - b.bullets) <= 2, `en=${a.bullets} zh=${b.bullets}`)
  // A section can keep its heading and its structure yet lose its prose.
  // Absolute prose length cannot be compared across languages (Chinese is
  // denser by design), and earlier attempts at a character threshold flagged
  // legitimate Chinese translations as stubs. So this only catches the shape
  // that is unambiguously broken: one side has prose, the other has literally
  // none at that section (heading + table only, or heading + nothing).
  check(`${tag}: prose present on both sides or neither`,
    (a.prose > 0) === (b.prose > 0),
    `en=${a.prose} zh=${b.prose}`)
}

// Fences must be balanced per half, or everything after is swallowed.
for (const [name, half] of [['English', en], ['Chinese', zh]]) {
  const fences = (half.match(/^```/gm) || []).length
  check(`${name} half has balanced code fences`, fences % 2 === 0, `found ${fences}`)
}

/** Keys written inside the `recall:` YAML block of a half, in order. */
function recallKeys(half) {
  const m = half.match(/recall:\n((?:[ \t]+.+\n)+)/)
  if (!m) return []
  return m[1].split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(':')[0])
}
const enKeys = recallKeys(en)
const zhKeys = recallKeys(zh)
// This document is a change summary and shows no config block, so both sides
// being empty is correct. What must never happen is a block on ONE side only.
check('neither half shows a lone recall: block',
  enKeys.length === zhKeys.length,
  `en=${JSON.stringify(enKeys)} zh=${JSON.stringify(zhKeys)}`)

// Keys the summary NAMES must be ones the code really reads.
const recallSrc = readFileSync(new URL('../lib/recall.js', import.meta.url), 'utf8')
const namedKeys = ['enabled', 'limit', 'maxChars', 'fetchTimeoutMs', 'queryMaxChars',
  'minConfidence', 'includeLessons', 'tailRatio', 'minQueryChars']
for (const key of namedKeys) {
  const inEn = en.includes(key)
  const inZh = zh.includes(key)
  check(`key "${key}" named in both halves`, inEn === inZh, `en=${inEn} zh=${inZh}`)
  if (inEn) {
    check(`key "${key}" is really read by recall.js`,
      new RegExp(`config\\.${key}\\b`).test(recallSrc),
      'the summary names a key the code ignores')
  }
}

// Cross-links must resolve to anchors that exist.
check('English links to Chinese anchor', en.includes('[简体中文](#简体中文)'))
check('Chinese links back to English', zh.includes('[English](#whats-new-in-0110)'))

// Shared facts: every changed thing must be described in both halves.
const shared = ['recall', 'dsh-prompt-slot', 'targetLayer', 'contextMaxChars',
  'agentmemory', 'lib/recall.js', 'minQueryChars']
for (const s of shared) {
  check(`"${s}" appears in English`, en.includes(s))
  check(`"${s}" appears in Chinese`, zh.includes(s))
}

// Hygiene.
for (const [name, half] of [['English', en], ['Chinese', zh]]) {
  check(`${name} half has no U+FFFD/control chars`, !/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(half))
  check(`${name} half has no leftover anchors`, !half.includes('EDIT-ANCHOR'))
}

// Chinese carries the same content in fewer characters by nature, so the band is
// deliberately wide; it only catches one half being gutted.
const ratio = zh.length / en.length
check('halves comparable in size (0.4-1.8x)', ratio > 0.4 && ratio < 1.8,
  `en=${en.length} zh=${zh.length} ratio=${ratio.toFixed(2)}`)

console.log('=== OK ===')
for (const o of ok) console.log('  [ok]', o)
if (problems.length) {
  console.log('\n=== PROBLEMS ===')
  for (const p of problems) console.log('  [BAD]', p)
  process.exit(1)
}
console.log(`\nPARITY OK — ${ok.length} checks, English ${en.length} chars / Chinese ${zh.length} chars`)
