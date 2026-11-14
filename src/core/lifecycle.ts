// Lifecycle engine. Dates are ISO strings (YYYY-MM-DD) so they compare correctly as text.
export const RANK: any = { UNKNOWN: 0, GREEN: 1, BLUE: 2, AMBER: 3, RED: 4 }
let override: string | null = null
export const setToday = (d: string | null) => { override = d }
const pad = (n: number) => String(n).padStart(2, '0')
export const today = () => { if (override) return override; const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export const addMonths = (iso: string, m: number) => {
  const [y, mo, d] = iso.split('-').map(Number); const t = mo - 1 + m, yy = y + Math.floor(t / 12), mm = ((t % 12) + 12) % 12
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate(); return `${yy}-${pad(mm + 1)}-${pad(Math.min(d, last))}`
}
export const addDays = (iso: string, n: number) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5)
export const qIndex = (iso: string) => Number(iso.slice(0, 4)) * 4 + Math.floor((Number(iso.slice(5, 7)) - 1) / 3)
export const qStart = (k: number) => `${Math.floor(k / 4)}-${pad((k % 4) * 3 + 1)}-01`
export const qLabel = (k: number) => `Q${(k % 4) + 1} ${Math.floor(k / 4)}`

/** GREEN: more than 18 months left. AMBER: within 18 months, or no end-of-support date (Not Declared).
 *  RED: standard support has ended. Extended support applies to RED only: paid shows BLUE, free shows GREEN. */
export function componentStatus(eos: string | null | undefined, ext = false, extExpiry: string | null = null, now = today(), amberMonths = 18, extType: string | null = null) {
  if (!eos) return 'AMBER'
  const base = eos < now ? 'RED' : eos <= addMonths(now, amberMonths) ? 'AMBER' : 'GREEN'
  if (base === 'RED' && ext && (!extExpiry || extExpiry >= now)) return (extType || '').toUpperCase() === 'FREE' ? 'GREEN' : 'BLUE'
  return base
}
export const rollup = (st: string[]) => st.reduce((m, s) => (RANK[s] > RANK[m] ? s : m), 'UNKNOWN')
