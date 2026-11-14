import { useContext, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, useApi, MeCtx, can, WRITE, REVIEWERS, useSearch, matches } from '../api'
import { Async, Pill, Field } from '../ui'

const STEPS = ['DRAFT', 'SUBMITTED', 'UNDER REVIEW', 'APPROVED', 'ACTIVE']
export const Progress = ({ state }: { state: string }) => {
  const i = STEPS.indexOf(state)
  return <div className="steps">{STEPS.map((s, n) => <div key={s} className={n < i ? 'done' : n === i ? 'now' : ''}>{s}</div>)}{i < 0 && <div className="now">{state}</div>}</div>
}

export function OnboardingList() {
  const nav = useNavigate(); const me = useContext(MeCtx); const r = useApi('/onboarding'); const q = useSearch()
  return <>{can(me, WRITE) && <div className="bar"><Link to="/onboarding/new"><button className="p">New onboarding request</button></Link></div>}
    <Async r={r}>{(rows: any[]) => <div className="card"><table><thead><tr><th>App ID</th><th>Name</th><th>Business unit</th><th>Lifecycle risk</th><th>State</th></tr></thead><tbody>
      {rows.filter(o => matches({ ...o, risk: o.assessment.status }, q, ['app_id', 'name', 'business_unit', 'risk', 'state'])).map(o => <tr key={o.id} className="row" onClick={() => nav('/onboarding/' + o.id)}><td>{o.app_id}</td><td>{o.name}</td><td>{o.business_unit}</td><td><Pill s={o.assessment.status} /></td><td><Pill s={o.state} /></td></tr>)}</tbody></table>
      {!rows.length && <p className="muted">No onboarding requests yet. Create one to register a new application.</p>}</div>}</Async></>
}

type FD = { k: string; label: string; req?: boolean; opts?: string[]; area?: boolean }
const WSTEPS = ['Registration', 'Business assessment', 'Technical discovery', 'Architecture', 'Lifecycle assessment', 'Review and submit']
const FIELDS: FD[][] = [
  [{ k: 'app_id', label: 'Application ID', req: true }, { k: 'name', label: 'Application name', req: true }, { k: 'business_unit', label: 'Business unit', req: true },
   { k: 'app_owner', label: 'Application owner', req: true }, { k: 'platform_owner', label: 'Platform owner', req: true }, { k: 'technical_owner', label: 'Technical owner', req: true }, { k: 'description', label: 'Description', area: true }],
  [{ k: 'criticality', label: 'Business criticality', req: true, opts: ['Mission Critical', 'High', 'Medium', 'Low'] }, { k: 'capability', label: 'Business capability', req: true },
   { k: 'app_type', label: 'Application classification', opts: ['Custom', 'COTS', 'SaaS', 'Legacy'] }, { k: 'business_impact', label: 'Business impact', area: true }],
  ['framework:Application framework', 'middleware:Middleware', 'os_notes:Operating system', 'database_notes:Database', 'cloud_notes:Cloud platform', 'container:Container platform',
   'messaging:Messaging', 'storage:Storage', 'integration:Integration components', 'security_components:Security components'].map(s => ({ k: s.split(':')[0], label: s.split(':')[1] })),
  [{ k: 'hosting', label: 'Hosting architecture', area: true }, { k: 'network', label: 'Network architecture', area: true }, { k: 'availability', label: 'Availability architecture', area: true },
   { k: 'dr', label: 'Disaster recovery', area: true }, { k: 'rto', label: 'RTO (hours)', req: true }, { k: 'rpo', label: 'RPO (hours)', req: true }],
]

