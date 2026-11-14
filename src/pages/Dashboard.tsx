import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi, COLORS, download } from '../api'
import { Async } from '../ui'

const ORDER = ['RED', 'AMBER', 'BLUE', 'GREEN']
const NAME: any = { RED: 'Unsupported', AMBER: 'Expiring', BLUE: 'Extended', GREEN: 'Supported' }
const SUB: any = { RED: 'past end of support', AMBER: 'within 18 months', BLUE: 'extended support recorded', GREEN: 'more than 18 months left' }
const GLYPH: any = { Applications: '▦', 'Web Servers': '⌁', 'Operating Systems': '▣', Databases: '▤', Platforms: '☁' }
const LC: any = { Applications: '#3b2f9e', 'Web Servers': '#5a4ac9', 'Operating Systems': '#8f82e0', Databases: '#b7aaea', Platforms: '#ddd7f7' }
const HATCH = 'repeating-linear-gradient(135deg,rgba(255,255,255,.42) 0 3px,transparent 3px 8px)'
const fill = (s: string, all = false): any => ({ backgroundColor: COLORS[s], backgroundImage: all || s === 'RED' ? HATCH : undefined })
export const rel = (d: number) => { const a = Math.abs(d), t = a >= 730 ? `${(a / 365).toFixed(1)} years` : a >= 60 ? `${Math.round(a / 30)} months` : `${a} days`; return d < 0 ? `${t} ago` : `in ${t}` }

function Toggle({ v, set }: any) { return <div className="seg"><button className={v === 'n' ? 'on' : ''} onClick={() => set('n')}>Σ</button><button className={v === 'p' ? 'on' : ''} onClick={() => set('p')}>%</button></div> }

function Donut({ c, n, mode, pick, size = 270 }: any) {
  const [h, setH] = useState(''); const R = 78, C = 2 * Math.PI * R, gap = 10; let off = 0
  const act = ORDER.filter(s => c[s])
  return <div style={{ position: 'relative', width: size, margin: '0 auto' }}>
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <defs><pattern id="hr" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill={COLORS.RED} /><rect width="3" height="8" fill="rgba(255,255,255,.4)" /></pattern></defs>
      <circle r={R} cx="100" cy="100" fill="none" stroke="#eceef5" strokeWidth="22" />
      {act.map(s => { const len = (c[s] / n) * C, el = <circle key={s} r={R} cx="100" cy="100" fill="none" stroke={s === 'RED' ? 'url(#hr)' : COLORS[s]} strokeWidth="22" strokeLinecap="round"
        strokeDasharray={`${Math.max(len - gap - 22, 0.01)} ${C}`} strokeDashoffset={-(off + gap / 2 + 11)} style={{ cursor: 'pointer' }} onMouseEnter={() => setH(s)} onMouseLeave={() => setH('')} onClick={() => pick(s)} />; off += len; return el })}
    </svg>
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}><div>
      <div style={{ fontSize: size * 0.24, lineHeight: 1 }}>{n}</div><div className="muted">instances</div>
      {h && <div className="chipx" style={{ marginTop: 8 }}><span style={{ color: COLORS[h] }}>●</span> {c[h]} ({Math.round(100 * c[h] / n)}%)</div>}</div></div></div>
}

function Dot({ s, ...p }: any) { return <span className="dot" style={fill(s)} {...p} /> }
function BarList({ items, go, color = '#4338ca' }: any) {
  const mx = Math.max(...items.map((x: any) => x.value), 1)
  return <>{items.length ? items.map((x: any) => <div key={x.label} className="bl" onClick={() => go(x.label)}><span>{x.label}</span><div className="bt"><i style={{ width: `${100 * x.value / mx}%`, backgroundColor: color, backgroundImage: HATCH }} /></div><b>{x.value}</b></div>) : <p className="muted">Nothing to show yet.</p>}</>
}
function K({ color, glyph, label, value, sub, pill, bg, go }: any) {
  return <div className="card kpi" onClick={go}><div className="kh"><span className="ico" style={{ background: color, borderColor: bg }}>{glyph}</span>{label}<span className="go">↗</span></div>
    <div className="kv">{value}</div><div className="kd">{sub}</div><div><span className="chip" style={{ background: bg, color }}>{pill}</span></div></div>
}

