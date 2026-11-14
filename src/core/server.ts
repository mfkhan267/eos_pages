// The "backend" of the static edition: the same endpoints the full app serves, answered from the in-browser workspace.
import { S, commit, addAudit, getRole, USERS, resetWorkspace, exportWorkspace, importWorkspace, replaceState, storageWarning } from './store'
import { componentStatus, rollup, today, addMonths, addDays, daysBetween, qIndex, qStart, qLabel } from './lifecycle'
import { analyseWorkbook } from './dataset'
import { applyAnalysis } from './apply'

export class ApiError extends Error {}
const bad = (m: string) => new ApiError(m)
const WRITE = ['administrator', 'enterprise_architect', 'application_owner', 'platform_owner', 'technical_owner'], REVIEWERS = ['administrator', 'enterprise_architect']
const me = () => ({ name: USERS[getRole()], roles: [getRole()] })
const need = (roles: string[]) => { if (!roles.includes(getRole())) throw bad('Your role cannot do this'); return me().name }
const LAYERS = ['Applications', 'Web Servers', 'Operating Systems', 'Databases', 'Platforms']
const LAYER: any = { Framework: 'Applications', 'Web Server': 'Web Servers', 'Operating System': 'Operating Systems', Database: 'Databases', 'Cloud Platform': 'Platforms', 'Middleware & Other Apps': 'Applications', 'Platform Apps': 'Platforms', Databases: 'Databases', OS: 'Operating Systems', 'Cloud Services & Platforms': 'Platforms' }
const WEB = new Set(['Apache Tomcat', 'Apache HTTP Server', 'NGINX', 'IIS'])
const layerOf = (t: any) => (t.category === 'Web Server' || t.category === 'Web Servers' || WEB.has(t.name) ? 'Web Servers' : LAYER[t.category] || 'Applications')
const tqOf = (t: string | null) => (t ? Number(t.slice(3)) * 4 + Number(t[1]) - 1 : null)
const titleCase = (s: string) => s[0] + s.slice(1).toLowerCase()
const count = (xs: any[], f: (x: any) => any) => { const c: any = {}; xs.forEach(x => { const k = f(x); c[k] = (c[k] || 0) + 1 }); return c }
const top = (c: any, n = 8) => Object.entries(c).sort((a: any, b: any) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }))
const maps = () => ({ T: new Map(S().techs.map(t => [t.tech_id, t])), A: new Map(S().apps.map(a => [a.app_id, a])) })
const compStatus = (c: any, t: any) => componentStatus(t.std_eos, c.extended, c.ext_expiry, today(), 18, c.ext_type)

