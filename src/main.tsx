import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { init } from './core/store'
import { setToday } from './core/lifecycle'
const t = new URLSearchParams(location.search).get('today')  // optional: ?today=2026-11-13 pins the reporting date, handy for demos and tests
if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) setToday(t)
init()
createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>)
