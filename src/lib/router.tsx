// A small hash-based router: GitHub Pages cannot rewrite deep links, so every route lives after the #.
import { createContext, createElement as h, useContext, useEffect, useSyncExternalStore, Children } from 'react'
const sub = (cb: () => void) => { addEventListener('hashchange', cb); return () => removeEventListener('hashchange', cb) }
const cur = () => location.hash.replace(/^#/, '') || '/'
const push = (to: any) => { location.hash = String(to) }
export function useLocation() { const s = useSyncExternalStore(sub, cur); const i = s.indexOf('?'); return { pathname: i < 0 ? s : s.slice(0, i), search: i < 0 ? '' : s.slice(i) } }
export const useNavigate = () => push
export function useSearchParams(): [URLSearchParams, (n: any) => void] { const { search } = useLocation(); return [new URLSearchParams(search), n => push(location.hash.replace(/^#/, '').split('?')[0] + (String(n) ? '?' + n : ''))] }
const PC = createContext<any>({}); export const useParams = () => useContext(PC)
function match(pat: string, path: string) {
  if (pat === '*') return {}; const a = pat.split('/').filter(Boolean), b = path.split('/').filter(Boolean); if (a.length !== b.length) return null
  const p: any = {}; for (let i = 0; i < a.length; i++) { if (a[i][0] === ':') p[a[i].slice(1)] = decodeURIComponent(b[i]); else if (a[i] !== b[i]) return null } return p
}
export const Route = (_: any) => null
export function Routes({ children }: any) { const { pathname } = useLocation(); for (const r of Children.toArray(children) as any[]) { const p = match(r.props.path, pathname); if (p) return h(PC.Provider, { value: p }, r.props.element) } return null }
export const Link = ({ to, children, ...r }: any) => h('a', { href: '#' + to, ...r }, children)
export function NavLink({ to, end, className, children }: any) { const { pathname } = useLocation(); const on = end ? pathname === to : pathname.startsWith(to); return h('a', { href: '#' + to, className: typeof className === 'function' ? className({ isActive: on }) : className }, children) }
export function Navigate({ to }: any) { useEffect(() => { location.replace('#' + to) }, []); return null }
export const BrowserRouter = ({ children }: any) => children
export const HashRouter = BrowserRouter
