import { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, useApi, COLORS, MeCtx, can, REVIEWERS } from '../api'
import { Async } from '../ui'

const ORDER = ['GREEN', 'AMBER', 'RED', 'BLUE']

function Pie({ c, go }: any) {
  const items = ORDER.map(s => ({ s, v: c[s] || 0 })).filter(x => x.v), n = items.reduce((a, x) => a + x.v, 0); let a0 = -Math.PI / 2; const R = 108, C = 120
  if (!n) return <p className="muted">No instances in this group yet.</p>
  return <svg viewBox="0 0 240 240" width="100%" style={{ maxWidth: 270, display: 'block', margin: '0 auto' }}>
    {items.map(x => {
      const a1 = a0 + 2 * Math.PI * x.v / n, m = (a0 + a1) / 2, P = (a: number) => `${C + R * Math.cos(a)} ${C + R * Math.sin(a)}`
      const d = items.length === 1 ? '' : `M ${C} ${C} L ${P(a0)} A ${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${P(a1)} Z`; a0 = a1
      return <g key={x.s} style={{ cursor: 'pointer' }} onClick={() => go(x.s)}>
        {items.length === 1 ? <circle cx={C} cy={C} r={R} fill={COLORS[x.s]} /> : <path d={d} fill={COLORS[x.s]} stroke="#fff" strokeWidth="2" />}
        <text x={items.length === 1 ? C : C + R * 0.62 * Math.cos(m)} y={items.length === 1 ? C : C + R * 0.62 * Math.sin(m)} fill="#fff" fontWeight="800" fontSize="21" textAnchor="middle" dominantBaseline="middle">{x.v}</text></g>
    })}</svg>
}

function Line({ series, target }: any) {
  const W = 420, H = 250, L = 40, Rr = 30, T = 22, B = 34, ok = series.filter((p: any) => p.pct != null)
  if (!ok.length) return <p className="muted">No end-of-support dates are known for this group, so there is nothing to chart.</p>
  const all = series.flatMap((p: any) => [p.pct, p.planned]).filter((v: any) => v != null)
  const lo = Math.max(0, Math.floor((Math.min(...all, target) - 8) / 10) * 10), hi = 100, last = series.length - 1
  const x = (i: number) => L + i * (W - L - Rr) / last, y = (v: number) => T + (hi - v) * (H - T - B) / (hi - lo)
  const pts = (f: any, key = 'pct') => series.map((p: any, i: number) => ({ ...p, i })).filter((p: any) => p[key] != null && f(p)).map((p: any) => `${x(p.i)},${y(p[key])}`).join(' ')
  const ticks: number[] = []; for (let v = lo; v <= hi; v += 10) ticks.push(v)
  const tag = (i: number, v: number, c: string, dy: number) => <text x={x(i)} y={y(v) + dy} fontSize="11" fontWeight="700" textAnchor="middle" fill={c}>{v}%</text>
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%">
    {ticks.map(v => <g key={v}><line x1={L} x2={W - Rr} y1={y(v)} y2={y(v)} stroke="#e6e8f2" /><text x={L - 6} y={y(v)} fontSize="11" fill="#6b7290" textAnchor="end" dominantBaseline="middle">{v}%</text></g>)}
    <line x1={L} x2={W - Rr} y1={y(target)} y2={y(target)} stroke="#16A34A" strokeDasharray="2 5" strokeWidth="2" /><text x={W - Rr} y={y(target) - 6} fontSize="11" fill="#16A34A" textAnchor="end" fontWeight="700">Target {target}%</text>
    <polyline points={pts((p: any) => p.cur || !p.actual)} fill="none" stroke={COLORS.AMBER} strokeWidth="2.5" strokeDasharray="6 5" />
    <polyline points={pts((p: any) => p.planned != null, 'planned')} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeDasharray="2 4" />
    <polyline points={pts((p: any) => p.actual)} fill="none" stroke={COLORS.BLUE} strokeWidth="3" />
    {series.map((p: any, i: number) => p.pct == null ? null : <g key={i}><circle cx={x(i)} cy={y(p.pct)} r="4" fill={p.actual ? COLORS.BLUE : COLORS.AMBER} />{(p.actual || i === last) && tag(i, p.pct, '#0f1226', i === last && p.planned != null && p.planned > p.pct ? 16 : -9)}</g>)}
    {series[last].planned != null && <g><circle cx={x(last)} cy={y(series[last].planned)} r="4" fill="#7c3aed" />{tag(last, series[last].planned, '#7c3aed', -9)}</g>}
    {series.map((p: any, i: number) => <text key={i} x={x(i)} y={H - 12} fontSize="9.5" fill="#6b7290" textAnchor="middle">{p.label}</text>)}</svg>
}

