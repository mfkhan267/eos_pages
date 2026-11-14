// Dataset import core: parse, validate, match to TechStack and classify. A TypeScript port of the tested Python importer.
import { componentStatus, qIndex, qLabel, today as todayNow } from './lifecycle'
import { readXlsx, Sheet } from './xlsx'

const ROLES: any = { app: ['App', 'Applications'], web: ['Web', 'Web Servers'], db: ['DB', 'Databases'], 'cloud db': ['Cloud DB', 'Databases'], os: ['OS', 'Operating Systems'], platform: ['Platform', 'Platforms'],
  pf_web: ['PF_Web', 'Platforms'], 'pf web': ['PF_Web', 'Platforms'], 'cloud platform': ['Cloud Platform', 'Platforms'], 'cloud service': ['Cloud Service', 'Platforms'], 'cloud services': ['Cloud Service', 'Platforms'] }
const CATEGORIES: any = { 'web servers': 'Web Servers', 'middleware & other apps': 'Applications', 'middleware and other apps': 'Applications', 'platform apps': 'Platforms', databases: 'Databases', os: 'Operating Systems',
  'operating systems': 'Operating Systems', 'cloud services & platforms': 'Platforms', 'cloud services and platforms': 'Platforms' }
const INV: any = { id: 'id', 'app id': 'app_id', 'system name': 'system', 'support owner': 'support', 'domain owner': 'domain', 'platform owner': 'platform', 'application type': 'type', 'physical application component role': 'type',
  'software name': 'name', 'component name': 'name', 'software version': 'version', 'component version': 'version', 'extended (y/n)': 'extended', extended: 'extended', 'extended support type': 'ext_type',
  'upgrade status comments': 'comment', 'component upgrade plan (comments)': 'comment', 'upgrade plan timelines': 'timeline', 'component upgrade plan (timelines)': 'timeline', 'reference colour': 'ref', 'final component colour': 'ref',
  'business unit': 'bu', 'business criticality': 'crit', criticality: 'crit' }
const TS: any = { 'technology category': 'category', 'technology name': 'name', version: 'version', 'standard eos date': 'std', 'extended eos date': 'ext', 'lifecycle reference url': 'url', 'last verified date': 'verified', 'verification status': 'vstatus', notes: 'notes' }
const INV_REQ: any = { id: 'ID', app_id: 'App ID', system: 'System Name', type: 'Application Type', name: 'Software Name', version: 'Software Version' }
const TS_REQ: any = { category: 'Technology Category', name: 'Technology Name', version: 'Version' }
const PLANS = ['UPGRADE PLANNED', 'UPGRADE PLAN PENDING']
const NOT_DECLARED = new Set(['', 'not declared', 'nd', 'na', 'n/a', 'none', 'tbd', '-', 'unknown'])
export const STATUSES = ['GREEN', 'AMBER', 'BLUE', 'RED']

