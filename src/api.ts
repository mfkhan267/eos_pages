import { createContext, useContext, useMemo, useState, useSyncExternalStore } from 'react'
import { subscribe, getVersion } from './core/store'
import { get, send } from './core/server'
export const COLORS: any = { GREEN: '#16A34A', AMBER: '#F59E0B', RED: '#DC2626', BLUE: '#2563EB', UNKNOWN: '#64748b' }
export const MeCtx = createContext<any>({ roles: [] })
export const WRITE = ['administrator', 'enterprise_architect', 'application_owner', 'platform_owner', 'technical_owner']
export const REVIEWERS = ['administrator', 'enterprise_architect']
export const can = (me: any, roles: string[]) => (me?.roles || []).some((r: string) => roles.includes(r))
const copy = (x: any) => (x instanceof Blob ? x : JSON.parse(JSON.stringify(x ?? null)))
/** Same call shape as the full app's fetch wrapper, answered by the in-browser workspace. */
export async function api(path: string, o: any = {}) {
  try { return copy(await send((o.method || 'GET').toUpperCase(), path, o.json, o.form)) } catch (e: any) { throw new Error(e.message) }
}
export async function download(path: string, name: string) {
  let blob: Blob
  if (path === '/datasets/template') { const r = await fetch('./ATLAS_Dataset_Template.xlsx'); if (!r.ok) throw new Error('The template file could not be loaded.'); blob = await r.blob() } else blob = await send('GET', path, null)
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click()
}
export function useApi(path: string) {
  const v = useSyncExternalStore(subscribe, getVersion); const [tick, setTick] = useState(0)
  const res = useMemo(() => { try { return { data: copy(get(path)), err: '' } } catch (e: any) { return { data: null, err: e.message } } }, [path, v, tick])
  return { ...res, reload: () => setTick(t => t + 1) }
}
export const clean = (o: any) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? null : v]))
export const SearchCtx = createContext('')
export const useSearch = () => useContext(SearchCtx)
const flat = (v: any): string => (v == null ? '' : typeof v === 'object' ? Object.values(v).map(flat).join(' ') : String(v))
/** Every typed word must appear in at least one of the row's visible columns. */
export const matches = (row: any, q: string, keys?: string[]) => {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = (keys || Object.keys(row)).map(k => flat(row[k])).join(' ').toLowerCase()
  return words.every(w => text.includes(w))
}
export function exportCsv(name: string, rows: any[], keys: string[]) {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const a = document.createElement('a'); a.download = name
  a.href = URL.createObjectURL(new Blob([[keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n')], { type: 'text/csv' })); a.click()
}
