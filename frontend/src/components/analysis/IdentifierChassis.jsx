import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ELEMENT_DATA, subscriptFormula, parseFormulaParts } from '../../utils/formatters'

function MetaPill({ label, value, unit, accent }) {
  return (
    <div className="bg-surface-container-low px-2.5 sm:px-3 py-2 rounded-lg min-w-0 overflow-hidden">
      <span className="block font-label-code text-[10px] text-on-surface-variant uppercase truncate">{label}</span>
      <span className="font-metric-val text-xs sm:text-body-md font-semibold text-on-surface block truncate" title={typeof value === 'string' ? value : undefined}>
        {value ?? 'N/A'}{' '}
        {unit && <span className="font-metric-unit text-[10px] sm:text-metric-unit text-on-surface-variant font-normal">{unit}</span>}
        {accent}
      </span>
    </div>
  )
}

export default function IdentifierChassis({ formula, data, onReanalyze }) {
  const [copied, setCopied] = useState(false)
  const reference = data?.resolved_reference
  const predictions = data?.ml_prediction

  const displayFormula = reference?.formula_pretty || formula
  const parts = parseFormulaParts(displayFormula)

  const single = parts && parts.length === 1 ? parts[0] : null
  const z = single ? ELEMENT_DATA[single.element]?.[0] : null
  const molarMass = parts
    ? parts.reduce((sum, p) => sum + (ELEMENT_DATA[p.element]?.[1] ?? 0) * p.amount, 0)
    : null
  const elementSummary = parts
    ?.map(
      (p) =>
        `${p.element}${
          p.amount !== 1
            ? ` (${((p.amount / parts.reduce((s, x) => s + x.amount, 0)) * 100) | 0}%)`
            : ' (100%)'
        }`,
    )
    .join(', ')

  const materialType = predictions?.material_type?.material_type
  const bandGap = predictions?.band_gap?.value
  const subtitle =
    [
      materialType ? `Classified: ${materialType}` : null,
      bandGap != null ? `Predicted band gap: ${bandGap.toFixed(2)} eV` : null,
    ]
      .filter(Boolean)
      .join(' • ') || 'Analysis pending'

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const exportJson = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${String(displayFormula).replace(/\s/g, '')}_screening.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="w-full pb-space-lg">
      {/* Breadcrumbs + metadata */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-sm text-on-surface-variant font-label-code text-xs sm:text-label-code min-w-0">
        <div className="flex items-center gap-space-xs flex-wrap min-w-0">
          <Link className="hover:text-on-surface transition-colors flex items-center gap-1" to="/">
            <span className="material-symbols-outlined text-[15px]">home</span>
            <span>Home</span>
          </Link>
          <span>/</span>
          <span className="hover:text-on-surface transition-colors">Material Analysis</span>
          <span>/</span>
          <span className="text-on-surface font-semibold truncate max-w-[200px] sm:max-w-none">
            {subscriptFormula(displayFormula)}
            {reference?.material_id ? ` (${reference.material_id})` : ''}
          </span>
        </div>
        <div className="flex items-center gap-space-md shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[11px] sm:text-label-code">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
            <span>DFT Ref: Materials Project {reference ? '2026.04.13 sample' : 'sample'}</span>
          </span>
        </div>
      </div>

      {/* Identifier chassis card */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-4 sm:p-space-lg flex flex-col xl:flex-row xl:items-center justify-between gap-space-md sm:gap-space-lg min-w-0">
        <div className="flex flex-col md:flex-row md:items-center gap-space-md min-w-0">
          <div className="flex items-center gap-space-md min-w-0">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-primary-container text-on-primary flex flex-col items-center justify-center shadow-md relative overflow-hidden shrink-0">
              <span className="material-symbols-outlined absolute -bottom-3 -right-3 text-on-primary/10 text-[64px] pointer-events-none">
                view_in_ar
              </span>
              <span className="font-headline-lg text-2xl sm:text-headline-lg font-bold tracking-tight text-white leading-none">
                {parts && parts.length === 1 ? parts[0].element : String(displayFormula).slice(0, 4)}
              </span>
              {z != null && (
                <span className="font-label-code text-[10px] text-secondary-fixed uppercase tracking-wider mt-1">
                  Z = {z}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-space-xs flex-wrap min-w-0">
                <h1 className="font-display text-2xl sm:text-headline-lg text-on-surface leading-tight font-bold break-words">
                  {subscriptFormula(displayFormula)}
                </h1>
                {materialType && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-code text-label-code font-semibold ${
                      materialType === 'Metal'
                        ? 'bg-surface-container-highest text-on-surface'
                        : 'bg-tertiary-fixed text-on-tertiary-fixed'
                    }`}
                  >
                    {materialType === 'Metal' ? 'Metal' : 'Non-Metal'}
                  </span>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 break-words">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Right side: 4 metadata pills + action buttons */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-space-md min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0">
            <MetaPill
              label="Formula Wt"
              value={molarMass != null ? molarMass.toFixed(3) : null}
              unit={molarMass != null ? 'g/mol' : null}
            />
            <MetaPill label="Space Group" value={reference ? 'N/A' : null} />
            <MetaPill label="Crystal Sys" value={reference ? 'N/A' : null} />
            <MetaPill label="Elements" value={elementSummary || null} />
          </div>

          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-space-xs shrink-0 pt-2 lg:pt-0">
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-ui text-xs sm:text-label-ui transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">ios_share</span>
              <span>{copied ? 'Copied!' : 'Share'}</span>
            </button>
            <button
              type="button"
              onClick={exportJson}
              disabled={!data}
              className="inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-ui text-xs sm:text-label-ui transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">download</span>
              <span>JSON</span>
            </button>
            <button
              type="button"
              onClick={onReanalyze}
              className="inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-lg bg-primary-container text-on-primary hover:opacity-95 font-label-ui text-xs sm:text-label-ui transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">autorenew</span>
              <span>Re-run</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
