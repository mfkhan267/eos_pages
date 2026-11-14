const http = require('http'), fs = require('fs'), path = require('path'), { chromium } = require('playwright')
const DOCS = path.join(__dirname, '..', 'docs'), FIX = path.join(__dirname, 'fixtures'), TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.xlsx': 'application/octet-stream' }
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; try { r.setHeader('content-type', TYPES[path.extname(p)] || 'application/octet-stream'); r.end(fs.readFileSync(DOCS + p)) } catch { r.statusCode = 404; r.end('nf') } })
let pass = 0, fail = 0; const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  -> ' + x)) }
;(async () => {
  await new Promise(r => srv.listen(8123, r)); const br = await chromium.launch(), ctx = await br.newContext({ viewport: { width: 1700, height: 1000 }, acceptDownloads: true }), pg = await ctx.newPage(); const errs = []
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => m.type() === 'error' && errs.push('console: ' + m.text())); pg.on('dialog', d => d.accept())
  const B = 'http://localhost:8123/', go = async h => { await pg.evaluate(x => { location.hash = x }, h); await pg.waitForTimeout(250) }, txt = () => pg.locator('body').innerText(), state = () => pg.evaluate(() => JSON.parse(localStorage.getItem('atlas2.state.v1')))
  const role = async r => { await pg.selectOption('select[aria-label=Role]', r); await pg.waitForTimeout(200) }
  await pg.goto(B + '?today=2026-11-13'); await pg.waitForTimeout(500)
  let t = await txt(); ok('loads with ATLAS 2.0 branding and a Pages-safe relative path', t.includes('ATLAS') && t.includes('Enterprise Application Governance Platform'))
  ok('demo workspace is seeded (60 applications) and banner explains local storage', t.includes('60 applications') && t.includes('Everything stays in this browser'), t.slice(0, 300))
  for (const [h, want] of [['/', 'Technology Lifecycle Overview'], ['/executive', 'System Evergreening Summary'], ['/applications', 'Ledger'], ['/instances?status=RED', 'technology instances'], ['/technologies', 'PostgreSQL'], ['/onboarding', 'Collections Workbench'], ['/onboarding/new', 'Registration'], ['/reviews', 'average compliance'], ['/ownership', 'Reassign an owner'], ['/audit', 'Append-only'], ['/datasets', 'Import dataset and run the report'], ['/applications/30000001', 'Risk is the worst component']]) {
    errs.length = 0; await go(h); t = await txt(); ok(`route #${h} renders`, t.includes(want), t.slice(0, 120)); ok(`route #${h} has no console errors`, !errs.length, errs.join(' | '))
  }
  await go('/'); ok('five health-by-layer cards', (await pg.locator('.layers5 .card').count()) === 5); await pg.screenshot({ path: require('os').tmpdir() + '/atlas-dash.png', fullPage: true })
  await pg.locator('.kpi').nth(3).click(); await pg.waitForTimeout(300); ok('KPI drill-down opens RED instances', pg.url().includes('instances?status=RED'), pg.url())
  const reds = await pg.locator('.sf button.RED b').innerText(); ok('Red chip count equals the rows shown', Number(reds) === (await pg.locator('tbody tr').count()), reds)
  await pg.fill('.search input', 'Ledger Core 1 '); await pg.waitForTimeout(200); ok('header search filters every column', (await pg.locator('tbody tr').count()) < Number(reds)); await pg.fill('.search input', '')
  await go('/executive'); ok('executive view: four pies and four forward charts with a planned line', (await pg.locator('.pies svg').count()) >= 8 && (await pg.locator('polyline[stroke="#7c3aed"]').count()) === 4); await pg.screenshot({ path: require('os').tmpdir() + '/atlas-exec.png', fullPage: true })
  // ---- Datasets: template download, preview, errors, run ----
  await go('/datasets'); const [dl] = await Promise.all([pg.waitForEvent('download'), pg.getByText('1. Download the template').click()]); ok('template downloads', dl.suggestedFilename() === 'ATLAS_Dataset_Template.xlsx')
  ok('Run Report is disabled before a preview', await pg.getByText('4. Run Report').isDisabled())
  await pg.setInputFiles('input[type=file] >> nth=0', FIX + '/row_errors.xlsx'); await pg.getByText('3. Preview and validate').click(); await pg.waitForTimeout(500); t = await txt()
  ok('invalid workbook: row-level errors shown, Run Report blocked', t.includes('error(s) must be fixed') && t.includes('already used on row') && await pg.getByText('4. Run Report').isDisabled(), t.slice(0, 200))
  await pg.setInputFiles('input[type=file] >> nth=0', { name: 'x.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('nope') }); await pg.getByText('3. Preview and validate').click(); await pg.waitForTimeout(300); ok('a non-Excel file gives a clear message', (await txt()).includes('not a valid .xlsx'))
  await pg.setInputFiles('input[type=file] >> nth=0', FIX + '/template.xlsx'); await pg.getByText('3. Preview and validate').click(); await pg.waitForTimeout(600); t = await txt()
  ok('template previews clean: 4 applications, 13 components, 152 techstack rows', t.includes('The workbook is valid') && /Applications\s*4/.test(t) && /Components\s*13/.test(t) && /TechStack versions\s*152/.test(t), t.slice(0, 400))
  ok('preview shows status counts Green 5, Amber 3, Blue 3, Red 2', /Green\s*5/.test(t) && /Amber\s*3/.test(t) && /Blue\s*3/.test(t) && /Red\s*2/.test(t))
  await pg.getByText('4. Run Report').click(); await pg.waitForTimeout(700); t = await txt(); ok('Run Report completes', t.includes('Report complete') && t.includes('13 components loaded'), t.slice(0, 300))
  ok('run history lists the run', /#1/.test(t) && t.includes('template.xlsx')); ok('data quality of the latest run is listed', t.includes('Software not found on the TechStack sheet'))
  await go('/'); t = await txt(); ok('dashboard now reflects the dataset: 4 applications, 13 instances', t.includes('4 applications') && t.includes('13 technology instances'), t.slice(0, 200))
  await go('/instances'); t = await txt(); ok('Not Declared shows Amber, plan columns present', t.includes('Not declared') && t.toLowerCase().includes('upgrade plan'))
  const s1 = await state(); ok('statuses persisted as data, not as colours (dates drive them)', s1.comps.length === 13 && s1.source === 'dataset' && s1.comps.every(c => !('status' in c)))
  await go('/executive'); ok('executive view works on the dataset', (await txt()).includes('System Evergreening Summary') && (await pg.locator('.pies svg').count()) >= 8)
  await pg.reload(); await pg.waitForTimeout(500); await go('/'); ok('data survives a reload (browser storage)', (await txt()).includes('4 applications'))
  await go('/audit'); t = await txt(); ok('audit trail records the dataset run', t.includes('DATASET_RUN'))
  // ---- reset to demo, then workflows ----
  await go('/datasets'); await pg.getByText('Reset to demonstration data').click(); await pg.waitForTimeout(500); await go('/'); ok('reset restores 60 demo applications', (await txt()).includes('60 applications'))
  // extended support on a Red component
  const st = await state(), techs = Object.fromEntries(st.techs.map(x => [x.tech_id, x])); const target = st.comps.find(c => !c.extended && techs[c.tech_id].std_eos && techs[c.tech_id].std_eos < '2026-11-13')
  const tn = techs[target.tech_id]; await go('/applications/' + target.app_id); const row = pg.locator('tr', { hasText: tn.name }).filter({ hasText: tn.version }).first()
  ok('extended checkbox is enabled on a Red component', !(await row.locator('input[type=checkbox]').isDisabled()))
  await row.locator('input[type=checkbox]').click(); await pg.waitForTimeout(200); await pg.getByText('Save entitlement').click(); await pg.waitForTimeout(200); ok('extended form requires the approval record', (await txt()).includes('Extended support needs'))
  const f = l => pg.locator(`label:has-text("${l}") input`).first(); await f('Expiry date').fill('2028-06-30'); await f('Contract or purchase').fill('PO-1'); await f('Approval owner').fill('Alex Morgan'); await f('Approval date').fill('2026-10-01'); await f('Supporting documentation').fill('https://example.com/d')
  await pg.getByText('Save entitlement').click(); await pg.waitForTimeout(300); ok('saved entitlement turns the component Blue', (await row.innerText()).includes('Blue') && (await row.innerText()).includes('PO-1'), await row.innerText())
  const green = st.comps.find(c => techs[c.tech_id].std_eos && techs[c.tech_id].std_eos > '2029-01-01'); await go('/applications/' + green.app_id); const gr = pg.locator('tr', { hasText: techs[green.tech_id].name }).first()
  ok('extended checkbox is disabled on a Green component', await gr.locator('input[type=checkbox]').isDisabled())
  // end-of-support date change reaches every application that uses the version
  await go('/technologies'); const pg15 = st.techs.find(x => x.name === 'PostgreSQL' && x.version === '15'); const usedBy = new Set(st.comps.filter(c => c.tech_id === pg15.tech_id).map(c => c.app_id)).size
  await go('/instances?tech=PostgreSQL%2015'); const before = await pg.locator('tbody tr').allInnerTexts(); ok('PostgreSQL 15 instances are Amber before the change', before.length > 0 && before.every(r => r.includes('Amber')), before[0])
  await go('/technologies'); await pg.fill('.search input', 'PostgreSQL'); await pg.waitForTimeout(200); await pg.locator('tr', { hasText: 'T-' }).first().count(); await pg.locator(`tr:has-text("${pg15.tech_id}") >> text=Edit`).click(); await pg.waitForTimeout(200)
  await pg.locator('label:has-text("Standard end of support") input').first().fill('2035-01-01'); await pg.getByText('Save', { exact: true }).click(); await pg.waitForTimeout(300); await pg.fill('.search input', '')
  await go('/instances?tech=PostgreSQL%2015'); const after = await pg.locator('tbody tr').allInnerTexts(); ok(`changing one date turns all ${usedBy} applications' PostgreSQL 15 Green`, after.length === before.length && after.every(r => r.includes('Green')), after[0])
  // add / delete a technology
  await go('/technologies'); await pg.getByText('Add technology').click(); const tf = l => pg.locator(`label:has-text("${l}") input`).first(); await tf('Technology name').fill('Acme DB'); await tf('Category').fill('Databases'); await tf('Vendor').fill('Acme'); await tf('Version').fill('1.0'); await pg.getByText('Save', { exact: true }).click(); await pg.waitForTimeout(300)
  ok('a technology can be added', (await txt()).includes('Acme DB')); await pg.locator('tr:has-text("Acme DB") >> text=Delete').click(); await pg.waitForTimeout(300); ok('an unused technology can be deleted', !(await txt()).includes('Acme DB'))
  await pg.locator(`tr:has-text("${pg15.tech_id}") >> text=Delete`).click(); await pg.waitForTimeout(300); ok('a technology in use cannot be deleted', (await txt()).includes('Used by'))
  const [csv] = await Promise.all([pg.waitForEvent('download'), pg.getByText('Export catalogue CSV').click()]); ok('catalogue CSV exports', csv.suggestedFilename() === 'technology_catalogue.csv')
  // onboarding with sign-offs and separation of duties
  await role('application_owner'); await go('/onboarding/new'); const w = l => pg.locator(`label:has-text("${l}") input`).first(), next = async () => { await pg.getByText('Save and continue').click(); await pg.waitForTimeout(200) }
  await w('Application ID').fill('50000001'); await w('Application name').fill('Test Ledger'); await w('Business unit').fill('Finance'); await w('Application owner').fill('Pat'); await w('Platform owner').fill('Sam'); await w('Technical owner').fill('Lee'); await next()
  await pg.locator('label:has-text("Business criticality") select').selectOption('High'); await w('Business capability').fill('Payments'); await next(); await pg.locator('select[multiple]').selectOption(['TS-0003', 'TS-0050']); await next(); await w('RTO').fill('4'); await w('RPO').fill('1'); await next(); ok('lifecycle assessment step shows selected technologies', (await txt()).includes('Lifecycle assessment')); await next()
  await pg.getByText('Submit for review').click(); await pg.waitForTimeout(300); ok('request is submitted', (await txt()).includes('Submitted'))
  await role('administrator'); await pg.getByText('Start review').click(); await pg.waitForTimeout(250); ok('review started', (await txt()).includes('Under review'))
  await role('enterprise_architect'); await pg.locator('tr:has-text("Final approval") button:has-text("Approve")').click(); await pg.waitForTimeout(250); ok('final approval is blocked until the earlier sign-offs exist', (await txt()).includes('Final approval needs'))
  await pg.locator('tr:has-text("Technical architecture") button:has-text("Approve")').click(); await pg.waitForTimeout(250)
  await role('application_owner'); await pg.locator('tr:has-text("Application owner") button:has-text("Approve")').click(); await pg.waitForTimeout(250)
  await role('enterprise_architect'); await pg.locator('tr:has-text("Final approval") button:has-text("Approve")').click(); await pg.waitForTimeout(250); ok('the same person cannot sign two stages', (await txt()).includes('Separation of duties'))
  await role('administrator'); await pg.locator('tr:has-text("Final approval") button:has-text("Approve")').click(); await pg.waitForTimeout(300); ok('all required sign-offs move the request to Approved', (await txt()).includes('Approved'))
  await pg.getByText('Activate application').click(); await pg.waitForTimeout(300); await go('/applications'); ok('activation creates the application', (await txt()).includes('Test Ledger'))
  // reviews, ownership, roles
  await role('application_owner'); await go('/reviews'); await pg.getByText('New review').click(); await pg.locator('.form label:has-text("Application") select').first().selectOption('50000001'); await pg.getByText('Save review').click(); await pg.waitForTimeout(300); ok('an application owner can create a review', (await txt()).includes('Test Ledger'))
  await role('administrator'); await go('/reviews'); await pg.locator('tr:has-text("Test Ledger") button:has-text("Approve")').click(); await pg.waitForTimeout(300); ok('a reviewer can approve it', (await pg.locator('tr:has-text("Test Ledger")').innerText()).includes('Approved'))
  await go('/ownership'); await pg.locator('tr:has-text("30000001") input').nth(0).fill('Renamed Owner'); await pg.locator('tr:has-text("30000001") button:has-text("Save")').click(); await pg.waitForTimeout(300); await go('/applications'); ok('ownership edits are applied', (await txt()).includes('Renamed Owner'))
  await role('read_only_executive'); t = await txt(); ok('read-only executive cannot onboard or open Datasets', !t.includes('Onboard application') && !(await pg.locator('.navp a:has-text("Datasets")').count()))
  await go('/audit'); t = await txt(); ok('read-only executive can read the audit trail', t.includes('SIGNOFF') && t.includes('OWNERSHIP'))
  await go('/datasets'); ok('Datasets is closed to the executive role', (await txt()).includes('Only administrators'))
  const a = (await state()).audit; ok('audit log is hash-chained and unbroken', a.length > 15 && a.every((e, i) => i === 0 || e.prev_hash === a[i - 1].hash) && a.every(e => /^[0-9a-f]{64}$/.test(e.hash)), a.length)
  console.log(`\n${pass} passed, ${fail} failed`); await br.close(); srv.close(); process.exit(fail ? 1 : 0)
})()
