// Built-in demonstration workspace. It is generated as a dataset and goes through the same importer as an uploaded workbook.
import tech from '../data/techstack.json'
import { analyse } from './dataset'
import { applyAnalysis } from './apply'
import { componentStatus, qIndex, qLabel, today } from './lifecycle'
import type { State } from './store'
import { sha256 } from './sha256'

const rng = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const IH = ['ID', 'App ID', 'System Name', 'Support Owner', 'Domain Owner', 'Platform Owner', 'Application Type', 'Software Name', 'Software Version', 'Extended (Y/N)', 'Extended Support Type', 'Upgrade Status Comments', 'Upgrade Plan Timelines', 'Reference Colour', 'Business Unit', 'Business Criticality']
const TH = ['Technology Category', 'Technology Name', 'Version', 'Standard EOS Date', 'Extended EOS Date', 'Lifecycle Reference URL', 'Last Verified Date', 'Verification Status', 'Notes']
const OWN = ['Alex Morgan', 'Jordan Lee', 'Maria Costa', 'Chen Wei', 'Priya Nair', 'Sam Rivera', 'Tomas Novak', 'Aisha Khan'], BU = ['Retail Banking', 'Corporate Banking', 'Insurance', 'Operations', 'Finance', 'HR', 'Digital']
const CRIT = ['Mission Critical', 'High', 'Medium', 'Low'], A1 = ['Ledger', 'Portal', 'Claims', 'Onboard', 'Risk', 'Payroll', 'Treasury', 'Billing', 'Trade', 'Identity'], A2 = ['Core', 'Hub', 'Gateway', 'Insights', 'Connect', 'Reporting']

export function buildDemo(): State {
  const r = rng(7), pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)], now = today(), lo = qIndex(now)
  const pools: any = { App: tech.filter(t => t.category === 'Middleware & Other Apps'), Web: tech.filter(t => t.category === 'Web Servers'), DB: tech.filter(t => t.category === 'Databases'), OS: tech.filter(t => t.category === 'OS'),
    Platform: tech.filter(t => t.category === 'Platform Apps' || t.category === 'Cloud Services & Platforms') }
  const choose = (pool: any[]) => { const live = pool.filter(t => t.std && t.std > now); return r() < 0.55 && live.length ? pick(live) : pick(pool) }
  const inv: any[][] = [IH]; let n = 0
  for (let i = 1; i <= 60; i++) {
    const app = `3${String(i).padStart(7, '0')}`, name = `${pick(A1)} ${pick(A2)} ${i}`, bu = pick(BU), crit = pick(CRIT), sup = pick(OWN), dom = pick(OWN), plat = pick(OWN)
    const roles = ['App', 'DB', 'OS']; if (r() < 0.6) roles.push('Web'); if (r() < 0.5) roles.push('Platform')
    for (const role of roles) {
      const t = choose(pools[role]), base = componentStatus(t.std, false, null, now), isCloud = t.category === 'Cloud Services & Platforms'
      const type = role === 'Platform' ? (isCloud ? 'Cloud Platform' : 'Platform') : role === 'DB' && /^Amazon/.test(t.name) ? 'Cloud DB' : role
      let ext = '', et = ''; if (base === 'RED') { ext = r() < 0.65 ? 'Y' : 'N'; et = ext === 'Y' ? (r() < 0.3 ? 'Free' : 'Paid') : '' }
      const status = componentStatus(t.std, ext === 'Y', null, now, 18, et.toUpperCase() || null); let com = '', tl = ''
      if (status === 'RED' || status === 'AMBER') { if (r() < 0.55) { com = 'UPGRADE PLANNED'; tl = qLabel(lo + Math.floor(r() * 8)) } else com = 'UPGRADE PLAN PENDING' }
      inv.push([`ID_${++n}`, app, name, r() < 0.1 ? null : sup, dom, plat, type, t.name, t.version, ext, et, com, tl, null, bu, crit])
    }
  }
  const ts: any[][] = [TH, ...tech.map(t => [t.category, t.name, t.version, t.std, t.ext, t.url, null, t.vstatus, t.notes])]
  const res = analyse([{ name: 'Inventory', rows: inv }, { name: 'TechStack', rows: ts }], now)
  if (!res.ok) throw new Error('Demo data failed validation: ' + res.errors.slice(0, 3).map((e: any) => e.message).join(' | '))
  const a = applyAnalysis(res), appId = (k: number) => a.apps[k].app_id, ts0 = new Date().toISOString().slice(0, 19)
  const audit = [{ id: 1, ts: ts0, actor: 'system', action: 'SEED', entity: 'workspace', entity_id: 'demo', detail: JSON.stringify({ applications: a.apps.length, components: a.comps.length }), prev_hash: '', hash: '' }]
  audit[0].hash = sha256(`|${ts0}|system|SEED|workspace|demo|${audit[0].detail}`)
  const dataOf = (k: number, extra: any = {}) => ({ description: 'Sample request', app_owner: OWN[k], platform_owner: OWN[k + 1], technical_owner: OWN[k + 2], criticality: 'High', capability: 'Payments', rto: '4', rpo: '1', tech_ids: [], ...extra })
  const pastDate = new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10), nextDate = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10)
  const rv = (app_id: string, o: any) => ({ app_id, kind: 'SCHEDULED', review_date: now, architecture: 'PENDING', lifecycle: 'PENDING', security: 'PENDING', infrastructure: 'PENDING', cloud: 'PENDING', technical_debt: null, risks: null, remediation: null, target_date: null, comments: null, decision: 'PENDING', reviewer: 'architect', ...o })
  return { techs: a.techs, apps: a.apps, comps: a.comps, audit, runs: [], targets: {}, source: 'demo', seq: { audit: 1, onb: 2, rev: 3, run: 0 },
    onboarding: [{ id: 1, app_id: '40000001', name: 'Collections Workbench', business_unit: 'Operations', state: 'DRAFT', data: dataOf(0, { tech_ids: ['TS-0003', 'TS-0010'] }) },
      { id: 2, app_id: '40000002', name: 'Partner Reporting Hub', business_unit: 'Finance', state: 'UNDER REVIEW', data: dataOf(2, { tech_ids: ['TS-0002', 'TS-0050'], signoffs: { app_owner: { by: 'appowner', at: ts0, decision: 'APPROVED', comment: 'Looks right' } } }) }],
    reviews: [{ id: 1, ...rv(appId(0), { architecture: 'PASS', lifecycle: 'FAIL', security: 'PASS', infrastructure: 'PASS', cloud: 'PENDING', target_date: pastDate, risks: 'Database past standard support', remediation: 'Upgrade in the next two quarters' }) },
      { id: 2, ...rv(appId(1), { kind: 'ADHOC', architecture: 'PASS', lifecycle: 'PASS', security: 'PASS', infrastructure: 'PASS', cloud: 'PASS', decision: 'APPROVED', target_date: nextDate }) },
      { id: 3, ...rv(appId(2), { architecture: 'PASS', lifecycle: 'PENDING', target_date: nextDate }) }] }
}
