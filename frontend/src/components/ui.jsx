export function LoadingState({ label = 'Working…' }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-on-surface shadow-sm">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
      <span className="text-sm font-label-code text-on-surface-variant">{label}</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const message = error?.message || 'Something went wrong.'
  const backendDown = error?.type === 'backend_unavailable'
  return (
    <div className="rounded-xl border border-error-container bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-error">error</span>
        <p className="text-sm font-semibold text-error">
          {backendDown ? 'Backend unavailable' : 'Request failed'}
        </p>
      </div>
      <p className="mt-1 text-sm text-on-surface-variant font-body-sm">{message}</p>
      {backendDown && (
        <p className="mt-2 text-xs font-label-code text-on-surface-variant bg-surface-container-low p-2 rounded">
          Start it with: <code className="font-semibold text-on-surface break-all">.venv\Scripts\python.exe -m uvicorn backend.app:app --port 8000</code>
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-container px-3.5 py-1.5 text-xs font-label-ui text-on-primary hover:opacity-95 transition-all shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">refresh</span>
          <span>Retry</span>
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, hint }) {
  return (
    <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest/70 p-8 text-center shadow-inner">
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      {hint && <p className="mt-1 text-xs text-on-surface-variant font-body-sm">{hint}</p>}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'border-outline-variant/30 bg-surface-container text-on-surface-variant',
    ml: 'border-secondary/30 bg-secondary-fixed/40 text-on-secondary-fixed',
    db: 'border-outline-variant/40 bg-surface-container-high text-on-surface',
    metal: 'border-outline-variant/50 bg-surface-container-highest text-on-surface',
    nonmetal: 'border-tertiary-fixed-dim bg-tertiary-fixed text-on-tertiary-fixed',
    warn: 'border-amber-300 bg-amber-50 text-amber-800',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-label-code ${
        tones[tone] || tones.neutral
      }`}
    >
      {children}
    </span>
  )
}

export function ConfidenceIndicator({ value }) {
  if (value == null || Number.isNaN(value)) return null
  const pct = Math.round(value * 100)
  const low = pct < 67
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs font-label-code">
        <span className="text-on-surface-variant">Model confidence</span>
        <span className="font-semibold text-on-surface">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-surface-container">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${low ? 'bg-amber-500' : 'bg-secondary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {low && <p className="mt-1 text-xs font-label-code text-amber-700">Low-confidence classification</p>}
    </div>
  )
}
