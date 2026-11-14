import { useNavigate, useSearchParams } from 'react-router-dom'
import { download, exportCsv, useApi, useSearch, matches } from '../api'
import { Async, Pill, StatusFilter } from '../ui'

const COLS = ['app_id', 'name', 'business_unit', 'app_owner', 'platform_owner', 'technical_owner', 'criticality', 'status']
export function Applications() {
  const nav = useNavigate(); const [sp, setSp] = useSearchParams(); const q = useSearch(); const r = useApi('/applications')
  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n) }
  const other = (x: any) => (!sp.get('business_unit') || x.business_unit === sp.get('business_unit')) && (!sp.get('criticality') || x.criticality === sp.get('criticality'))
    && (!sp.get('owner') || x.app_owner === sp.get('owner')) && matches(x, q, COLS)
  return <Async r={r}>{(all: any[]) => { const base = all.filter(other), st = sp.get('status') || '', rows = base.filter(x => !st || st.split(',').includes(x.status)); return <div className="card">
    <StatusFilter rows={base} value={st} onChange={(v: string) => setParam('status', v)} />
    <div className="bar">{[...sp.keys()].filter(k => k !== 'status').map(k => <span key={k} className="chipx" onClick={() => setParam(k, '')}>{k.replace('_', ' ')}: {sp.get(k)} ✕</span>)}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}><button onClick={() => exportCsv('applications.csv', rows, COLS)}>Export CSV</button></span></div>
    <table><thead><tr><th>ID</th><th>Name</th><th>Business unit</th><th>Application owner</th><th>Platform owner</th><th>Technical owner</th><th>Criticality</th><th>Risk</th></tr></thead><tbody>
      {rows.map(x => <tr key={x.app_id} className="row" onClick={() => nav('/applications/' + x.app_id)}><td>{x.app_id}</td><td>{x.name}</td><td>{x.business_unit}</td><td>{x.app_owner}</td><td>{x.platform_owner}</td><td>{x.technical_owner}</td><td>{x.criticality}</td><td><Pill s={x.status} /></td></tr>)}</tbody></table>
    <p className="muted">{rows.length ? `${rows.length} of ${all.length} applications` : 'No applications match these filters or this search.'}</p></div> }}</Async>
}
