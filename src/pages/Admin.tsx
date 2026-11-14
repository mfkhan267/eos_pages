import { useState } from 'react'
import { api, download, useApi, useSearch, matches } from '../api'
import { Async } from '../ui'

export function Audit() {
  const r = useApi('/audit'); const q = useSearch()
  return <Async r={r}>{(rows: any[]) => <div className="card"><p className="muted">Append-only and hash-chained. The API has no edit or delete.</p><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Detail</th><th>Hash</th></tr></thead><tbody>
    {rows.filter(a => matches(a, q, ['ts', 'actor', 'action', 'entity', 'entity_id', 'detail', 'hash'])).map(a => <tr key={a.id}><td>{a.ts}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.entity} {a.entity_id}</td><td className="muted">{a.detail}</td><td className="muted">{a.hash}</td></tr>)}</tbody></table></div>}</Async>
}

export function ImportPage() {
  const [kind, setKind] = useState('applications'); const [file, setFile] = useState<File | null>(null); const [out, setOut] = useState<any>(null); const [err, setErr] = useState('')
  const run = async (commit: boolean) => {
    if (!file) return setErr('Choose an .xlsx file first.')
    const form = new FormData(); form.append('file', file)
    try { setErr(''); setOut(await api(`/import/${kind}?commit=${commit}`, { method: 'POST', form })) } catch (e: any) { setErr(e.message) }
  }
  return <div className="card"><h3>Import from Excel</h3>
    <div className="bar">{['applications', 'technologies', 'mappings'].map(k => <button key={k} onClick={() => download(`/templates/${k}`, `${k}_template.xlsx`)}>Template: {k}</button>)}</div>
    <div className="bar"><select value={kind} onChange={e => setKind(e.target.value)}><option>applications</option><option>technologies</option><option>mappings</option></select>
      <input type="file" accept=".xlsx" onChange={e => setFile(e.target.files?.[0] || null)} />
      <button onClick={() => run(false)}>Preview</button><button className="p" onClick={() => run(true)}>Import valid rows</button></div>
    {err && <p className="err">{err}</p>}
    {out && <><p>{out.committed ? 'Imported' : 'Preview'}: {out.valid_rows} valid, {out.failed_rows} failed</p>
      <ul>{out.errors.map((e: any) => <li key={e.row} className="err">Row {e.row}: {e.errors.join('; ')}</li>)}</ul></>}</div>
}
