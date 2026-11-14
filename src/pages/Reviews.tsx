import { useContext, useState } from 'react'
import { api, useApi, MeCtx, can, WRITE, REVIEWERS, useSearch, matches } from '../api'
import { Async, Pill, Field } from '../ui'

const CHK = ['architecture', 'lifecycle', 'security', 'infrastructure', 'cloud']
export default function Reviews() {
  const me = useContext(MeCtx); const r = useApi('/reviews'); const apps = useApi('/applications'); const q = useSearch()
  const [open, setOpen] = useState(false); const [f, setF] = useState<any>({ kind: 'SCHEDULED' }); const [err, setErr] = useState('')
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value || null })
  const save = async () => { try { await api('/reviews', { method: 'POST', json: f }); setOpen(false); setErr(''); r.reload() } catch (e: any) { setErr(e.message) } }
  const decide = async (id: number, decision: string) => { try { await api(`/reviews/${id}/decision`, { method: 'POST', json: { decision } }); r.reload() } catch (e: any) { setErr(e.message) } }
  return <>
    {can(me, WRITE) && <div className="bar"><button className="p" onClick={() => setOpen(!open)}>New review</button></div>}
    {open && <div className="card"><div className="form">
      <Field label="Application"><select onChange={set('app_id')}><option value="">Select</option>{(apps.data || []).map((a: any) => <option key={a.app_id} value={a.app_id}>{a.app_id} {a.name}</option>)}</select></Field>
      <Field label="Type"><select onChange={set('kind')}><option>SCHEDULED</option><option>ADHOC</option></select></Field>
      {CHK.map(c => <Field key={c} label={c + ' review'}><select onChange={set(c)}><option>PENDING</option><option>PASS</option><option>FAIL</option></select></Field>)}
      <Field label="Target completion"><input type="date" onChange={set('target_date')} /></Field>
      <Field label="Technical debt"><textarea onChange={set('technical_debt')} /></Field><Field label="Risks and issues"><textarea onChange={set('risks')} /></Field>
      <Field label="Remediation plan"><textarea onChange={set('remediation')} /></Field><Field label="Comments"><textarea onChange={set('comments')} /></Field></div>
      <p><button className="p" onClick={save}>Save review</button></p></div>}
    {err && <p className="err">{err}</p>}
    <Async r={r}>{(rows: any[]) => <div className="card">
      <p className="muted">{rows.length} reviews · {rows.filter(x => x.overdue).length} overdue · average compliance {rows.length ? Math.round(rows.reduce((a, x) => a + x.score, 0) / rows.length) : 0}%</p>
      <table><thead><tr><th>Application</th><th>Type</th><th>Date</th><th>Checks</th><th>Score</th><th>Target</th><th>Decision</th><th></th></tr></thead><tbody>
        {rows.filter(x => matches(x, q, ['app_id', 'app_name', 'kind', 'review_date', 'architecture', 'lifecycle', 'security', 'infrastructure', 'cloud', 'score', 'target_date', 'decision'])).map(x => <tr key={x.id}><td>{x.app_id} {x.app_name}</td><td>{x.kind}</td><td>{x.review_date}</td>
          <td>{CHK.map(c => <span key={c} title={c} style={{ marginRight: 4 }}><Pill s={x[c]} /></span>)}</td><td>{x.score}%</td>
          <td className={x.overdue ? 'err' : ''}>{x.target_date || '—'}{x.overdue && ' (overdue)'}</td><td><Pill s={x.decision} /></td>
          <td>{x.decision === 'PENDING' && can(me, REVIEWERS) && <><button onClick={() => decide(x.id, 'APPROVED')}>Approve</button> <button onClick={() => decide(x.id, 'REJECTED')}>Reject</button></>}</td></tr>)}</tbody></table>
      {!rows.length && <p className="muted">No reviews yet. Start one from an application you own.</p>}</div>}</Async></>
}
