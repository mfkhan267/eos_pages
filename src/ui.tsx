export const Pill = ({ s }: { s: string }) => <span className={'pill ' + String(s).replace(/\s+/g, '_')}>{s ? s[0] + s.slice(1).toLowerCase() : ''}</span>
export function Async({ r, children }: any) {
  if (r.err) return <div className="card err">{r.err}</div>
  if (!r.data) return <div className="card muted">Loading…</div>
  return children(r.data)
}
export const Field = ({ label, children }: any) => <label>{label}{children}</label>

const SF: [string, string][] = [['GREEN', 'Supported'], ['AMBER', 'Expiring'], ['BLUE', 'Extended'], ['RED', 'Unsupported']]
/** Status chips shown above every lifecycle list. Counts reflect the other filters and the search. */
export function StatusFilter({ rows, value, onChange, field = 'status' }: any) {
  const list = (value || '').split(',').filter(Boolean)
  return <div className="sf"><button className={'all' + (!list.length ? ' on' : '')} onClick={() => onChange('')}>All <b>{rows.length}</b></button>
    {SF.map(([s, n]) => <button key={s} className={s + (list.includes(s) ? ' on' : '')} onClick={() => onChange(list.length === 1 && list[0] === s ? '' : s)}>
      <span className="sd" />{s[0] + s.slice(1).toLowerCase()} <span style={{ fontWeight: 500 }}>{n}</span> <b>{rows.filter((r: any) => r[field] === s).length}</b></button>)}</div>
}
