import { useContext, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, clean, useApi, MeCtx, can, WRITE } from '../api'
import { Async, Pill, Field } from '../ui'

function ExtForm({ c, done }: { c: any; done: () => void }) {
  const [f, setF] = useState<any>({ start: c.ext_start || '', expiry: c.ext_expiry || '', contract_ref: c.contract_ref || '', approval_owner: c.approval_owner || '',
    approval_date: c.approval_date || '', ext_type: c.ext_type || 'PAID', documentation_url: c.documentation_url || '', comments: c.comments || '' })
  const [err, setErr] = useState('')
  const set = (k: string, type = 'text') => <input type={type} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
  const save = async () => { try { await api(`/mappings/${c.mapping_id}/extended`, { method: 'PUT', json: { extended: true, ...clean(f) } }); done() } catch (e: any) { setErr(e.message) } }
  return <div className="card"><h4>Extended support record: {c.name} {c.version}</h4><div className="form">
    <Field label="Start date">{set('start', 'date')}</Field><Field label="Expiry date *">{set('expiry', 'date')}</Field>
    <Field label="Contract or purchase reference *">{set('contract_ref')}</Field><Field label="Approval owner *">{set('approval_owner')}</Field>
    <Field label="Approval date *">{set('approval_date', 'date')}</Field><Field label="Supporting documentation URL *">{set('documentation_url', 'url')}</Field>
    <Field label="Comments">{set('comments')}</Field>
    <Field label="Extended support type"><select value={f.ext_type} onChange={e => setF({ ...f, ext_type: e.target.value })}><option value="PAID">Paid (shows Blue)</option><option value="FREE">Free (shows Green)</option></select></Field></div>
    {err && <p className="err">{err}</p>}<p><button className="p" onClick={save}>Save entitlement</button> <button onClick={done}>Cancel</button></p></div>
}

export default function ApplicationDetail() {
  const { id } = useParams(); const me = useContext(MeCtx); const r = useApi('/applications/' + id); const [edit, setEdit] = useState<any>(null); const [msg, setMsg] = useState('')
  const writable = can(me, WRITE)
  const off = async (c: any) => { if (!confirm(`Remove extended support from ${c.name} ${c.version}? The record stays in the audit trail.`)) return
    try { await api(`/mappings/${c.mapping_id}/extended`, { method: 'PUT', json: { extended: false } }); r.reload() } catch (e: any) { setMsg(e.message) } }
  return <Async r={r}>{(a: any) => <><div className="card"><Link to="/applications">← Applications</Link>
    <h2>{a.name} <Pill s={a.status} /></h2><p className="muted">{a.business_unit} · owner {a.app_owner} · platform {a.platform_owner} · technical {a.technical_owner}. Risk is the worst component; BLUE never hides RED. Extended support applies to Red components only (standard support has ended). Paid shows Blue, free shows Green.</p>
    {msg && <p className="err">{msg}</p>}
    <table><thead><tr><th>Technology</th><th>Version</th><th>Env</th><th>Standard EOS</th><th>Extended</th><th>Entitlement</th><th>Upgrade plan</th><th>Status</th></tr></thead><tbody>
      {a.components.map((c: any) => <tr key={c.mapping_id}><td>{c.name}</td><td>{c.version}</td><td>{c.environment}</td><td>{c.std_eos || '—'}</td>
        <td><input type="checkbox" disabled={!writable || (!c.extended && c.base_status !== 'RED')} title={c.base_status !== 'RED' ? 'Extended support applies to Red components only' : ''} checked={c.extended} onChange={e => e.target.checked ? setEdit(c) : off(c)} /></td>
        <td className="muted">{c.extended ? <>{c.ext_type === 'FREE' ? 'Free' : 'Paid'}{c.contract_ref ? ` · ${c.contract_ref}` : ''}{c.ext_expiry ? ` · until ${c.ext_expiry}` : ''}<br />{c.approval_owner ? `approved by ${c.approval_owner} on ${c.approval_date}` : 'from dataset'}{c.documentation_url && <> · <a href={c.documentation_url} target="_blank" rel="noreferrer">documents</a></>}
          {writable && <> · <a href="#" onClick={e => { e.preventDefault(); setEdit(c) }}>edit</a></>}</> : '—'}</td>
        <td className="muted">{c.upgrade_comment ? (c.upgrade_comment === 'UPGRADE PLANNED' ? 'Planned' : 'Pending') + (c.upgrade_timeline ? ' · ' + c.upgrade_timeline : '') : '—'}</td><td><Pill s={c.status} /></td></tr>)}</tbody></table></div>
    {edit && <ExtForm c={edit} done={() => { setEdit(null); r.reload() }} />}</>}</Async>
}