function Target({ g, done }: any) {
  const [v, setV] = useState(String(g.target)); const [err, setErr] = useState('')
  const save = async () => { try { await api('/targets/' + encodeURIComponent(g.name), { method: 'PUT', json: { pct: Number(v) } }); setErr(''); done() } catch (e: any) { setErr(e.message) } }
  return <div className="bar" style={{ marginTop: 8 }}><span className="muted">Target %</span><input type="number" min={0} max={100} value={v} style={{ width: 80 }} onChange={e => setV(e.target.value)} /><button onClick={save} disabled={Number(v) === g.target}>Save</button><span className="err">{err}</span></div>
}

function Names({ title, color, rows, go }: any) {
  return <div className="lst"><b style={{ color }}>{title}:</b>{rows.length ? rows.map((r: any) => <div key={r.tech} className="li" onClick={() => go(r.tech)}><b>{r.tech}</b> [{r.apps.slice(0, 6).join(', ')}{r.apps.length > 6 ? `, +${r.apps.length - 6} more` : ''}]</div>) : <div className="muted">None</div>}</div>
}

export default function Executive() {
  const nav = useNavigate(); const me = useContext(MeCtx); const r = useApi('/executive')
  return <Async r={r}>{(d: any) => <>
    <div className="head"><div><h1 className="title">System Evergreening Summary · {d.quarter}</h1><div className="sub">Technology instances by lifecycle status, with a forward-looking view · as of {d.today}</div></div>
      <div className="sp"><button onClick={() => window.print()}>⎙ Print</button></div></div>
    <div className="pies">{d.groups.map((g: any) => <div className="card" key={g.name}><h3 style={{ textAlign: 'center' }}>{g.name}</h3><div className="cs" style={{ textAlign: 'center' }}>{g.total} instances</div>
      <Pie c={g.counts} go={(s: string) => nav('/instances?' + new URLSearchParams({ layer: g.layers.join(','), status: s }))} />
      <div className="bar" style={{ justifyContent: 'center', margin: '10px 0' }}>{ORDER.map(s => <span key={s} style={{ fontSize: 13 }}><span style={{ color: COLORS[s] }}>■</span> {s[0] + s.slice(1).toLowerCase()}</span>)}</div>
      <Names title="Amber" color="#b45309" rows={g.amber} go={(t: string) => nav('/instances?' + new URLSearchParams({ tech: t }))} />
      <Names title="Red" color="#b91c1c" rows={g.red} go={(t: string) => nav('/instances?' + new URLSearchParams({ tech: t }))} /></div>)}</div>
    <div className="chev"><div style={{ background: COLORS.GREEN }}>End of Support &gt; 18 months</div><div style={{ background: COLORS.AMBER, color: '#3b2a00' }}>End of Support &lt; 18 months</div><div style={{ background: COLORS.RED }}>Support ended</div><div style={{ background: COLORS.BLUE }}>Subscribed for Extended Support</div></div>
    <p className="muted" style={{ margin: '12px 4px 22px' }}>Numbers are technology instances (one per application and technology version), categorised by the underlying software. Click a slice or a technology to see the records.</p>
    <h2 className="sec">Forward looking view</h2>
    <div className="pies">{d.groups.map((g: any) => <div className="card" key={g.name}><h3 style={{ textAlign: 'center' }}>{g.name}</h3><div className="cs" style={{ textAlign: 'center' }}>% of instances under support</div>
      <Line series={g.series} target={g.target} />
      <div className="bar" style={{ justifyContent: 'center', fontSize: 13 }}><span><span style={{ color: COLORS.BLUE }}>━●</span> Derived actuals</span><span><span style={{ color: COLORS.AMBER }}>╍●</span> Projected, no upgrades</span><span><span style={{ color: '#7c3aed' }}>╍●</span> Planned upgrades</span></div>
      <div className={'note ' + (g.on_track === false ? 'bad' : '')}>{g.note}</div>
      {can(me, REVIEWERS) && <Target g={g} done={r.reload} />}</div>)}</div>
    <p className="muted">Actuals are derived: each quarter-end is measured against the end-of-support and extended-support dates of today's instances, because ATLAS does not yet keep historical snapshots. Planned assumes every upgrade marked UPGRADE PLANNED completes in its planned quarter. Instances with no end-of-support date are excluded from the percentage.</p></>}</Async>
}
