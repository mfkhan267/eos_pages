// Minimal .xlsx reader with no dependencies: unzip with DecompressionStream, then read the sheet XML.
const dec = new TextDecoder()
const unxml = (s: string) => s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_, e) => e === 'amp' ? '&' : e === 'lt' ? '<' : e === 'gt' ? '>' : e === 'quot' ? '"' : e === 'apos' ? "'" : String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)))
async function inflate(raw: Uint8Array) { return new Uint8Array(await new Response(new Blob([raw as any]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) }

async function unzip(buf: ArrayBuffer): Promise<Record<string, string>> {
  const u = new Uint8Array(buf), v = new DataView(buf); let e = u.length - 22
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--
  if (e < 0) throw new Error('not a zip')
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const out: Record<string, string> = {}
  for (let i = 0; i < n; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('bad zip directory')
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true)
    const name = dec.decode(u.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl
    if (!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(name)) continue
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), raw = u.subarray(start, start + csize)
    out[name] = dec.decode(method === 0 ? raw : await inflate(raw))
  }
  return out
}
const attr = (s: string, k: string) => { const m = new RegExp(`\\b${k}="([^"]*)"`).exec(s); return m ? unxml(m[1]) : null }
const colIndex = (ref: string) => { let n = 0; for (const ch of ref.replace(/[0-9]/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1 }
const serialToIso = (n: number) => new Date(Math.round((n - 25569) * 864e5)).toISOString().slice(0, 10)
const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

export type Sheet = { name: string; rows: any[][] }
/** Reads every worksheet. Date cells come back as ISO strings; numbers as numbers; blanks as null. */
export async function readXlsx(buf: ArrayBuffer): Promise<Sheet[]> {
  const z = await unzip(buf); const wb = z['xl/workbook.xml']; if (!wb) throw new Error('not a workbook')
  const rels: Record<string, string> = {}; for (const m of (z['xl/_rels/workbook.xml.rels'] || '').matchAll(/<Relationship\b[^>]*>/g)) { const id = attr(m[0], 'Id'), t = attr(m[0], 'Target'); if (id && t) rels[id] = t.replace(/^\/?(xl\/)?/, 'xl/') }
  const shared: string[] = []; for (const m of (z['xl/sharedStrings.xml'] || '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) shared.push(unxml([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')))
  const fmts: Record<number, string> = {}; const styles = z['xl/styles.xml'] || ''
  for (const m of styles.matchAll(/<numFmt\b[^>]*>/g)) fmts[Number(attr(m[0], 'numFmtId'))] = attr(m[0], 'formatCode') || ''
  const xfs = (/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1].match(/<xf\b[^>]*>/g) || []).map(x => Number(attr(x, 'numFmtId')))
  const isDate = (s: number) => { const id = xfs[s]; return BUILTIN_DATE.has(id) || (id >= 164 && /[dmyh]/i.test((fmts[id] || '').replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')) && !/^general$/i.test(fmts[id] || '')) }
  const out: Sheet[] = []
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], 'name') || '', rid = attr(m[0], 'r:id') || '', xml = z[rels[rid]]; if (!xml) continue
    const rows: any[][] = []
    for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const r = Number(attr(rm[1], 'r')) - 1, row: any[] = rows[r] || []; rows[r] = row
      for (const cm of (rm[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attr(cm[1], 'r') || '', t = attr(cm[1], 't'), s = Number(attr(cm[1], 's') || 0), body = cm[2] || ''
        const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1]; let val: any = null
        if (t === 'inlineStr') val = unxml([...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''))
        else if (v !== undefined) val = t === 's' ? shared[Number(v)] : t === 'b' ? v === '1' : t === 'str' || t === 'e' ? unxml(v) : (isFinite(Number(v)) ? (isDate(s) ? serialToIso(Number(v)) : Number(v)) : unxml(v))
        if (ref) row[colIndex(ref)] = val
      }
    }
    for (let i = 0; i < rows.length; i++) rows[i] = Array.from(rows[i] || [], v => v ?? null)
    out.push({ name, rows })
  }
  return out
}
