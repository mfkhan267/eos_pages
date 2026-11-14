import { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, download, useApi, MeCtx, can, REVIEWERS, COLORS } from '../api'
import { Async } from '../ui'

const SECTIONS: [string, string, string[]][] = [
  ['not_in_techstack', 'Software not found on the TechStack sheet (shown Amber)', ['software', 'version', 'rows']],
  ['not_declared', 'On TechStack but without an end-of-support date (shown Amber)', ['software', 'version', 'rows']],
  ['colour_differences', 'Your reference colour differs from the ATLAS colour', ['row', 'id', 'software', 'theirs', 'atlas']],
  ['no_plan', 'Amber or Red rows with no upgrade comment', ['row', 'id', 'software', 'status']],
  ['free_extended_ended', 'Free extended support has ended according to TechStack', ['row', 'id', 'software', 'extended_eos']]]

function Quality({ q, totals }: any) {
  return <div>{SECTIONS.map(([k, title, cols]) => { const rows = q[k] || [], n = totals ? totals[k] : rows.length
    return <details key={k} style={{ margin: '8px 0' }}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>{title} <span className="cnt">{n}</span></summary>
      {rows.length ? <table><thead><tr>{cols.map(c => <th key={c}>{c.replace('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((r: any, i: number) => <tr key={i}>{cols.map(c => <td key={c}>{String(r[c] ?? '')}</td>)}</tr>)}</tbody></table> : <p className="muted">None.</p>}
      {totals && n > rows.length && <p className="muted">Showing {rows.length} of {n}.</p>}</details> })}</div>
}

function Counts({ s }: any) {
  return <div className="strip" style={{ margin: '10px 0' }}><span className="chipx">Applications <b>{s.applications}</b></span><span className="chipx">Components <b>{s.components}</b></span><span className="chipx">TechStack versions <b>{s.techstack}</b></span>
    {['GREEN', 'AMBER', 'BLUE', 'RED'].map(k => <span key={k} className="chipx"><span style={{ color: COLORS[k] }}>●</span> {k[0] + k.slice(1).toLowerCase()} <b>{s.statuses[k]}</b></span>)}</div>
}

export default function Datasets() {
  const nav = useNavigate(); const me = useContext(MeCtx); const runs = useApi('/datasets/runs'); const dq = useApi('/datasets/quality')
  const [file, setFile] = useState<File | null>(null); const [pv, setPv] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState<any>(null)
  const admin = can(me, REVIEWERS); const [wsMsg, setWsMsg] = useState('')
  const restore = async (e: any) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); try { await api('/workspace/import', { method: 'POST', form: fd }); setWsMsg('Backup restored.') } catch (x: any) { setWsMsg(x.message) } e.target.value = '' }
  const reset = async () => { if (!confirm('Replace everything in this browser with the built-in demonstration data?')) return; await api('/workspace/reset', { method: 'POST' }); setWsMsg('Demonstration data restored.') }
  const body = () => { const f = new FormData(); f.append('file', file as File); return f }
  const preview = async () => {
    if (!file) return setErr('Choose the .xlsx workbook first.')
    setBusy(true); setErr(''); setDone(null)
    try { setPv(await api('/datasets/preview', { method: 'POST', form: body() })) } catch (e: any) { setErr(e.message); setPv(null) }
    setBusy(false)
  }
  const run = async () => {
    if (!confirm('Run Report replaces ALL applications, components and technology records with this workbook. Reviews are kept for applications that are still present. Continue?')) return
    setBusy(true); setErr('')
    try { setDone(await api('/datasets/run', { method: 'POST', form: body() })); setPv(null); runs.reload(); dq.reload() } catch (e: any) { setErr(e.message) }
    setBusy(false)
  }
  if (!admin) return <div className="card">Only administrators and enterprise architects can import datasets.</div>
  return <>
    <div className="card"><h3>Import dataset and run the report</h3><div className="cs">One workbook with an Inventory sheet and a TechStack sheet. Every run replaces all existing data.</div>
      <div className="bar"><button onClick={() => download('/datasets/template', 'ATLAS_Dataset_Template.xlsx')}>⤓ 1. Download the template</button></div>
      <div className="bar"><label>2. Choose the workbook <input type="file" accept=".xlsx" onChange={e => { setFile(e.target.files?.[0] || null); setPv(null); setDone(null); setErr('') }} /></label>
        <button disabled={!file || busy} onClick={preview}>3. Preview and validate</button>
        <button className="p" disabled={!pv || !pv.ok || busy} onClick={run}>4. Run Report</button></div>
      {busy && <p className="muted">Working…</p>}{err && <p className="err">{err}</p>}
      {done && <div className="note"><b>Report complete.</b> {done.summary.applications} applications and {done.summary.components} components loaded. {done.reviews_dropped ? `${done.reviews_dropped} review(s) were removed because their application is no longer in the dataset. ` : ''}
        <div className="bar" style={{ marginTop: 8 }}><button className="p" onClick={() => nav('/executive')}>Open the Executive view</button><button onClick={() => nav('/')}>Open the Dashboard</button></div></div>}
      {pv && <div style={{ marginTop: 12 }}>
        {pv.summary && <Counts s={pv.summary} />}
        {pv.ok ? <p className="note">The workbook is valid{pv.warning_total ? ` with ${pv.warning_total} warning(s)` : ''}. Run Report is enabled.</p>
          : <p className="note bad">{pv.error_total} error(s) must be fixed before the report can run. Nothing is imported until then.</p>}
        {pv.errors.length > 0 && <table><thead><tr><th>Sheet</th><th>Row</th><th>ID</th><th>Error</th></tr></thead><tbody>{pv.errors.map((e: any, i: number) => <tr key={i}><td>{e.sheet}</td><td>{e.row ?? ''}</td><td>{e.id ?? ''}</td><td className="err">{e.message}</td></tr>)}</tbody></table>}
        {pv.error_total > pv.errors.length && <p className="muted">Showing {pv.errors.length} of {pv.error_total} errors.</p>}
        {pv.warnings.length > 0 && <details style={{ margin: '10px 0' }}><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Warnings <span className="cnt">{pv.warning_total}</span></summary>
          <table><tbody>{pv.warnings.map((w: any, i: number) => <tr key={i}><td>{w.sheet}</td><td>{w.row ?? ''}</td><td>{w.id ?? ''}</td><td>{w.message}</td></tr>)}</tbody></table></details>}
        {pv.quality && <><h4>Data quality</h4><Quality q={pv.quality} totals={pv.quality_totals} /></>}</div>}</div>
    <Async r={runs}>{(rows: any[]) => <div className="card"><h3>Run history</h3>
      {rows.length ? <table><thead><tr><th>Run</th><th>When</th><th>By</th><th>File</th><th>Applications</th><th>Components</th><th>Green</th><th>Amber</th><th>Blue</th><th>Red</th></tr></thead><tbody>
        {rows.map(x => <tr key={x.id}><td>#{x.id}</td><td>{String(x.ts).replace('T', ' ').slice(0, 16)}</td><td>{x.actor}</td><td>{x.filename}</td><td>{x.summary.applications}</td><td>{x.summary.components}</td>
          {['GREEN', 'AMBER', 'BLUE', 'RED'].map(s => <td key={s}>{x.summary.statuses[s]}</td>)}</tr>)}</tbody></table> : <p className="muted">No dataset has been run yet. The screens currently show the built-in demonstration data.</p>}</div>}</Async>
    {dq.data && dq.data.run_id && <div className="card"><h3>Data quality of the latest run</h3><div className="cs">Run #{dq.data.run_id} · {dq.data.filename}</div><Quality q={dq.data.quality} /></div>}
    <div className="card"><h3>Workspace</h3><div className="cs">Everything you see is stored in this browser only. Nothing is uploaded anywhere. Export a backup to move your data to another browser or keep a copy.</div>
      <div className="bar"><button onClick={() => download('/workspace/export', 'atlas-workspace.json')}>⤓ Export backup</button><label>Restore a backup <input type="file" accept=".json" onChange={restore} /></label><button onClick={reset}>Reset to demonstration data</button></div>{wsMsg && <p className="muted">{wsMsg}</p>}</div></>
}
