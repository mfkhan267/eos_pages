import { useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
import { useApi, MeCtx, SearchCtx, can, REVIEWERS, WRITE } from './api'
import { ROLES, USERS, setRole } from './core/store'
import Dashboard from './pages/Dashboard'
import { Applications } from './pages/Portfolio'
import Instances from './pages/Instances'
import Executive from './pages/Executive'
import ApplicationDetail from './pages/ApplicationDetail'
import Technologies from './pages/Technologies'
import Ownership from './pages/Ownership'
import Datasets from './pages/Datasets'
import { OnboardingList, OnboardingDetail, Wizard } from './pages/Onboarding'
import Reviews from './pages/Reviews'
import { Audit } from './pages/Admin'

const AtlasMark = () => <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="#7db4f2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <circle cx="16" cy="7" r="3.6" /><circle cx="7" cy="25" r="3.6" /><circle cx="25" cy="25" r="3.6" /><path d="M16 10.6V16M16 16H7v5.4M16 16h9v5.4" /></svg>

export default function App() {
  const me = useApi('/me'); const [q, setQ] = useState(''); const box = useRef<HTMLInputElement>(null); const loc = useLocation(); const nav = useNavigate()
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as any).tagName)) { e.preventDefault(); box.current?.focus() } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])
  if (me.err) return <div className="shell"><div className="card err">{me.err}</div></div>
  if (!me.data) return <div className="shell muted">Loading…</div>
  const m = me.data, admin = can(m, REVIEWERS)
  const items: [string, string][] = [['/', 'Dashboard'], ['/executive', 'Executive view'], ['/applications', 'Applications'], ['/instances', 'Instances'], ['/technologies', 'Technologies'], ['/onboarding', 'Onboarding'], ['/reviews', 'Reviews']]
  if (admin) items.push(['/datasets', 'Datasets'], ['/ownership', 'Ownership'])
  if (admin || can(m, ['read_only_executive'])) items.push(['/audit', 'Audit'])
  const type = (v: string) => { setQ(v); if (v && loc.pathname === '/') nav('/applications') }
  return <MeCtx.Provider value={m}><SearchCtx.Provider value={q}><div className="shell">
    <div className="topbar">
      <div className="brandx" title="Application Technology Lifecycle &amp; Architecture System">
        <AtlasMark /><div><b>ATLAS <span>2.0</span></b><em>Enterprise Application Governance Platform</em><small>Application Technology Lifecycle &amp; Architecture System</small></div></div>
      <nav className="navp">{items.map(([to, t]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>{t}</NavLink>)}</nav>
      <div className="search"><span>⌕</span><input ref={box} value={q} onChange={e => type(e.target.value)} placeholder="Search every column on this page" /><kbd>/</kbd></div>
      <label className="who" title="Demonstration only: the static edition has no sign-in, so this selector just switches which permissions the screens apply.">Viewing as <select aria-label="Role" value={m.roles[0]} onChange={e => setRole(e.target.value)}>{ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')} ({USERS[r]})</option>)}</select></label>
    </div>
    <div className="banner">⛨ {m.storage_warning ? m.storage_warning : (m.source === 'demo' ? 'Demonstration data. ' : 'Your dataset. ') + 'Everything stays in this browser and nothing is uploaded. The role selector simulates permissions, it is not security.'}
      {can(m, WRITE) && <span className="sp"><Link to="/datasets"><button>⇪ Import Dataset</button></Link><Link to="/onboarding/new"><button className="p">＋ Onboard application</button></Link></span>}</div>
    <Routes>
      <Route path="/" element={<Dashboard />} /><Route path="/executive" element={<Executive />} /><Route path="/applications" element={<Applications />} /><Route path="/applications/:id" element={<ApplicationDetail />} />
      <Route path="/instances" element={<Instances />} /><Route path="/technologies" element={<Technologies />} />
      <Route path="/onboarding" element={<OnboardingList />} /><Route path="/onboarding/new" element={<Wizard />} /><Route path="/onboarding/:id/edit" element={<Wizard />} /><Route path="/onboarding/:id" element={<OnboardingDetail />} />
      <Route path="/reviews" element={<Reviews />} /><Route path="/ownership" element={<Ownership />} /><Route path="/datasets" element={<Datasets />} /><Route path="/audit" element={<Audit />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes></div></SearchCtx.Provider></MeCtx.Provider>
}
