import { useState } from 'react'
import { api, useApi, useSearch, matches } from '../api'
import { Async } from '../ui'

const ROLES = [['app_owner', 'Application owner'], ['platform_owner', 'Platform owner'], ['technical_owner', 'Technical owner']]

function Row({ a, done }: any) {
  const [f, setF] = useState<any>({ app_owner: a.app_owner || '', platform_owner: a.platform_owner || '', technical_owner: a.technical_owner || '' }); const [err, setErr] = useState('')
  const dirty = ROLES.some(([k]) => f[k] !== (a[k] || ''))
  const save = async () => { try { await api(`/applications/${a.app_id}/owners`, { method: 'PUT', json: f }); setErr(''); done() } catch (e: any) { setErr(e.message) } }
  return <tr><td>{a.app_id}</td><td>{a.name}</td>{ROLES.map(([k]) => <td key={k}><input value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></td>)}
    <td><button className="p" disabled={!dirty} onClick={save}>Save</button> <span className="err">{err}</span></td></tr>
}

export default function Ownership() {
  const q = useSearch(); const o = useApi('/owners'); const apps = useApi('/applications'); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [roles, setRoles] = useState(ROLES.map(r => r[0]))
  const [msg, setMsg] = useState(''); const [onlyGaps, setGaps] = useState(false)
  const reload = () => { o.reload(); apps.reload() }
  const go = async () => {
    if (!confirm(`Move every selected ownership role from ${from} to ${to}?`)) return
    try { const r = await api('/owners/reassign', { method: 'POST', json: { from_owner: from, to_owner: to, roles } }); setMsg(`${r.changed} assignments moved to ${to}.`); setFrom(''); setTo(''); reload() } catch (e: any) { setMsg(e.message) }
  }
  return <>
    <Async r={o}>{(d: any) => <div className="card"><h3>Reassign an owner</h3>
      <div className="bar"><select value={from} onChange={e => setFrom(e.target.value)}><option value="">From owner</option>{d.owners.map((x: any) => <option key={x.name}>{x.name}</option>)}</select>
        <input placeholder="New owner" value={to} onChange={e => setTo(e.target.value)} />
        {ROLES.map(([k, l]) => <label key={k}><input type="checkbox" checked={roles.includes(k)} onChange={e => setRoles(e.target.checked ? [...roles, k] : roles.filter(x => x !== k))} /> {l}</label>)}
        <button className="p" disabled={!from || !to || !roles.length} onClick={go}>Reassign</button></div>
      {msg && <p>{msg}</p>}
      <table><thead><tr><th>Owner</th><th>Application</th><th>Platform</th><th>Technical</th></tr></thead><tbody>
        {d.owners.filter((x: any) => matches(x, q, ['name'])).map((x: any) => <tr key={x.name}><td>{x.name}</td><td>{x.app_owner}</td><td>{x.platform_owner}</td><td>{x.technical_owner}</td></tr>)}</tbody></table>
      <p className="muted">{d.unowned.length ? `${d.unowned.length} applications are missing at least one owner.` : 'Every application has all three owners.'}</p>
      <label><input type="checkbox" checked={onlyGaps} onChange={e => setGaps(e.target.checked)} /> Show only applications with missing owners</label></div>}</Async>
    <Async r={apps}>{(rows: any[]) => <div className="card"><h3>Application owners</h3><table><thead><tr><th>ID</th><th>Name</th><th>Application owner</th><th>Platform owner</th><th>Technical owner</th><th></th></tr></thead><tbody>
      {rows.filter(a => (!onlyGaps || !(a.app_owner && a.platform_owner && a.technical_owner)) && matches(a, q, ['app_id', 'name', 'app_owner', 'platform_owner', 'technical_owner'])).map(a => <Row key={a.app_id + a.app_owner + a.platform_owner + a.technical_owner} a={a} done={reload} />)}</tbody></table></div>}</Async></>
}
