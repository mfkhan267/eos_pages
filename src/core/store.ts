import { sha256 } from './sha256'
import { buildDemo } from './demo'
export const ROLES = ['administrator', 'enterprise_architect', 'application_owner', 'platform_owner', 'technical_owner', 'read_only_executive']
export const USERS: any = { administrator: 'admin', enterprise_architect: 'architect', application_owner: 'appowner', platform_owner: 'platformowner', technical_owner: 'techowner', read_only_executive: 'executive' }
const KEY = 'atlas2.state.v1', RKEY = 'atlas2.role'
export type State = { techs: any[]; apps: any[]; comps: any[]; onboarding: any[]; reviews: any[]; audit: any[]; runs: any[]; targets: Record<string, number>; seq: any; source: 'demo' | 'dataset' }
let state: State, version = 0, role = 'administrator'; const subs = new Set<() => void>(); export let storageWarning = ''
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const getVersion = () => version
export const S = () => state
export const getRole = () => role
const notify = () => { version++; subs.forEach(f => f()) }
export function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageWarning = '' } catch { storageWarning = 'Browser storage is full or blocked, so changes will be lost when you close this tab. Export a backup from the Datasets page.' }
  notify()
}
export function setRole(r: string) { if (!ROLES.includes(r)) return; role = r; try { localStorage.setItem(RKEY, r) } catch {} notify() }
const valid = (s: any) => s && Array.isArray(s.techs) && Array.isArray(s.apps) && Array.isArray(s.comps) && Array.isArray(s.audit) && s.seq
export function addAudit(actor: string, action: string, entity: string, id: any, detail: any = null) {
  const a = state.audit, prev = a.length ? a[a.length - 1].hash : '', ts = new Date().toISOString().slice(0, 19), d = JSON.stringify(detail)
  const e = { id: ++state.seq.audit, ts, actor, action, entity, entity_id: String(id), detail: d, prev_hash: prev, hash: sha256(`${prev}|${ts}|${actor}|${action}|${entity}|${id}|${d}`) }
  a.push(e); if (a.length > 5000) a.splice(0, a.length - 5000)
}
export function init() {
  try { const r = localStorage.getItem(RKEY); if (r && ROLES.includes(r)) role = r } catch {}
  try { const raw = localStorage.getItem(KEY); const s = raw && JSON.parse(raw); if (valid(s)) { state = s; return } } catch {}
  state = buildDemo(); commit()
}
export function resetWorkspace() { state = buildDemo(); commit() }
export const exportWorkspace = () => JSON.stringify({ format: 'atlas-workspace', version: 1, exported: new Date().toISOString(), state })
export function importWorkspace(text: string) {
  let j: any; try { j = JSON.parse(text) } catch { throw new Error('The file is not valid JSON.') }
  if (j?.format !== 'atlas-workspace' || !valid(j.state)) throw new Error('The file is not an ATLAS workspace backup.')
  state = j.state; commit()
}
export const replaceState = (s: State) => { state = s; commit() }