export function Wizard() {
  const { id } = useParams(); const nav = useNavigate(); const techs = useApi('/technologies')
  const [oid, setOid] = useState<string | undefined>(id); const [step, setStep] = useState(0); const [f, setF] = useState<any>({ tech_ids: [] }); const [err, setErr] = useState(''); const [as, setAs] = useState<any>(null)
  useEffect(() => { if (id) api('/onboarding/' + id).then(o => setF({ tech_ids: [], ...o.data, app_id: o.app_id, name: o.name, business_unit: o.business_unit })).catch(e => setErr(e.message)) }, [id])
  useEffect(() => { if (step >= 4) api('/assess?' + (f.tech_ids || []).map((t: string) => 'tech_ids=' + t).join('&')).then(setAs).catch(() => {}) }, [step])
  const save = async () => {
    const { app_id, name, business_unit, ...data } = f
    if (oid) { await api('/onboarding/' + oid, { method: 'PUT', json: { app_id, name, business_unit, data } }); return oid }
    const o = await api('/onboarding', { method: 'POST', json: { app_id, name, business_unit, data } }); setOid(String(o.id)); return String(o.id)
  }
  const next = async () => {
    const missing = (FIELDS[step] || []).filter(x => x.req && !String(f[x.k] || '').trim()).map(x => x.label)
    if (missing.length) return setErr('Required: ' + missing.join(', '))
    try { await save(); setErr(''); setStep(step + 1) } catch (e: any) { setErr(e.message) }
  }
  const submit = async () => { try { const i = await save(); await api(`/onboarding/${i}/transition`, { method: 'POST', json: { to: 'SUBMITTED' } }); nav('/onboarding/' + i) } catch (e: any) { setErr(e.message) } }
  const groups: any = {}; (techs.data || []).forEach((t: any) => (groups[t.category] = groups[t.category] || []).push(t))
  return <div className="card"><div className="steps">{WSTEPS.map((s, n) => <div key={s} className={n < step ? 'done' : n === step ? 'now' : ''}>{s}</div>)}</div>
    {(FIELDS[step] || step === 2) && <div className="form">
      {step === 2 && <Field label="Technologies from the catalogue (Ctrl/Cmd to pick several)"><select multiple size={9} value={f.tech_ids} onChange={e => setF({ ...f, tech_ids: [...e.target.selectedOptions].map(o => o.value) })}>
        {Object.keys(groups).map(c => <optgroup key={c} label={c}>{groups[c].map((t: any) => <option key={t.tech_id} value={t.tech_id}>{t.name} {t.version}</option>)}</optgroup>)}</select></Field>}
      {(FIELDS[step] || []).map(x => <Field key={x.k} label={x.label + (x.req ? ' *' : '')}>
        {x.opts ? <select value={f[x.k] || ''} onChange={e => setF({ ...f, [x.k]: e.target.value })}><option value="">Select</option>{x.opts.map(o => <option key={o}>{o}</option>)}</select>
          : x.area ? <textarea value={f[x.k] || ''} onChange={e => setF({ ...f, [x.k]: e.target.value })} />
          : <input disabled={x.k === 'app_id' && !!id} value={f[x.k] || ''} onChange={e => setF({ ...f, [x.k]: e.target.value })} />}</Field>)}</div>}
    {step === 4 && (as ? <><h3>Lifecycle assessment <Pill s={as.status} /></h3>
      {as.unsupported.length > 0 && <p className="err">Unsupported: {as.unsupported.join(', ')}</p>}{as.approaching.length > 0 && <p>Approaching end of support: {as.approaching.join(', ')}</p>}
      {!as.components.length && <p className="muted">No technologies selected. Go back to Technical discovery to add some.</p>}
      <table><tbody>{as.components.map((c: any) => <tr key={c.tech_id}><td>{c.name} {c.version}</td><td>{c.std_eos || '—'}</td><td><Pill s={c.status} /></td></tr>)}</tbody></table></> : <p className="muted">Calculating…</p>)}
    {step === 5 && <><h3>{f.name} ({f.app_id})</h3><p>{f.business_unit} · {f.criticality} · {(f.tech_ids || []).length} technologies · lifecycle risk {as && <Pill s={as.status} />}</p>
      <p className="muted">Submitting sends this request to sign-off by the application owner, architecture review and final approval.</p></>}
    {err && <p className="err">{err}</p>}
    <p>{step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>} {step < 5 ? <button className="p" onClick={next}>Save and continue</button> : <button className="p" onClick={submit}>Submit for review</button>}</p></div>
}