function instanceRows() {
  const { T, A } = maps(), now = today(), out: any[] = []
  for (const c of S().comps) {
    const a: any = A.get(c.app_id), t: any = T.get(c.tech_id); if (!a || !t) continue
    out.push({ mapping_id: c.id, app_id: a.app_id, app_name: a.name, owner: c.primary_owner || a.app_owner, business_unit: a.business_unit, tech: `${t.name} ${t.version}`, tech_id: t.tech_id, tech_name: t.name,
      layer: c.layer || layerOf(t), ext_type: c.ext_type, comment: c.upgrade_comment, timeline: c.upgrade_timeline, tq: tqOf(c.upgrade_timeline), reported: c.reported_version, environment: c.environment, std_eos: t.std_eos,
      days: t.std_eos ? daysBetween(now, t.std_eos) : null, extended: c.extended, ext_start: c.ext_start, ext_expiry: c.ext_expiry, status: compStatus(c, t), base: componentStatus(t.std_eos) })
  }
  return out
}
function appRows() {
  const st: any = {}; instanceRows().forEach(i => (st[i.app_id] = st[i.app_id] || []).push(i.status))
  return S().apps.map(a => ({ app_id: a.app_id, name: a.name, business_unit: a.business_unit, app_owner: a.app_owner, platform_owner: a.platform_owner, technical_owner: a.technical_owner, criticality: a.criticality,
    status: rollup(st[a.app_id] || []), components: (st[a.app_id] || []).length }))
}
const csv = (rows: any[], keys: string[]) => new Blob([[keys.join(','), ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')], { type: 'text/csv' })

function dashboard() {
  const now = today(), ins = instanceRows(), rows = appRows(), n = ins.length, cnt = count(ins, i => i.status)
  const layers: any = {}; LAYERS.forEach(l => (layers[l] = {})); ins.forEach(i => { layers[i.layer] = layers[i.layer] || {}; layers[i.layer][i.status] = (layers[i.layer][i.status] || 0) + 1 })
  const qi = qIndex(now), cal: any[] = [{ label: 'Past', frm: null, to: addDays(now, -1), layers: {} }]
  for (let k = qi; k < qi + 9; k++) { const s = qStart(k); cal.push({ label: `Q${(k % 4) + 1} '${String(Math.floor(k / 4)).slice(2)}`, frm: s > now ? s : now, to: addDays(qStart(k + 1), -1), layers: {} }) }
  cal.push({ label: 'Later', frm: qStart(qi + 9), to: null, layers: {} })
  for (const i of ins) { const e = i.std_eos; if (!e) continue; const d = qIndex(e) - qi, c = cal[e < now ? 0 : d < 9 ? 1 + d : 10]; c.layers[i.layer] = (c.layers[i.layer] || 0) + 1 }
  cal.forEach(c => (c.total = Object.values(c.layers).reduce((a: any, b: any) => a + b, 0)))
  const g: any = {}; for (const i of ins) { const x = (g[i.tech] = g[i.tech] || { tech: i.tech, layer: i.layer, status: i.base, instances: 0, apps: new Set() }); x.instances++; x.apps.add(i.app_id) }
  const exposure = Object.values(g).map((x: any) => ({ ...x, apps: x.apps.size })).sort((a: any, b: any) => b.instances - a.instances).slice(0, 8)
  const att = ins.filter(i => i.status === 'RED' || i.status === 'AMBER').sort((a, b) => (a.days ?? 1e6) - (b.days ?? 1e6)).slice(0, 6)
  const bu: any = {}; rows.forEach(r => { bu[r.business_unit] = bu[r.business_unit] || {}; bu[r.business_unit][r.status] = (bu[r.business_unit][r.status] || 0) + 1 })
  const cloud: any = {}; ins.filter(i => i.layer === 'Platforms').forEach(i => (cloud[i.tech_name] = cloud[i.tech_name] || new Set()).add(i.app_id))
  const risk = ins.filter(i => i.status === 'RED' || i.status === 'AMBER'), vers = S().techs, pending = ['SUBMITTED', 'UNDER REVIEW', 'NEEDS INFORMATION']
  return { today: now, counts: cnt, layers, calendar: cal, exposure, business_unit_risk: bu,
    attention: att.map(i => ({ tech: i.tech, app_id: i.app_id, app_name: i.app_name, owner: i.owner, days: i.days, status: i.status, layer: i.layer, tech_name: i.tech_name, comment: i.comment, timeline: i.timeline })),
    estate: ins.map(i => ({ layer: i.layer, status: i.status, tech: i.tech, app_id: i.app_id, app_name: i.app_name })),
    by_criticality: top(count(rows, r => r.criticality)), by_owner: top(count(rows, r => r.app_owner)), by_cloud: Object.entries(cloud).map(([label, v]: any) => ({ label, value: v.size })).sort((a, b) => b.value - a.value),
    kpis: { applications: rows.length, instances: n, at_risk: risk.length, with_plan: risk.filter(i => i.comment === 'UPGRADE PLANNED').length, apps_at_risk: rows.filter(r => r.status === 'RED').length,
      within6: ins.filter(i => i.status === 'AMBER' && i.days != null && i.days <= 183).length, ext_within12: ins.filter(i => i.status === 'BLUE' && i.ext_expiry && daysBetween(now, i.ext_expiry) <= 365).length,
      pending_onboarding: S().onboarding.filter(o => pending.includes(o.state)).length, pending_reviews: S().reviews.filter(x => x.decision === 'PENDING').length,
      overdue_reviews: S().reviews.filter(x => x.decision === 'PENDING' && x.target_date && x.target_date < now).length,
      known_eos: n ? Math.round(100 * ins.filter(i => i.std_eos).length / n) : 0, verified: vers.length ? Math.round(100 * vers.filter(v => v.verification === 'VERIFIED').length / vers.length) : 0,
      covered: Math.round(100 * (cnt.BLUE || 0) / Math.max((cnt.BLUE || 0) + (cnt.AMBER || 0) + (cnt.RED || 0), 1)) } }
}

const GROUPS: [string, string[]][] = [['Application & Web Servers', ['Applications', 'Web Servers']], ['Databases', ['Databases']], ['Operating Systems', ['Operating Systems']], ['Platforms', ['Platforms']]]
const supportedAt = (i: any, d: string) => !!((i.std_eos && i.std_eos >= d) || (i.extended && (!i.ext_expiry || i.ext_expiry >= d) && (!i.ext_start || i.ext_start <= d)))
function executive() {
  const now = today(), qi = qIndex(now), ins = instanceRows(), groups: any[] = []
  for (const [name, ls] of GROUPS) {
    const rows = ins.filter(i => ls.includes(i.layer)), counts = count(rows, i => i.status)
    const lst = (st: string) => { const g: any = {}; rows.filter(i => i.status === st).forEach(i => (g[i.tech] = g[i.tech] || new Set()).add(i.app_name)); return Object.entries(g).map(([tech, a]: any) => ({ tech, apps: [...a].sort() })).sort((a, b) => b.apps.length - a.apps.length) }
    const known = rows.filter(i => i.std_eos), pct = (f: (i: any) => boolean) => (known.length ? Math.round(100 * known.filter(f).length / known.length) : null), series: any[] = []
    for (let k = qi - 1; k < qi + 8; k++) {
      const d = addDays(qStart(k + 1), -1)
      series.push({ label: `Q${(k % 4) + 1} '${String(Math.floor(k / 4)).slice(2)}`, actual: k <= qi, cur: k === qi, pct: pct(i => supportedAt(i, d)),
        planned: k >= qi ? pct(i => supportedAt(i, d) || (i.comment === 'UPGRADE PLANNED' && i.tq != null && i.tq <= k)) : null })
    }
    const cur = series.find(p => p.cur)?.pct ?? null, target = S().targets[name] ?? 95, red = lst('RED'); let note: string, ok: any
    if (cur == null) { note = 'No end-of-support dates are known for this group yet.'; ok = null }
    else if (cur >= target) { note = `On track: ${cur}% supported against a ${target}% target.`; ok = true }
    else { note = `Behind target by ${target - cur}%: ${counts.RED || 0} instances are past end of support and ${counts.AMBER || 0} more expire within 18 months.`; ok = false; if (red.length) note += ` Largest gap: ${red[0].tech} on ${red[0].apps.length} applications.` }
    groups.push({ name, layers: ls, counts, amber: lst('AMBER'), red, series, target, note, on_track: ok, total: rows.length })
  }
  return { today: now, quarter: `Q${Math.floor((Number(now.slice(5, 7)) - 1) / 3) + 1} ${now.slice(0, 4)}`, groups }
}

function appDetail(id: string) {
  const a = S().apps.find(x => x.app_id === id); if (!a) throw bad('Application not found')
  const { T } = maps(), row = appRows().find(r => r.app_id === id)!
  const comps = S().comps.filter(c => c.app_id === id).map(c => { const t = T.get(c.tech_id)!
    return { mapping_id: c.id, tech_id: t.tech_id, name: t.name, version: t.version, category: t.category, environment: c.environment, std_eos: t.std_eos, extended: c.extended, ext_expiry: c.ext_expiry, ext_type: c.ext_type, upgrade_comment: c.upgrade_comment,
      upgrade_timeline: c.upgrade_timeline, primary_owner: c.primary_owner, reported_version: c.reported_version, layer: c.layer || layerOf(t), base_status: componentStatus(t.std_eos), ext_start: c.ext_start, contract_ref: c.contract_ref,
      approval_owner: c.approval_owner, approval_date: c.approval_date, documentation_url: c.documentation_url, comments: c.comments, verification: t.verification, source_url: t.source_url, status: compStatus(c, t) } })
  return { ...row, description: a.description, components: comps }
}
const techRow = (t: any) => ({ tech_id: t.tech_id, name: t.name, version: t.version, category: t.category, vendor: t.vendor, std_eos: t.std_eos, status: componentStatus(t.std_eos), verification: t.verification, source_url: t.source_url,
  family: t.family, release_date: t.release_date, ext_eos: t.ext_eos, last_verified: t.last_verified })

// ---- technology catalogue ----
const VERS = ['VERIFIED', 'NEEDS VERIFICATION', 'UNKNOWN', 'SAMPLE - NEEDS VERIFICATION']
function checkTech(b: any) {
  if (!b.name || !b.category || !b.vendor || !b.version) throw bad('Name, category, vendor and version are required')
  if (!VERS.includes(b.verification || 'NEEDS VERIFICATION')) throw bad('Unknown verification status')
  if (b.verification === 'VERIFIED' && !(b.source_url && b.last_verified)) throw bad('A VERIFIED record needs a source URL and a last-verified date')
  if (b.release_date && b.std_eos && b.std_eos < b.release_date) throw bad('Standard end of support is before the release date')
  if (b.std_eos && b.ext_eos && b.ext_eos < b.std_eos) throw bad('Extended end of support is before standard end of support')
}
function saveTech(t: any, b: any, actor: string, action: string) {
  const dup = S().techs.find(x => x !== t && x.name === b.name && x.version === b.version); if (dup) throw bad(`${b.name} ${b.version} already exists as ${dup.tech_id}`)
  Object.assign(t, { name: b.name, category: b.category, vendor: b.vendor, family: b.family || null, version: b.version, release_date: b.release_date || null, std_eos: b.std_eos || null, ext_eos: b.ext_eos || null,
    source_url: b.source_url || null, last_verified: b.last_verified || null, verification: b.verification || 'NEEDS VERIFICATION' })
  S().techs.forEach(x => { if (x.name === b.name) { x.category = b.category; x.vendor = b.vendor; x.family = b.family || null } })
  addAudit(actor, action, 'technology', t.tech_id, b); commit()
}

// ---- onboarding ----
const FLOW: any = { DRAFT: ['SUBMITTED'], SUBMITTED: ['UNDER REVIEW'], 'UNDER REVIEW': ['APPROVED', 'REJECTED', 'NEEDS INFORMATION'], 'NEEDS INFORMATION': ['SUBMITTED'], APPROVED: ['ACTIVE'] }
const SIGN: any = { app_owner: ['application_owner', 'administrator'], platform_owner: ['platform_owner', 'administrator'], architecture: ['enterprise_architect', 'administrator'], final: ['administrator', 'enterprise_architect'] }
const REQ = ['app_owner', 'architecture', 'final']
function assess(ids: string[]) {
  const comps = S().techs.filter(t => ids.includes(t.tech_id)).map(t => ({ tech_id: t.tech_id, name: t.name, version: t.version, std_eos: t.std_eos, status: componentStatus(t.std_eos) }))
  return { components: comps, status: rollup(comps.map(c => c.status)), unsupported: comps.filter(c => c.status === 'RED').map(c => `${c.name} ${c.version}`), approaching: comps.filter(c => c.status === 'AMBER').map(c => `${c.name} ${c.version}`) }
}
const onbOut = (o: any) => ({ id: o.id, app_id: o.app_id, name: o.name, business_unit: o.business_unit, state: o.state, data: o.data || {}, next: (FLOW[o.state] || []).filter((n: string) => n !== 'APPROVED'), sign_roles: SIGN, required: REQ, assessment: assess((o.data || {}).tech_ids || []) })
const findOnb = (id: number) => { const o = S().onboarding.find(x => x.id === id); if (!o) throw bad('Request not found'); return o }

// ---- reviews ----
const CHECKS = ['architecture', 'lifecycle', 'security', 'infrastructure', 'cloud']
const revOut = (x: any) => { const a: any = S().apps.find(y => y.app_id === x.app_id) || {}; return { ...x, app_name: a.name || '', score: Math.round(100 * CHECKS.filter(c => x[c] === 'PASS').length / CHECKS.length), overdue: !!(x.decision === 'PENDING' && x.target_date && x.target_date < today()) } }

// ---- datasets ----
function publicResult(res: any, cap = 300) {
  const q: any = {}, totals: any = {}; for (const k in res.quality || {}) { q[k] = res.quality[k].slice(0, 100); totals[k] = res.quality[k].length }
  return { ok: res.ok, errors: res.errors.slice(0, cap), error_total: res.errors.length, warnings: res.warnings.slice(0, cap), warning_total: res.warnings.length, summary: res.summary || null, quality: q, quality_totals: totals }
}
async function readUpload(form: FormData) { const f = form?.get('file') as File | null; if (!f) throw bad('Choose a file first.'); if (f.size > 20 * 1024 * 1024) throw bad('The file is larger than 20 MB.'); return analyseWorkbook(await f.arrayBuffer()) }

type Q = URLSearchParams
const GET: [RegExp, (m: RegExpMatchArray, q: Q) => any][] = [
  [/^\/me$/, () => ({ ...me(), storage_warning: storageWarning, source: S().source })],
  [/^\/dashboard$/, () => dashboard()], [/^\/executive$/, () => executive()],
  [/^\/applications$/, () => appRows()], [/^\/applications\/([^/]+)$/, m => appDetail(decodeURIComponent(m[1]))],
  [/^\/instances$/, (m, q) => { const st = q.get('status')?.split(','), ly = q.get('layer')?.split(','), tech = q.get('tech')?.toLowerCase(), from = q.get('eos_from'), to = q.get('eos_to')
    return instanceRows().filter(i => (!st || st.includes(i.status)) && (!ly || ly.includes(i.layer)) && (!tech || i.tech.toLowerCase().includes(tech)) && (!q.get('app_id') || i.app_id === q.get('app_id')) && (!from || (i.std_eos && i.std_eos >= from)) && (!to || (i.std_eos && i.std_eos <= to))) }],
  [/^\/technologies$/, () => S().techs.map(techRow)],
  [/^\/onboarding$/, () => [...S().onboarding].reverse().map(onbOut)], [/^\/onboarding\/(\d+)$/, m => onbOut(findOnb(Number(m[1])))], [/^\/assess$/, (m, q) => assess(q.getAll('tech_ids'))],
  [/^\/reviews$/, (m, q) => [...S().reviews].reverse().map(revOut).filter(r => !q.get('app_id') || r.app_id === q.get('app_id'))],
  [/^\/owners$/, () => { const o: any = {}; S().apps.forEach(a => { for (const role of ['app_owner', 'platform_owner', 'technical_owner']) { const n = a[role]; if (n) { o[n] = o[n] || { name: n, app_owner: 0, platform_owner: 0, technical_owner: 0 }; o[n][role]++ } } })
    return { owners: Object.values(o).sort((a: any, b: any) => a.name.localeCompare(b.name)), unowned: S().apps.filter(a => !(a.app_owner && a.platform_owner && a.technical_owner)).map(a => a.app_id) } }],
  [/^\/audit$/, () => { need([...REVIEWERS, 'read_only_executive']); return [...S().audit].reverse().slice(0, 200).map(a => ({ id: a.id, ts: a.ts, actor: a.actor, action: a.action, entity: a.entity, entity_id: a.entity_id, detail: a.detail, hash: a.hash.slice(0, 12) })) }],
  [/^\/datasets\/runs$/, () => [...S().runs].reverse().slice(0, 50).map(r => ({ id: r.id, ts: r.ts, actor: r.actor, filename: r.filename, summary: r.summary }))],
  [/^\/datasets\/quality$/, () => { const r = S().runs[S().runs.length - 1]; return r ? { run_id: r.id, ts: r.ts, filename: r.filename, summary: r.summary, quality: r.quality } : {} }],
  [/^\/export\/applications$/, () => csv(appRows(), ['app_id', 'name', 'business_unit', 'app_owner', 'platform_owner', 'technical_owner', 'criticality', 'status'])],
  [/^\/catalogue\/export$/, () => csv(S().techs.map(techRow), ['tech_id', 'name', 'version', 'category', 'vendor', 'std_eos', 'ext_eos', 'source_url', 'last_verified', 'verification'])],
  [/^\/workspace\/export$/, () => new Blob([exportWorkspace()], { type: 'application/json' })],
]

export function get(path: string): any {
  const u = new URL(path, 'http://x')
  for (const [re, h] of GET) { const m = u.pathname.match(re); if (m) return h(m, u.searchParams) }
  throw bad('Not found: ' + u.pathname)
}

export async function send(method: string, path: string, body: any, form?: FormData): Promise<any> {
  if (method === 'GET') return get(path)
  const u = new URL(path, 'http://x'), p = u.pathname, b = body || {}; let m: RegExpMatchArray | null
  // technologies
  if (method === 'POST' && p === '/technologies') { const a = need(REVIEWERS); checkTech(b); let id = b.tech_id; if (!id) { const mx = Math.max(0, ...S().techs.map(t => Number((/^T(\d+)$/.exec(t.tech_id) || [])[1] || 0))); id = `T${String(mx + 1).padStart(4, '0')}` }
    if (S().techs.some(t => t.tech_id === id)) throw bad(`${id} already exists`); const t: any = { tech_id: id }; saveTech(t, b, a, 'CREATE'); S().techs.push(t); commit(); return { tech_id: id } }
  if ((m = p.match(/^\/technologies\/([^/]+)$/))) { const a = need(REVIEWERS), t = S().techs.find(x => x.tech_id === decodeURIComponent(m![1])); if (!t) throw bad('Technology not found')
    if (method === 'PUT') { checkTech(b); saveTech(t, b, a, 'UPDATE'); return { tech_id: t.tech_id } }
    if (method === 'DELETE') { const n = S().comps.filter(c => c.tech_id === t.tech_id).length; if (n) throw bad(`Used by ${n} application deployments. Remove those mappings first.`); S().techs.splice(S().techs.indexOf(t), 1); addAudit(a, 'DELETE', 'technology', t.tech_id); commit(); return { deleted: t.tech_id } } }
  // extended support on one component
  if (method === 'PUT' && (m = p.match(/^\/mappings\/(\d+)\/extended$/))) { const a = need(WRITE), c = S().comps.find(x => x.id === Number(m![1])); if (!c) throw bad('Not found'); const t: any = S().techs.find(x => x.tech_id === c.tech_id)
    if (b.extended) {
      const miss = ['expiry', 'contract_ref', 'approval_owner', 'approval_date', 'documentation_url'].filter(k => !b[k]); if (miss.length) throw bad('Extended support needs: ' + miss.join(', '))
      if (b.start && b.start > b.expiry) throw bad('Start date must be before the expiry date')
      if (componentStatus(t.std_eos) !== 'RED') throw bad('Extended support applies to Red components only, those whose standard support has ended.')
      Object.assign(c, { extended: true, ext_start: b.start || null, ext_expiry: b.expiry, contract_ref: b.contract_ref, ext_type: String(b.ext_type || 'PAID').toUpperCase(), approval_owner: b.approval_owner, approval_date: b.approval_date, documentation_url: b.documentation_url, comments: b.comments || null })
    } else c.extended = false
    addAudit(a, 'EXTENDED_SUPPORT', 'mapping', c.id, b); commit(); return { status: compStatus(c, t) } }
  // onboarding
  if (method === 'POST' && p === '/onboarding') { const a = need(WRITE)
    if (S().apps.some(x => x.app_id === b.app_id) || S().onboarding.some(x => x.app_id === b.app_id)) throw bad(`${b.app_id} already exists`)
    const o = { id: ++S().seq.onb, app_id: b.app_id, name: b.name, business_unit: b.business_unit, state: 'DRAFT', data: b.data || {} }; S().onboarding.push(o); addAudit(a, 'CREATE', 'onboarding', o.id, { app_id: b.app_id }); commit(); return onbOut(o) }
  if ((m = p.match(/^\/onboarding\/(\d+)$/)) && method === 'PUT') { const a = need(WRITE), o = findOnb(Number(m[1])); if (!['DRAFT', 'NEEDS INFORMATION'].includes(o.state)) throw bad('Only drafts or requests needing information can be edited')
    Object.assign(o, { name: b.name, business_unit: b.business_unit, data: b.data || {} }); addAudit(a, 'UPDATE', 'onboarding', o.id); commit(); return onbOut(o) }
  if ((m = p.match(/^\/onboarding\/(\d+)\/transition$/))) { const a = need(WRITE), o = findOnb(Number(m[1]))
    if (!(FLOW[o.state] || []).includes(b.to)) throw bad(`Cannot move from ${o.state} to ${b.to}`)
    if (b.to !== 'SUBMITTED' && !REVIEWERS.includes(getRole())) throw bad('Only administrators and enterprise architects can review')
    if (b.to === 'APPROVED') throw bad('Approval happens through the sign-offs')
    if (b.to === 'SUBMITTED') { const d = { ...o.data }; delete d.signoffs; o.data = d }
    if (b.to === 'ACTIVE') { const d = o.data || {}
      S().apps.push({ app_id: o.app_id, name: o.name, business_unit: o.business_unit, criticality: d.criticality || 'Not specified', app_owner: d.app_owner, platform_owner: d.platform_owner, technical_owner: d.technical_owner, description: d.description || null })
      for (const tid of d.tech_ids || []) { const t = S().techs.find(x => x.tech_id === tid); if (t) S().comps.push({ id: Math.max(0, ...S().comps.map(c => c.id)) + 1, app_id: o.app_id, tech_id: tid, environment: 'PROD', extended: false, ext_type: null, ext_start: null, ext_expiry: null, contract_ref: null,
        approval_owner: null, approval_date: null, documentation_url: null, comments: null, component_id: null, layer: layerOf(t), role: null, support_owner: null, domain_owner: null, platform_owner: null, primary_owner: d.app_owner || null, upgrade_comment: null, upgrade_timeline: null, ref_colour: null, reported_version: t.version }) } }
    addAudit(a, 'TRANSITION', 'onboarding', o.id, { from: o.state, to: b.to, comment: b.comment }); o.state = b.to; commit(); return onbOut(o) }
  if ((m = p.match(/^\/onboarding\/(\d+)\/signoff$/))) { const a = need(WRITE), o = findOnb(Number(m[1]))
    if (!SIGN[b.stage] || !['APPROVED', 'REJECTED', 'NEEDS INFORMATION'].includes(b.decision)) throw bad('Unknown stage or decision')
    if (!SIGN[b.stage].includes(getRole())) throw bad(`The ${b.stage} sign-off needs one of: ${SIGN[b.stage].join(', ')}`)
    if (o.state !== 'UNDER REVIEW') throw bad('Sign-offs are only possible while the request is under review')
    const d = { ...o.data }, so = { ...(d.signoffs || {}) }
    if (b.stage in so) throw bad('This stage is already signed')
    if (Object.values(so).some((x: any) => x.by === a)) throw bad('Separation of duties: you already signed another stage')
    if (b.stage === 'final' && b.decision === 'APPROVED' && REQ.filter(k => k !== 'final').some(k => so[k]?.decision !== 'APPROVED')) throw bad('Final approval needs the application owner and architecture sign-offs first')
    so[b.stage] = { by: a, at: new Date().toISOString().slice(0, 19), decision: b.decision, comment: b.comment || null }; d.signoffs = so; o.data = d; const old = o.state
    if (b.decision === 'REJECTED') o.state = 'REJECTED'; else if (b.decision === 'NEEDS INFORMATION') o.state = 'NEEDS INFORMATION'; else if (REQ.every(k => so[k]?.decision === 'APPROVED')) o.state = 'APPROVED'
    addAudit(a, 'SIGNOFF', 'onboarding', o.id, { stage: b.stage, decision: b.decision, comment: b.comment, state: `${old} -> ${o.state}` }); commit(); return onbOut(o) }
  // reviews
  if (method === 'POST' && p === '/reviews') { const a = need(WRITE); if (!S().apps.some(x => x.app_id === b.app_id)) throw bad(`Unknown application ${b.app_id}`)
    const x = { id: ++S().seq.rev, kind: 'SCHEDULED', review_date: today(), architecture: 'PENDING', lifecycle: 'PENDING', security: 'PENDING', infrastructure: 'PENDING', cloud: 'PENDING', technical_debt: null, risks: null, remediation: null, target_date: null, comments: null, ...b, decision: 'PENDING', reviewer: a }
    S().reviews.push(x); addAudit(a, 'CREATE', 'review', x.id, { app_id: b.app_id }); commit(); return revOut(x) }
  if ((m = p.match(/^\/reviews\/(\d+)\/decision$/))) { const a = need(REVIEWERS); if (!['APPROVED', 'REJECTED'].includes(b.decision)) throw bad('Decision must be APPROVED or REJECTED')
    const x = S().reviews.find(y => y.id === Number(m![1])); if (!x) throw bad('Not found'); addAudit(a, 'DECISION', 'review', x.id, { decision: b.decision, comment: b.comment }); x.decision = b.decision; commit(); return revOut(x) }
  // ownership
  if (method === 'PUT' && (m = p.match(/^\/applications\/([^/]+)\/owners$/))) { const a = need(REVIEWERS), x = S().apps.find(y => y.app_id === decodeURIComponent(m![1])); if (!x) throw bad('Not found')
    const before = { app_owner: x.app_owner, platform_owner: x.platform_owner, technical_owner: x.technical_owner }; for (const k of Object.keys(before)) x[k] = String(b[k] || '').trim() || null
    addAudit(a, 'OWNERSHIP', 'application', x.app_id, { before, after: b }); commit(); return { ok: true } }
  if (method === 'POST' && p === '/owners/reassign') { const a = need(REVIEWERS), roles = b.roles || ['app_owner', 'platform_owner', 'technical_owner']
    if (!String(b.to_owner || '').trim() || b.from_owner === b.to_owner || !roles.every((r: string) => ['app_owner', 'platform_owner', 'technical_owner'].includes(r))) throw bad('Choose a different new owner and valid roles')
    let n = 0; S().apps.forEach(x => roles.forEach((r: string) => { if (x[r] === b.from_owner) { x[r] = String(b.to_owner).trim(); n++ } })); addAudit(a, 'OWNERSHIP_REASSIGN', 'owner', b.from_owner, { ...b, changed: n }); commit(); return { changed: n } }
  // executive targets
  if (method === 'PUT' && (m = p.match(/^\/targets\/(.+)$/))) { const a = need(REVIEWERS), name = decodeURIComponent(m[1]), pct = Number(b.pct)
    if (!GROUPS.some(g => g[0] === name) || !Number.isInteger(pct) || pct < 0 || pct > 100) throw bad('Unknown group, or target outside 0-100'); S().targets[name] = pct; addAudit(a, 'TARGET', 'target', name, { pct }); commit(); return { ok: true } }
  // datasets
  if (method === 'POST' && p === '/datasets/preview') { need(REVIEWERS); return publicResult(await readUpload(form!)) }
  if (method === 'POST' && p === '/datasets/run') { const a = need(REVIEWERS), res = await readUpload(form!)
    if (!res.ok) throw bad(`The dataset has ${res.errors.length} error(s). Nothing was changed. Fix them and preview again.`)
    const x = applyAnalysis(res), st = S(), kept = st.reviews.filter(r => x.apps.some((ap: any) => ap.app_id === r.app_id)), dropped = st.reviews.length - kept.length, run = { id: ++st.seq.run, ts: new Date().toISOString().slice(0, 19), actor: a, filename: (form!.get('file') as File).name, summary: res.summary, quality: Object.fromEntries(Object.entries(res.quality).map(([k, v]: any) => [k, v.slice(0, 100)])) }
    replaceState({ ...st, techs: x.techs, apps: x.apps, comps: x.comps, reviews: kept, runs: [...st.runs, run], source: 'dataset' }); addAudit(a, 'DATASET_RUN', 'dataset', run.id, { file: run.filename, applications: res.summary.applications, components: res.summary.components, techstack: res.summary.techstack, reviews_dropped: dropped }); commit()
    return { ...publicResult(res), run_id: run.id, reviews_kept: kept.length, reviews_dropped: dropped, placeholders: x.placeholders } }
  // workspace backup
  if (method === 'POST' && p === '/workspace/reset') { need(REVIEWERS); resetWorkspace(); return { ok: true } }
  if (method === 'POST' && p === '/workspace/import') { need(REVIEWERS); const f = form?.get('file') as File | null; if (!f) throw bad('Choose a backup file first.'); try { importWorkspace(await f.text()) } catch (e: any) { throw bad(e.message) } return { ok: true } }
  throw bad('Not found: ' + method + ' ' + p)
}
