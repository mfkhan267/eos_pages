import { useNavigate, useSearchParams } from 'react-router-dom'
import { exportCsv, useApi, useSearch, matches } from '../api'
import { Async, Pill, StatusFilter } from '../ui'
import { rel } from './Dashboard'

const KEYS = ['app_id', 'app_name', 'tech', 'layer', 'environment', 'std_eos', 'owner', 'comment', 'timeline', 'status']
const LAYERS = ['Applications', 'Web Servers', 'Operating Systems', 'Databases', 'Platforms']
export default function Instances() {
  const nav = useNavigate(); const [sp, setSp] = useSearchParams(); const q = useSearch()
  const server = new URLSearchParams(sp); server.delete('status')  // status is filtered here so the chip counts stay correct
  const r = useApi('/instances?' + server)
  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n) }
  return <Async r={r}>{(all: any[]) => { const base = all.filter(x => matches(x, q, KEYS)), st = sp.get('status') || '', rows = base.filter(x => !st || st.split(',').includes(x.status)); return <div className="card">
    <StatusFilter rows={base} value={st} onChange={(v: string) => setParam('status', v)} />
    <div className="bar">{LAYERS.map(l => <span key={l} className={'chipx' + (sp.get('layer') === l ? ' sel' : '')} onClick={() => setParam('layer', sp.get('layer') === l ? '' : l)}>{l}</span>)}
      {[...sp.keys()].filter(k => !['status', 'layer'].includes(k)).map(k => <span key={k} className="chipx" onClick={() => setParam(k, '')}>{k.replace('_', ' ')}: {sp.get(k)} ✕</span>)}
      <button style={{ marginLeft: 'auto' }} onClick={() => exportCsv('instances.csv', rows, KEYS)}>Export CSV</button></div>
    <table><thead><tr><th>Application</th><th>Technology</th><th>Layer</th><th>Env</th><th>Standard EOS</th><th>When</th><th>Extended</th><th>Primary owner</th><th>Upgrade plan</th><th>Status</th></tr></thead><tbody>
      {rows.map(x => <tr key={x.mapping_id} className="row" onClick={() => nav('/applications/' + x.app_id)}><td>{x.app_id} · {x.app_name}</td><td>{x.tech}</td><td>{x.layer}</td><td>{x.environment}</td>
        <td>{x.std_eos || 'Not declared'}</td><td className={x.days < 0 ? 'err' : ''}>{x.days == null ? '—' : rel(x.days)}</td><td>{x.extended ? (x.ext_type === 'FREE' ? 'Free' : 'Paid') + (x.ext_expiry ? ` until ${x.ext_expiry}` : '') : '—'}</td><td>{x.owner}</td><td>{x.comment ? (x.comment === 'UPGRADE PLANNED' ? 'Planned' : 'Pending') + (x.timeline ? ' · ' + x.timeline : '') : '—'}</td><td><Pill s={x.status} /></td></tr>)}</tbody></table>
    <p className="muted">{rows.length ? `${rows.length} of ${all.length} technology instances` : 'No instances match these filters or this search.'}</p></div> }}</Async>
}
