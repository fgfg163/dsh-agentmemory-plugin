/**
 * Bilingual parity check for `CHANGELOG.md`.
 *
 * Shape being enforced: every version block (`# 0.11.1`, `# 0.11.0`, …) contains
 * two subsections, `## English` then `## 简体中文`, each a complete translation of
 * the other. Versions stay together, so a reader compares one release without
 * scrolling to a separate Chinese half.
 *
 * Catches (each confirmed by making it fail):
 *   - a version block missing its English or Chinese subsection
 *   - the two subsections in the wrong order
 *   - a subsection with no content
 *   - the two subsections drifting apart in size (one gutted)
 *   - an unbalanced code fence (which would swallow the rest of the file)
 *   - a stray control / replacement character
 *
 * Does NOT catch: a translation that is present but weak. Comparing wording across
 * languages is unsound; this only proves both sides exist and carry comparable
 * substance.
 */
import { readFileSync } from 'node:fs'

const FILE = new URL('../CHANGELOG.md', import.meta.url)

const problems = []
const ok = []
const check = (label, pass, detail = '') => {
  if (pass) ok.push(label)
  else problems.push(`${label}${detail ? ` — ${detail}` : ''}`)
}

const doc = readFileSync(FILE, 'utf8')

const CJK = /[\u4e00-\u9fff]/
const LATIN = /[A-Za-z]{2,}/

const EN_HEADING = 'English'
const ZH_HEADING = '简体中文'

/**
 * Read the document into version blocks, each split into its `## English` and
 * `## 简体中文` subsections.
 *
 * Fenced code is skipped so a sample cannot supply content a real subsection is
 * missing, and a `#` inside a fence cannot open a bogus version block.
 */
function analyse(text) {
  const lines = text.split('\n')
  const versions = []
  let version = null
  let current = null // 'en' | 'zh' | null (preamble inside a version)
  let inFence = false

  const body = { en: [], zh: [], order: [] }

  const closeVersion = () => {
    if (version) {
      version.en = body.en.join('\n').trim()
      version.zh = body.zh.join('\n').trim()
      version.order = body.order
      versions.push(version)
    }
    version = null
    current = null
    body.en = []
    body.zh = []
    body.order = []
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const v = line.match(/^# (\d+\.\d+\.\d+)$/)
    if (v) {
      closeVersion()
      version = { name: v[1] }
      continue
    }
    if (!version) continue

    const h = line.match(/^## (.+)$/)
    if (h) {
      const title = h[1].trim()
      if (title === EN_HEADING) {
        current = 'en'
        body.order.push('en')
        continue
      }
      if (title === ZH_HEADING) {
        current = 'zh'
        body.order.push('zh')
        continue
      }
      // Any other ## heading is unexpected inside a version block.
      body.order.push(`?${title}`)
      current = null
      continue
    }
    if (current) body[current].push(line)
  }
  closeVersion()

  return { versions, fences: (text.match(/^```/gm) || []).length }
}

const { versions, fences } = analyse(doc)

// --- Global structure ------------------------------------------------------

check('code fences balanced', fences % 2 === 0, `found ${fences}`)

const names = versions.map((v) => v.name)
check('has version blocks', names.length >= 5, `found ${names.length}: ${names.join(', ')}`)

for (const required of ['0.11.1', '0.11.0', '0.10.2', '0.10.1', '0.10.0']) {
  check(`version ${required} present`, names.includes(required))
}

check('versions descend newest-first',
  names.every((v, i) => i === 0 || names[i - 1].localeCompare(v, 'en', { numeric: true }) > 0),
  names.join(' > '))

// --- Per-version subsections ----------------------------------------------

for (const v of versions) {
  const tag = `version ${v.name}`
  const order = v.order
  check(`${tag}: has exactly two subsections`, order.length === 2, `found [${order}]`)
  check(`${tag}: English then 简体中文`, order[0] === 'en' && order[1] === 'zh', `found [${order}]`)
  check(`${tag}: English has content`, (v.en || '').trim().length > 0)
  check(`${tag}: 简体中文 has content`, (v.zh || '').trim().length > 0)

  // English side should be Latin prose, Chinese side should carry CJK. A swapped
  // or copy-pasted block passes a "has content" test but fails these.
  check(`${tag}: English section is in English`, LATIN.test(v.en))
  check(`${tag}: 简体中文 section is in Chinese`, CJK.test(v.zh))

  // One side gutted while the other is intact. Generous band: Chinese is denser.
  const ratio = v.zh.length / v.en.length
  check(`${tag}: subsections comparable in size`, ratio > 0.25 && ratio < 2.5,
    `en=${v.en.length} zh=${v.zh.length} ratio=${ratio.toFixed(2)}`)
}

// --- Hygiene ---------------------------------------------------------------

check('no U+FFFD / control chars',
  !/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(doc))
check('no leftover edit anchors', !doc.includes('EDIT-ANCHOR'))
check('no stale WHATS-NEW reference', !doc.includes('WHATS-NEW'))

console.log('=== OK ===')
for (const o of ok) console.log('  [ok]', o)
if (problems.length) {
  console.log('\n=== PROBLEMS ===')
  for (const p of problems) console.log('  [BAD]', p)
  process.exit(1)
}
console.log(`\nPARITY OK — ${ok.length} checks over ${names.length} versions`)