const norm = (v: any) => (v == null ? '' : String(v).trim().replace(/\s+/g, ' ').toLowerCase())
export function cell(v: any): string | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isInteger(v)) return String(v)
  const s = String(v).trim(); return s || null
}
const valid = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d }
const iso = (y: number, m: number, d: number): [string | null, boolean] => valid(y, m, d) ? [`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, true] : [null, false]
/** Returns [iso date or null, ok]. Blank, NA and Not Declared are valid and mean no date. */
export function parseDate(v: any): [string | null, boolean] {
  if (typeof v === 'number' && v > 20000 && v < 80000) return [new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10), true]
  const s = cell(v); if (s == null || NOT_DECLARED.has(norm(s))) return [null, true]
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return iso(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s); if (m) return iso(+m[3], +m[2], +m[1])
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/.exec(s); if (m) return iso(2000 + +m[3], +m[2], +m[1])
  m = /^(\d{2})(\d{2})(\d{4})$/.exec(s); if (m) return iso(+m[3], +m[2], +m[1])
  return [null, false]
}
function parseQuarter(s: string | null): number | null {
  const m = /^\s*Q([1-4])\s*[-/ ]?\s*(\d{4})\s*$/i.exec(s || '') || /^\s*(\d{4})\s*[-/ ]?\s*Q([1-4])\s*$/i.exec(s || '')
  if (!m) return null; const [a, b] = [m[1], m[2]]; const [q, y] = a.length === 1 ? [+a, +b] : [+b, +a]; return y * 4 + q - 1
}

function readSheet(sheets: Sheet[], name: string, mapping: any, required: any): [any[] | null, any[]] {
  const title = name[0].toUpperCase() + name.slice(1)
  const ws = sheets.find(w => norm(w.name) === name)
  if (!ws) return [null, [{ sheet: title, row: null, id: null, message: `Sheet '${title}' is missing.` }]]
  const rows = ws.rows; if (!rows.length) return [[], [{ sheet: ws.name, row: null, id: null, message: 'The sheet is empty.' }]]
  const cols: any = {}
  rows[0].forEach((h, i) => { const k = mapping[norm(h).replace(/\s*ddmmyyyy\s*$/, '')]; if (k && !(k in cols)) cols[k] = i })
  const miss = Object.keys(required).filter(k => !(k in cols)).map(k => required[k])
  if (miss.length) return [[], [{ sheet: ws.name, row: 1, id: null, message: 'Missing column(s): ' + miss.join(', ') }]]
  const out: any[] = []
  rows.slice(1).forEach((r, i) => {
    if (!r || r.every(v => v == null || String(v).trim() === '')) return
    const o: any = { _row: i + 2 }; for (const k in cols) o[k] = r[cols[k]] ?? null; out.push(o)
  })
  return [out, []]
}

export async function analyseWorkbook(buf: ArrayBuffer, today = todayNow()) {
  let sheets: Sheet[]
  try { sheets = await readXlsx(buf) } catch { return { ok: false, errors: [{ sheet: null, row: null, id: null, message: 'The file is not a valid .xlsx workbook.' }], warnings: [] } as any }
  return analyse(sheets, today)
}

export function analyse(sheets: Sheet[], today = todayNow()): any {
  const err: any[] = [], warn: any[] = []
  const E = (sh: string, row: any, id: any, message: string) => err.push({ sheet: sh, row, id, message })
  const W = (sh: string, row: any, id: any, message: string) => warn.push({ sheet: sh, row, id, message })
  const [invRows, e1] = readSheet(sheets, 'inventory', INV, INV_REQ), [tsRows, e2] = readSheet(sheets, 'techstack', TS, TS_REQ); err.push(...e1, ...e2)
  // ---- TechStack ----
  const techs: any[] = [], seen: any = {}
  for (const r of tsRows || []) {
    const n = r._row, name = cell(r.name), ver = cell(r.version), cat = CATEGORIES[norm(r.category)]
    if (!name || !ver || !cat) { E('TechStack', n, null, 'Technology Category, Technology Name and Version are required' + (cat || !cell(r.category) ? '' : `; category '${cell(r.category)}' is not recognised`) + '.'); continue }
    const [std, ok1] = parseDate(r.std), [ext, ok2] = parseDate(r.ext)
    if (!ok1) E('TechStack', n, null, `Standard EOS Date '${cell(r.std)}' is not a valid date (use DD/MM/YYYY).`)
    if (!ok2) E('TechStack', n, null, `Extended EOS Date '${cell(r.ext)}' is not a valid date (use DD/MM/YYYY).`)
    if (!(ok1 && ok2)) continue
    const k = norm(name) + '|' + norm(ver)
    if (k in seen) { E('TechStack', n, null, `${name} ${ver} is already listed on row ${seen[k]}.`); continue }
    seen[k] = n
    if (std && ext && ext < std) W('TechStack', n, null, `${name} ${ver}: Extended EOS is before Standard EOS.`)
    const vs = (cell(r.vstatus) || (std ? 'NEEDS VERIFICATION' : 'UNKNOWN')).toUpperCase()
    techs.push({ row: n, category: cat, category_label: cell(r.category), name, version: ver, std, ext, url: cell(r.url), verified: parseDate(r.verified)[0], vstatus: vs, notes: cell(r.notes) })
  }
  const byName: any = {}; for (const t of techs) (byName[norm(t.name)] = byName[norm(t.name)] || []).push(t)
  const match = (name: string, ver: string): [any, string | null] => {
    const c = byName[norm(name)] || [], v = norm(ver)
    for (const t of c) if (norm(t.version) === v) return [t, 'exact']
    for (const t of c) { const tv = norm(t.version); if ((tv.endsWith('.x') && v.startsWith(tv.slice(0, -1))) || (v.endsWith('.x') && tv.startsWith(v.slice(0, -1)))) return [t, 'wildcard'] }
    return [null, null]
  }
  // ---- Inventory ----
  const comps: any[] = [], ids: any = {}, lo = qIndex(today), hi = lo + 7
  for (const r of invRows || []) {
    const n = r._row, i0 = cell(r.id), rowErr = err.length
    for (const k in INV_REQ) if (!cell(r[k])) E('Inventory', n, i0, `${INV_REQ[k]} is required.`)
    const role = ROLES[norm(r.type)]
    if (cell(r.type) && !role) E('Inventory', n, i0, `Application Type '${cell(r.type)}' is not recognised. Use App, Web, DB, Cloud DB, OS, Platform, PF_Web, Cloud Platform or Cloud Service.`)
    const sup = cell(r.support), dom = cell(r.domain), plat = cell(r.platform)
    if (!(sup || plat)) E('Inventory', n, i0, 'The row has neither a Support Owner nor a Platform Owner, so it has no primary owner.')
    if (i0 && i0 in ids) E('Inventory', n, i0, `ID '${i0}' is already used on row ${ids[i0]}.`); else if (i0) ids[i0] = n
    const ex = norm(r.extended); const exMap: any = { y: true, yes: true, true: true, 1: true, n: false, no: false, false: false, 0: false, '': null }
    let ext: any = ex in exMap ? exMap[ex] : 'bad'
    if (ext === 'bad') { E('Inventory', n, i0, `Extended (Y/N) must be Y or N, not '${cell(r.extended)}'.`); ext = null }
    let et: string | null = norm(r.ext_type).toUpperCase() || null
    if (et && et !== 'PAID' && et !== 'FREE') { E('Inventory', n, i0, `Extended Support Type must be Paid or Free, not '${cell(r.ext_type)}'.`); et = null }
    const com = (cell(r.comment) || '').toUpperCase() || null
    if (com && !PLANS.includes(com)) W('Inventory', n, i0, `Upgrade Status Comments '${com}' is not one of ${PLANS.join(', ')}; it is kept as text.`)
    let tq: number | null = null; const tl = cell(r.timeline)
    if (tl) {
      tq = parseQuarter(tl)
      if (tq == null) E('Inventory', n, i0, `Upgrade Plan Timelines '${tl}' is not a quarter. Use a form like ${qLabel(lo + 1)}.`)
      else if (tq < lo || tq > hi) E('Inventory', n, i0, `Upgrade Plan Timelines '${tl}' must be one of the next 8 quarters (${qLabel(lo)} to ${qLabel(hi)}).`)
    }
    if (com === 'UPGRADE PLANNED' && !tl) E('Inventory', n, i0, 'UPGRADE PLANNED needs an Upgrade Plan Timelines quarter.')
    let ref: string | null = cell(r.ref); ref = ref ? ref[0].toUpperCase() + ref.slice(1).toLowerCase() : null
    if (ref && !['Green', 'Amber', 'Red', 'Blue'].includes(ref)) { W('Inventory', n, i0, `Reference Colour '${ref}' is not Green, Amber, Red or Blue and is ignored.`); ref = null }
    if (err.length > rowErr || !role) continue
    const name = cell(r.name)!, ver = cell(r.version)!, [t, kind] = match(name, ver), eos = t ? t.std : null, base = componentStatus(eos, false, null, today)
    if (base === 'RED' && ext == null) E('Inventory', n, i0, `Extended (Y/N) is mandatory for Red components (${name} ${ver}: standard support ended ${eos!.slice(8)}/${eos!.slice(5, 7)}/${eos!.slice(0, 4)}).`)
    if (ext && base !== 'RED') W('Inventory', n, i0, `Extended = Y on ${name} ${ver} is ignored because the component is ${base[0] + base.slice(1).toLowerCase()}; extended support applies to Red components only.`)
    const eff = !!(ext && base === 'RED'), typ = eff ? (et || 'PAID') : null
    if (et && !eff && ext != null) W('Inventory', n, i0, 'Extended Support Type is ignored because the row is not an extended Red component.')
    comps.push({ row: n, id: i0, app_id: cell(r.app_id), system: cell(r.system), support: sup, domain: dom, platform: plat, primary: sup || plat, type: role[0], layer: role[1], name, version: ver, matched: t, match: kind, eos,
      extended: eff, ext_type: typ, comment: com, timeline: tq != null ? qLabel(tq) : null, tq, ref, base, status: componentStatus(eos, eff, null, today, 18, typ), bu: cell(r.bu), crit: cell(r.crit) })
  }
  // ---- applications ----
  const byApp: any = {}; for (const c of comps) (byApp[c.app_id] = byApp[c.app_id] || []).push(c)
  const mode = (xs: string[]) => { const m: any = {}; xs.forEach(x => (m[x] = (m[x] || 0) + 1)); return Object.keys(m).sort((a, b) => m[b] - m[a])[0] }
  const apps: any[] = []
  for (const aid in byApp) {
    const cs = byApp[aid], names = [...new Set(cs.map((c: any) => c.system))] as string[]
    if (names.length > 1) W('Inventory', cs[0].row, cs[0].id, `App ID ${aid} has several System Names (${names.join(', ')}); '${cs[0].system}' is used.`)
    const pool = cs.filter((c: any) => c.type === 'App'), use = pool.length ? pool : cs, own = mode(use.map((c: any) => c.primary)), row = use.find((c: any) => c.primary === own)
    apps.push({ app_id: aid, name: cs[0].system, owner: own, platform: row.platform, domain: row.domain, components: cs.length, bu: cs.find((c: any) => c.bu)?.bu || null, crit: cs.find((c: any) => c.crit)?.crit || null })
  }
  // ---- data quality ----
  const grp = (f: (c: any) => boolean) => { const g: any = {}; comps.filter(f).forEach(c => { const k = c.name + '\u0000' + c.version; g[k] = (g[k] || 0) + 1 }); return Object.keys(g).sort((a, b) => g[b] - g[a]).map(k => ({ software: k.split('\u0000')[0], version: k.split('\u0000')[1], rows: g[k] })) }
  const title = (s: string) => s[0] + s.slice(1).toLowerCase()
  const quality = {
    not_in_techstack: grp(c => !c.matched), not_declared: grp(c => c.matched && !c.eos),
    colour_differences: comps.filter(c => c.ref && c.ref.toUpperCase() !== c.status).map(c => ({ row: c.row, id: c.id, software: `${c.name} ${c.version}`, atlas: title(c.status), theirs: c.ref })),
    no_plan: comps.filter(c => ['RED', 'AMBER'].includes(c.status) && !c.comment).map(c => ({ row: c.row, id: c.id, software: `${c.name} ${c.version}`, status: title(c.status) })),
    free_extended_ended: comps.filter(c => c.ext_type === 'FREE' && c.matched && c.matched.ext && c.matched.ext < today).map(c => ({ row: c.row, id: c.id, software: `${c.name} ${c.version}`, extended_eos: c.matched.ext })) }
  const lay: any = {}; comps.forEach(c => { (lay[c.layer] = lay[c.layer] || {})[c.status] = (lay[c.layer][c.status] || 0) + 1 })
  const st: any = {}; comps.forEach(c => (st[c.status] = (st[c.status] || 0) + 1))
  const summary = { applications: apps.length, components: comps.length, techstack: techs.length, statuses: Object.fromEntries(STATUSES.map(s => [s, st[s] || 0])), by_layer: lay,
    with_plan: comps.filter(c => ['RED', 'AMBER'].includes(c.status) && c.comment === 'UPGRADE PLANNED').length, at_risk: comps.filter(c => ['RED', 'AMBER'].includes(c.status)).length,
    report_date: today, error_count: err.length, warning_count: warn.length }
  return { ok: !err.length, errors: err, warnings: warn, summary, quality, techstack: techs, components: comps, applications: apps }
}
