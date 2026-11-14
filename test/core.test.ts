import { readFileSync } from 'node:fs'
import { analyseWorkbook } from '../src/core/dataset'
import { componentStatus, rollup, setToday } from '../src/core/lifecycle'
import { sha256 } from '../src/core/sha256'
const oracle = JSON.parse(readFileSync('test/oracle.json', 'utf8')); let pass = 0, fail = 0
const ok = (n: string, c: boolean, x = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + x)) }
const eq = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b)
const T = '2026-11-13'; setToday(T)
;(async () => {
  for (const k of Object.keys(oracle)) {
    const buf = readFileSync(`test/fixtures/${k}.xlsx`), r: any = await analyseWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), T), o = oracle[k]
    const errs = r.errors.map((e: any) => [e.sheet, e.row, e.id, e.message]), warns = r.warnings.map((e: any) => [e.sheet, e.row, e.id, e.message])
    ok(`parity ${k}: ok flag`, r.ok === o.ok); ok(`parity ${k}: errors identical`, eq(errs, o.errors), JSON.stringify([errs, o.errors]).slice(0, 400)); ok(`parity ${k}: warnings identical`, eq(warns, o.warnings), JSON.stringify([warns, o.warnings]).slice(0, 400))
    if (o.summary) { ok(`parity ${k}: statuses by row`, eq(Object.fromEntries((r.components || []).map((c: any) => [c.id, c.status])), o.status)); ok(`parity ${k}: totals and apps`, eq(r.summary.statuses, o.summary) && eq(r.applications.map((a: any) => a.app_id), o.apps)); ok(`parity ${k}: quality counts`, eq(Object.fromEntries(Object.entries(r.quality).map(([q, v]: any) => [q, v.length])), o.quality)) }
  }
  ok('lifecycle bands', componentStatus('2029-01-01') === 'GREEN' && componentStatus('2028-05-01') === 'AMBER' && componentStatus('2026-01-01') === 'RED' && componentStatus(null) === 'AMBER')
  ok('extended only changes red', componentStatus('2026-01-01', true) === 'BLUE' && componentStatus('2026-01-01', true, null, T, 18, 'FREE') === 'GREEN' && componentStatus('2028-05-01', true) === 'AMBER' && componentStatus('2029-01-01', true) === 'GREEN' && componentStatus('2026-01-01', true, '2026-06-01') === 'RED')
  ok('rollup: BLUE never hides RED', rollup(['GREEN', 'BLUE', 'RED']) === 'RED' && rollup(['GREEN', 'BLUE']) === 'BLUE')
  ok('sha256 matches the standard test vectors', sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' && sha256('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
})()
