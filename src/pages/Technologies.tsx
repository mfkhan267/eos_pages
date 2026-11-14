import { useContext, useState } from 'react'
import { api, clean, download, useApi, MeCtx, can, REVIEWERS, useSearch, matches } from '../api'
import { Async, Pill, Field, StatusFilter } from '../ui'

const VER = ['VERIFIED', 'NEEDS VERIFICATION', 'UNKNOWN', 'SAMPLE - NEEDS VERIFICATION']
const EMPTY = { tech_id: '', name: '', category: '', vendor: '', family: '', version: '', release_date: '', std_eos: '', ext_eos: '', source_url: '', last_verified: '', verification: 'NEEDS VERIFICATION' }

function TechForm({ init, cats, done }: any) {
  const edit = !!init.tech_id; const [f, setF] = useState<any>({ ...EMPTY, ...Object.fromEntries(Object.entries(init).map(([k, v]) => [k, v ?? ''])) }); const [err, setErr] = useState('')
  const inp = (k: string, type = 'text', dis = false) => <input type={type} disabled={dis} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
  const save = async () => {
    const { status, ...body } = f
    try { await api(edit ? '/technologies/' + f.tech_id : '/technologies', { method: edit ? 'PUT' : 'POST', json: clean(body) }); done(true) } catch (e: any) { setErr(e.message) }
  }
  return <div className="card"><h3>{edit ? `Edit ${f.tech_id}` : 'Add technology version'}</h3><div className="form">
    <Field label="Technology name *">{inp('name')}</Field>
    <Field label="Category *"><input list="cats" value={f.category} onChange={e => setF({ ...f, category: e.target.value })} /><datalist id="cats">{cats.map((c: string) => <option key={c} value={c} />)}</datalist></Field>
    <Field label="Vendor *">{inp('vendor')}</Field><Field label="Product family">{inp('family')}</Field><Field label="Version *">{inp('version')}</Field>
    <Field label="Release date">{inp('release_date', 'date')}</Field><Field label="Standard end of support">{inp('std_eos', 'date')}</Field><Field label="Extended end of support">{inp('ext_eos', 'date')}</Field>
    <Field label="Lifecycle reference URL">{inp('source_url', 'url')}</Field><Field label="Last verified">{inp('last_verified', 'date')}</Field>
    <Field label="Verification status"><select value={f.verification} onChange={e => setF({ ...f, verification: e.target.value })}>{VER.map(v => <option key={v}>{v}</option>)}</select></Field></div>
    <p className="muted">Leave dates empty when no official date exists. The status then shows UNKNOWN instead of a guess.</p>
    {err && <p className="err">{err}</p>}<p><button className="p" onClick={save}>Save</button> <button onClick={() => done(false)}>Cancel</button></p></div>
}

export default function Technologies() {
  const me = useContext(MeCtx); const r = useApi('/technologies'); const [form, setForm] = useState<any>(null); const [msg, setMsg] = useState(''); const q = useSearch(); const [st, setSt] = useState('')
  const admin = can(me, REVIEWERS)
  const del = async (x: any) => { if (!confirm(`Delete ${x.name} ${x.version}?`)) return; try { await api('/technologies/' + x.tech_id, { method: 'DELETE' }); setMsg(''); r.reload() } catch (e: any) { setMsg(e.message) } }
  return <>
    <div className="bar">{admin && <><button className="p" onClick={() => setForm(EMPTY)}>Add technology</button>
      <button onClick={() => download('/catalogue/export', 'technology_catalogue.csv')}>Export catalogue CSV</button></>}</div>
    {form && <TechForm init={form} cats={[...new Set((r.data || []).map((x: any) => x.category))]} done={(ok: boolean) => { setForm(null); ok && r.reload() }} />}
    {msg && <p className="err">{msg}</p>}
    <Async r={r}>{(all: any[]) => { const base = all.filter(x => matches(x, q, ['tech_id', 'name', 'version', 'category', 'vendor', 'std_eos', 'verification', 'status'])), rows = base.filter(x => !st || x.status === st); return <div className="card"><StatusFilter rows={base} value={st} onChange={setSt} /><table><thead><tr><th>ID</th><th>Technology</th><th>Version</th><th>Category</th><th>Vendor</th><th>Standard EOS</th><th>Source</th><th>Status</th><th></th></tr></thead><tbody>
      {rows.map(x => <tr key={x.tech_id}><td>{x.tech_id}</td><td>{x.name}</td><td>{x.version}</td><td>{x.category}</td><td>{x.vendor}</td><td>{x.std_eos || '—'}</td>
        <td>{x.source_url ? <a href={x.source_url} target="_blank" rel="noreferrer">{x.verification}</a> : x.verification}</td><td><Pill s={x.status} /></td>
        <td>{admin && <><button onClick={() => setForm(x)}>Edit</button> <button onClick={() => del(x)}>Delete</button></>}</td></tr>)}</tbody></table></div> }}</Async></>
}