function LayerCard({ name, c, go }: any) {
  const [mode, setMode] = useState('n'); const n = ORDER.reduce((a, s) => a + (c[s] || 0), 0); const pct = (x: number) => (n ? Math.round(100 * x / n) : 0)
  return <div className="card lc"><div className="bar" style={{ marginBottom: 0 }}><div><h3 style={{ fontSize: 21 }}>{GLYPH[name]} {name}</h3><div className="cs">{n} instances · {pct(n - (c.RED || 0))}% supported</div></div><span style={{ marginLeft: 'auto' }}><Toggle v={mode} set={setMode} /></span></div>
    {n ? <Donut c={c} n={n} mode={mode} size={190} pick={(s: string) => go({ layer: name, status: s })} /> : <p className="muted">No instances in this layer yet.</p>}
    {ORDER.map(s => <div key={s} className="srow" onClick={() => go({ layer: name, status: s })}><span className="d" style={{ background: COLORS[s] }} /><span className="n">{s[0] + s.slice(1).toLowerCase()}<span>{NAME[s]}</span></span><b>{mode === 'n' ? `${c[s] || 0}/${n}` : `${pct(c[s] || 0)}%`}</b>
      <div className="track"><i style={{ ...fill(s, true), width: `${pct(c[s] || 0)}%` }} /></div></div>)}</div>
}

