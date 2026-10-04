import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { fetchHealth } from '../api/client'
import { canonicalizeFormula } from '../utils/formatters'

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/explore', label: 'Explore' },
  { to: '/candidates', label: 'Candidates' },
  { to: '/assistant', label: 'AI Assistant' },
]

function LogoMark({ className = 'h-8' }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-lg bg-primary-container ${className} aspect-square`}>
      <span className="material-symbols-outlined text-[18px] text-secondary-container">deployed_code</span>
    </span>
  )
}

function HeaderSearch() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  return (
    <div className="relative hidden md:flex items-center">
      <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px] pointer-events-none">
        search
      </span>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          const trimmed = query.trim()
          if (e.key === 'Enter' && trimmed) {
            const target = canonicalizeFormula(trimmed)
            navigate(`/analyze/${encodeURIComponent(target)}`)
            setQuery('')
          }
        }}
        className="w-64 lg:w-72 pl-9 pr-space-md py-1.5 bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-label-code text-label-code rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-secondary transition-all"
        placeholder="Search formula (e.g. Si, GaN)..."
        type="text"
        aria-label="Search materials formula"
      />
    </div>
  )
}

function BackendStatusChip() {
  const [online, setOnline] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchHealth().then((ok) => {
      if (!cancelled) setOnline(ok)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const label = online == null ? 'Connecting…' : online ? 'v1.0.4 ML-Model' : 'Backend offline'
  const dot = online ? 'bg-secondary animate-pulse' : 'bg-error'
  const textTone = online ? 'text-secondary' : online === false ? 'text-error font-semibold' : 'text-on-surface-variant'
  return (
    <div className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low ${textTone} font-label-code text-label-code`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </div>
  )
}

export default function Layout({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen flex flex-col justify-between bg-surface">
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/90 backdrop-blur-md sm:backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] transform-gpu">
        <div className="h-16 w-full max-w-[1600px] mx-auto px-3 sm:px-6 md:px-12 flex items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-lg shrink-0 min-w-0">
            <Link to="/" className="flex items-center gap-space-sm min-w-0" aria-label="MaterialMatch home">
              <LogoMark />
              <div className="flex flex-col min-w-0">
                <span className="font-headline-sm text-base sm:text-headline-sm text-on-surface leading-none tracking-tight">
                  MaterialMatch
                </span>
                <span className="font-label-code text-[10px] sm:text-label-code text-on-surface-variant uppercase tracking-wider mt-0.5 truncate max-w-[130px] sm:max-w-none">
                  AI-Powered Materials Discovery
                </span>
              </div>
            </Link>
            <nav className="hidden xl:flex items-center gap-space-xs ml-space-md">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `px-space-sm py-space-xs transition-colors rounded-lg font-label-ui text-label-ui ${
                      isActive
                        ? 'bg-primary-container text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-space-md justify-end shrink-0">
            <HeaderSearch />
            <BackendStatusChip />
            <button
              className="xl:hidden rounded-lg border border-outline-variant/40 p-2 text-on-surface-variant hover:bg-surface-container cursor-pointer"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation menu"
            >
              <span className="material-symbols-outlined text-[20px] block">{open ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>
        {open && (
          <nav className="xl:hidden border-t border-outline-variant/30 px-4 py-space-sm space-y-1 bg-surface-container-lowest/95 shadow-md">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-space-sm py-2 font-label-ui ${
                    isActive ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 md:px-12 pt-16 flex-1 bg-surface">{children}</main>

      <footer className="w-full bg-surface-container-low mt-space-xl">
        <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 md:px-12 py-space-xl">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-space-xl pb-space-lg">
            <div className="md:col-span-5 flex flex-col gap-space-sm">
              <div className="flex items-center gap-space-sm">
                <LogoMark className="h-7" />
                <span className="font-headline-sm text-headline-sm text-on-surface leading-none">MaterialMatch</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                AI-powered materials discovery platform for computational screening and materials intelligence.
              </p>
              <div className="flex items-center gap-2 mt-space-xs">
                <span className="w-2 h-2 rounded-full bg-on-tertiary-container" />
                <span className="font-label-code text-label-code text-on-surface-variant">
                  Backend + 4 ML models served locally by the FastAPI service
                </span>
              </div>
            </div>
            <div className="md:col-span-3 flex flex-col gap-space-sm">
              <span className="font-label-ui text-label-ui uppercase tracking-wider text-on-surface">Quick Links</span>
              <ul className="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
                <li><Link className="hover:text-on-surface transition-colors" to="/">Home / Discover</Link></li>
                <li><Link className="hover:text-on-surface transition-colors" to="/explore">Explore Materials</Link></li>
                <li><Link className="hover:text-on-surface transition-colors" to="/candidates">Candidate Discovery</Link></li>
                <li><Link className="hover:text-on-surface transition-colors" to="/assistant">AI Assistant</Link></li>
              </ul>
            </div>
            <div className="md:col-span-4 flex flex-col gap-space-sm">
              <span className="font-label-ui text-label-ui uppercase tracking-wider text-on-surface">Methodology &amp; Validation</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Predictions are machine-learning based screening estimates over a 10,000-record Materials
                Project sample and should be validated with experimental or ab initio density functional
                theory (DFT) methods.
              </p>
            </div>
          </div>
          <div className="pt-space-md border-t border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-space-sm">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              © 2026 MaterialMatch Platform-Agrim Karmakar
            </p>
            <div className="flex items-center gap-space-md font-label-code text-label-code text-on-surface-variant">
              <span>MP release 2026.04.13</span>
              <span>ML estimates only</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
