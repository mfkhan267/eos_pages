// Turns a validated analysis into the in-browser tables. Shared by "Run Report" and the built-in demo data.
export const CAT_LABEL: any = { Applications: 'Middleware & Other Apps', 'Web Servers': 'Web Servers', Databases: 'Databases', 'Operating Systems': 'OS', Platforms: 'Cloud Services & Platforms' }
const pad4 = (n: number) => String(n).padStart(4, '0'), key = (n: string, v: string) => n.trim().toLowerCase() + '|' + v.trim().toLowerCase()
export const MISSING = 'Not specified'  // used when the workbook has no business unit or criticality

export function applyAnalysis(res: any) {
  const techs: any[] = [], idOf: any = {}; let nt = 0
  res.techstack.forEach((t: any, i: number) => {
    const tech_id = `TS-${pad4(i + 1)}`; idOf[key(t.name, t.version)] = tech_id
    techs.push({ tech_id, name: t.name, category: t.category_label || t.category, vendor: 'Not recorded', family: null, version: t.version, release_date: null, std_eos: t.std, ext_eos: t.ext,
      source_url: t.url, last_verified: t.verified, verification: String(t.vstatus).slice(0, 40), notes: t.notes || null })
  })
  const comps: any[] = []
  for (const c of res.components) {  // software missing from TechStack gets a placeholder with no date, so it shows Amber and is easy to find
    const k = c.matched ? key(c.matched.name, c.matched.version) : key(c.name, c.version)
    if (!idOf[k]) { nt++; idOf[k] = `NT-${pad4(nt)}`; techs.push({ tech_id: idOf[k], name: c.name, category: CAT_LABEL[c.layer] || 'Middleware & Other Apps', vendor: 'Not recorded', family: null, version: c.version, release_date: null, std_eos: null, ext_eos: null, source_url: null, last_verified: null, verification: 'UNKNOWN', notes: null }) }
    comps.push({ id: comps.length + 1, app_id: c.app_id, tech_id: idOf[k], environment: 'PROD', extended: c.extended, ext_type: c.ext_type, ext_start: null, ext_expiry: null, contract_ref: null, approval_owner: null, approval_date: null,
      documentation_url: null, comments: null, component_id: c.id, layer: c.layer, role: c.type, support_owner: c.support, domain_owner: c.domain, platform_owner: c.platform, primary_owner: c.primary,
      upgrade_comment: c.comment, upgrade_timeline: c.timeline, ref_colour: c.ref, reported_version: c.version })
  }
  const apps = res.applications.map((a: any) => ({ app_id: a.app_id, name: a.name, business_unit: a.bu || MISSING, criticality: a.crit || MISSING, app_owner: a.owner, platform_owner: a.platform, technical_owner: a.domain, description: null }))
  return { techs, apps, comps, placeholders: nt }
}