const LABEL: any = { app_owner: 'Application owner', platform_owner: 'Platform owner (optional)', architecture: 'Technical architecture', final: 'Final approval' }

export function OnboardingDetail() {
  const { id } = useParams(); const me = useContext(MeCtx); const r = useApi('/onboarding/' + id); const [c, setC] = useState(''); const [err, setErr] = useState('')
  const post = async (path: string, json: any) => { try { await api(`/onboarding/${id}/${path}`, { method: 'POST', json }); setErr(''); setC(''); r.reload() } catch (e: any) { setErr(e.message) } }
  return <Async r={r}>{(o: any) => { const so = o.data.signoffs || {}; const editable = ['DRAFT', 'NEEDS INFORMATION'].includes(o.state)
    return <div className="card"><Link to="/onboarding">← Onboarding</Link>
      <h2>{o.name} <Pill s={o.state} /></h2><Progress state={o.state} />
      {editable && can(me, WRITE) && <p><Link to={`/onboarding/${id}/edit`}><button>Edit request</button></Link></p>}
      <h3>Lifecycle assessment <Pill s={o.assessment.status} /></h3>
      {o.assessment.unsupported.length > 0 && <p className="err">Unsupported: {o.assessment.unsupported.join(', ')}</p>}
      {o.assessment.approaching.length > 0 && <p>Approaching end of support: {o.assessment.approaching.join(', ')}</p>}
      <table><tbody>{o.assessment.components.map((x: any) => <tr key={x.tech_id}><td>{x.name} {x.version}</td><td>{x.std_eos || '—'}</td><td><Pill s={x.status} /></td></tr>)}</tbody></table>
      <h3>Sign-offs</h3><table><tbody>{Object.keys(LABEL).map(st => { const s = so[st]; const mine = can(me, o.sign_roles[st]); const open = o.state === 'UNDER REVIEW' && !s
        return <tr key={st}><td>{LABEL[st]}{o.required.includes(st) ? ' *' : ''}</td>
          <td>{s ? <><Pill s={s.decision} /> <span className="muted">{s.by} · {s.at.replace('T', ' ')} {s.comment && '· ' + s.comment}</span></> : <span className="muted">Awaiting</span>}</td>
          <td>{open && mine && <><button className="p" onClick={() => post('signoff', { stage: st, decision: 'APPROVED', comment: c })}>Approve</button> <button onClick={() => post('signoff', { stage: st, decision: 'NEEDS INFORMATION', comment: c })}>Needs information</button> <button onClick={() => post('signoff', { stage: st, decision: 'REJECTED', comment: c })}>Reject</button></>}</td></tr> })}</tbody></table>
      {o.state === 'UNDER REVIEW' && <div className="bar" style={{ marginTop: 10 }}><input style={{ flex: 1 }} placeholder="Sign-off comment (kept in the audit trail)" value={c} onChange={e => setC(e.target.value)} /></div>}
      <div className="bar" style={{ marginTop: 14 }}>{o.next.filter((n: string) => !['REJECTED', 'NEEDS INFORMATION'].includes(n) || false).map((n: string) => (n === 'SUBMITTED' || can(me, REVIEWERS)) && can(me, WRITE) &&
        <button key={n} className="p" onClick={() => post('transition', { to: n, comment: c })}>{n === 'SUBMITTED' ? 'Submit' : n === 'ACTIVE' ? 'Activate application' : n === 'UNDER REVIEW' ? 'Start review' : n}</button>)}</div>
      {err && <p className="err">{err}</p>}</div> }}</Async>
}