export default function Dashboard() {
  const nav = useNavigate(); const r = useApi('/dashboard'); const [mode, setMode] = useState('n')
  const inst = (p: any) => nav('/instances?' + new URLSearchParams(p)); const apps = (p: any) => nav('/applications?' + new URLSearchParams(p))
  return <Async r={r}>{(d: any) => {
    const k = d.kpis, c = d.counts, n = k.instances, pct = (x: number) => (n ? Math.round(100 * x / n) : 0), L = Object.keys(d.layers)
    const sup = (l: any) => { const t = ORDER.reduce((a, s) => a + (l[s] || 0), 0); return t ? Math.round(100 * (t - (l.RED || 0)) / t) : 0 }
    const mx = Math.max(...L.map(l => ORDER.reduce((a, s) => a + (d.layers[l][s] || 0), 0)), 1)
    const cmx = Math.max(...d.calendar.map((x: any) => x.total), 1); const emx = Math.max(...d.exposure.map((x: any) => x.instances), 1)
    const tot = (l: string) => ORDER.reduce((a, s) => a + (d.layers[l][s] || 0), 0)
    return <>
      <div className="head"><div><h1 className="title">Technology Lifecycle Overview</h1><div className="sub">Assessment date {new Date(d.today).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {k.applications} applications · {n} technology instances</div></div>
        <div className="sp"><button onClick={() => download('/export/applications', 'applications.csv')}>⤓ Export CSV</button><button onClick={() => window.print()}>⎙ Print</button></div></div>
      <div className="kpis">
        <K color="#4338ca" bg="#e8e6fb" glyph="▦" label="Portfolio" value={k.applications} sub={`${n} technology instances`} pill={`${k.apps_at_risk} apps at risk`} go={() => apps({})} />
        <K color={COLORS.GREEN} bg="#e3f4e8" glyph="✓" label="Supported" value={c.GREEN || 0} sub="More than 18 months to EOS" pill={`${pct(c.GREEN || 0)}% of estate`} go={() => inst({ status: 'GREEN' })} />
        <K color={COLORS.AMBER} bg="#fdf1d8" glyph="!" label="Expiring" value={c.AMBER || 0} sub="Less than 18 months to EOS" pill={`${k.within6} within 6 months`} go={() => inst({ status: 'AMBER' })} />
        <K color={COLORS.RED} bg="#fde4e4" glyph="✕" label="Unsupported" value={c.RED || 0} sub="Past End of Support" pill={`${pct(c.RED || 0)}% of estate`} go={() => inst({ status: 'RED' })} />
        <K color={COLORS.BLUE} bg="#e0e9fd" glyph="◎" label="Extended" value={c.BLUE || 0} sub="Extended Support purchased" pill={`${k.ext_within12} ends within 12 months`} go={() => inst({ status: 'BLUE' })} /></div>
      <div className="strip">{L.map(l => <a key={l} href="#" onClick={e => { e.preventDefault(); inst({ layer: l }) }}>{l}<b>{tot(l)}</b></a>)}
        <a href="#" onClick={e => { e.preventDefault(); nav('/onboarding') }}>Pending onboarding<b>{k.pending_onboarding}</b></a>
        <a href="#" onClick={e => { e.preventDefault(); nav('/reviews') }}>Pending reviews<b>{k.pending_reviews}</b></a>
        <a href="#" onClick={e => { e.preventDefault(); nav('/reviews') }}>Overdue reviews<b style={{ color: k.overdue_reviews ? COLORS.RED : undefined }}>{k.overdue_reviews}</b></a></div>
      <div className="row3">
        <div className="card"><div className="bar"><div><h3>Portfolio Health</h3><div className="cs">Technology instances by lifecycle status</div></div><span style={{ marginLeft: 'auto' }}><Toggle v={mode} set={setMode} /></span></div>
          {n ? <Donut c={c} n={n} mode={mode} pick={(s: string) => inst({ status: s })} /> : <p className="muted">No technology instances yet.</p>}
          {ORDER.map(s => <div key={s} className="srow" onClick={() => inst({ status: s })}><span className="d" style={{ background: COLORS[s] }} /><span className="n">{s[0] + s.slice(1).toLowerCase()}<span>{NAME[s]}</span></span><b>{mode === 'n' ? `${c[s] || 0}/${n}` : `${pct(c[s] || 0)}%`}</b>
            <div className="track"><i style={{ ...fill(s, true), width: `${pct(c[s] || 0)}%` }} /></div></div>)}</div>
        <div className="card"><h3>Layer Health</h3><div className="cs">Status mix per technology layer</div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}><div style={{ minWidth: 118 }}><div className="big">{pct(n - (c.RED || 0))}<small>%</small></div><div className="muted" style={{ margin: '8px 0 14px' }}>of instances are still supported</div>
            {ORDER.map(s => <div key={s} style={{ fontSize: 13 }}><span style={{ color: COLORS[s] }}>●</span> {s[0] + s.slice(1).toLowerCase()}</div>)}<div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Hatched = past End of Support</div></div>
            <div className="cols" style={{ flex: 1 }}>{L.map(l => <div className="colw" key={l}><span className="cnt">{tot(l)}</span>
              <div className="pillbar" style={{ height: Math.max(40, 215 * tot(l) / mx) }}>{['GREEN', 'BLUE', 'AMBER', 'RED'].filter(s => d.layers[l][s]).map(s => <div key={s} title={`${l}: ${d.layers[l][s]} ${NAME[s]}`} style={{ ...fill(s), flex: d.layers[l][s] }} onClick={() => inst({ layer: l, status: s })}>{d.layers[l][s]}</div>)}</div>
              <div style={{ fontSize: 22 }}>{GLYPH[l]}</div><div style={{ fontWeight: 700, fontSize: 12, textAlign: 'center', maxWidth: 80 }}>{l}</div><div className="muted" style={{ fontSize: 12 }}>{sup(d.layers[l])}% supported</div></div>)}</div></div></div>
        <div className="card"><div className="bar"><div><h3>Needs Attention</h3><div className="cs">Most urgent Red and Amber instances</div></div><a style={{ marginLeft: 'auto', fontWeight: 700 }} href="#" onClick={e => { e.preventDefault(); inst({ status: 'RED,AMBER' }) }}>View all</a></div>
          {d.attention.length ? d.attention.map((a: any, i: number) => <div key={i} className="att" onClick={() => nav('/applications/' + a.app_id)}><div className="ai" style={a.status === 'AMBER' ? { background: '#fdf1d8', color: '#b45309' } : {}}>{GLYPH[a.layer]}</div>
            <div><div className="t">{a.tech}</div><div className="m">{a.app_id} · {a.app_name}</div></div>
            <div className="r" style={{ color: a.status === 'RED' ? '#b91c1c' : '#b45309' }}>{a.days == null ? 'Not declared' : rel(a.days)}<div className="m" style={{ fontWeight: 500 }}>{a.owner}</div><div className="m" style={{ fontWeight: 700, color: a.comment === 'UPGRADE PLANNED' ? '#15803d' : '#b91c1c' }}>{a.comment === 'UPGRADE PLANNED' ? `Plan ${a.timeline}` : 'No plan'}</div></div></div>) : <p className="muted">Nothing is at risk right now.</p>}</div></div>
      <h2 className="sec">Health by layer</h2><div className="layers5">{L.map(l => <LayerCard key={l} name={l} c={d.layers[l]} go={inst} />)}</div>
      <div className="row2" style={{ marginTop: 16 }}>
        <div className="card"><h3>Lifecycle Calendar</h3><div className="cs">When instances reach End of Support, by quarter</div>
          <div className="bar">{Object.keys(LC).map(l => <span key={l} className="chipx"><span style={{ color: LC[l] }}>●</span> {l}</span>)}</div>
          <div className="cal">{d.calendar.map((b: any) => <div className="calc" key={b.label} onClick={() => inst({ ...(b.frm ? { eos_from: b.frm } : {}), ...(b.to ? { eos_to: b.to } : {}) })}>
            {b.total > 0 && <b style={{ fontSize: 13 }}>{b.total}</b>}<div className="calt" style={{ height: Math.max(14, 220 * b.total / cmx) }}>{Object.keys(LC).filter(l => b.layers[l]).map(l => <div key={l} title={`${l}: ${b.layers[l]}`} style={{ background: LC[l], flex: b.layers[l] }} />)}</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: b.label === 'Past' ? COLORS.RED : undefined }}>{b.label}</span></div>)}</div></div>
        <div className="card"><h3>Technology Exposure</h3><div className="cs">Most widely deployed technology and version combinations</div>
          {d.exposure.map((x: any, i: number) => <div key={x.tech} className="exp" onClick={() => inst({ tech: x.tech })}><span className="rank">{i + 1}</span><div><b>{x.tech}</b><div className="track" style={{ marginTop: 6, height: 14 }}><i style={{ ...fill(x.status, true), width: `${100 * x.instances / emx}%` }} /></div></div>
            <span className={'pill ' + x.status}>{x.status[0] + x.status.slice(1).toLowerCase()}</span><span /><span className="muted" style={{ fontSize: 13 }}>{x.instances} instances · {x.apps} apps</span></div>)}</div></div>
      <div className="card"><h3>Estate at a Glance</h3><div className="cs">Every technology instance, one dot each. Hover for detail, click to open the application.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 28 }}>
          {L.map(l => <div key={l}><b>{GLYPH[l]} {l}</b> <span className="cnt">{tot(l)}</span><div className="dots">{d.estate.filter((e: any) => e.layer === l).map((e: any, i: number) => <Dot key={i} s={e.status} title={`${e.tech} · ${e.app_id} ${e.app_name} · ${NAME[e.status]}`} onClick={() => nav('/applications/' + e.app_id)} />)}</div></div>)}
          <div><div style={{ fontSize: 34 }}>{k.covered}<small className="muted" style={{ fontSize: 18 }}>%</small></div><div className="muted">At-risk instances with extended support</div><div className="track"><i style={{ ...fill('BLUE', true), width: k.covered + '%' }} /></div>
            <div style={{ fontSize: 34, marginTop: 14 }}>{k.with_plan}<small className="muted" style={{ fontSize: 18 }}>/{k.at_risk}</small></div><div className="muted">At-risk instances with an upgrade plan</div><div className="track"><i style={{ ...fill('AMBER', true), width: (k.at_risk ? 100 * k.with_plan / k.at_risk : 0) + '%' }} /></div>
            <div style={{ fontSize: 34, marginTop: 14 }}>{k.known_eos}<small className="muted" style={{ fontSize: 18 }}>%</small></div><div className="muted">Instances with a known end-of-support date</div><div className="track"><i style={{ backgroundColor: '#7766d6', backgroundImage: HATCH, width: k.known_eos + '%' }} /></div>
            <div style={{ fontSize: 34, marginTop: 14 }}>{k.verified}<small className="muted" style={{ fontSize: 18 }}>%</small></div><div className="muted">Catalogue versions verified against the vendor</div><div className="track"><i style={{ ...fill('GREEN', true), width: k.verified + '%' }} /></div></div></div></div>
      <div className="row4">
        <div className="card"><h3>Application risk by business unit</h3><div className="cs">Click a segment to see those applications</div>
          {Object.keys(d.business_unit_risk).map(b => { const row = d.business_unit_risk[b], t = ORDER.reduce((a, s) => a + (row[s] || 0), 0); return <div key={b} style={{ margin: '10px 0' }}><div style={{ fontSize: 13, fontWeight: 600 }}>{b} <span className="muted">· {t}</span></div>
            <div style={{ display: 'flex', height: 16, borderRadius: 99, overflow: 'hidden', gap: 2 }}>{ORDER.filter(s => row[s]).map(s => <div key={s} title={`${row[s]} ${NAME[s]}`} style={{ ...fill(s), flex: row[s], cursor: 'pointer' }} onClick={() => apps({ business_unit: b, status: s })} />)}</div></div> })}</div>
        <div className="card"><h3>Applications by criticality</h3><div className="cs">&nbsp;</div><BarList items={d.by_criticality} go={(l: string) => apps({ criticality: l })} /></div>
        <div className="card"><h3>Portfolio by owner</h3><div className="cs">Application owners with the most applications</div><BarList items={d.by_owner} go={(l: string) => apps({ owner: l })} color="#7766d6" /></div>
        <div className="card"><h3>Applications by cloud platform</h3><div className="cs">&nbsp;</div><BarList items={d.by_cloud} go={(l: string) => inst({ tech: l })} color="#2563EB" /></div>
        <div className="card dark"><div style={{ letterSpacing: '.15em', fontSize: 12, fontWeight: 700, color: '#a9b0d0' }}>⚑ GOVERNANCE</div>
          <h3 style={{ margin: '10px 0' }}><span style={{ color: '#ff8a8a' }}>{k.pending_onboarding + k.pending_reviews}</span> items are waiting on a decision.</h3>
          <div className="cs">{k.pending_onboarding} onboarding requests · {k.pending_reviews} reviews pending · {k.overdue_reviews} overdue.</div>
          <button onClick={() => nav('/onboarding')}>Review onboarding →</button><button onClick={() => nav('/reviews')}>Open reviews →</button></div></div></>
  }}</Async>
}
