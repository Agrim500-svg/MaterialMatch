import { Link } from 'react-router-dom'
import { fmt, subscriptFormula } from '../../utils/formatters'

function truthy(v) {
  return v === true || v === 'True' || v === 'true'
}

// Material card tuned to the assistant material card pattern:
// formula + stability chip + 2x2 metrics + material id + Analyze link.
function MaterialResultCard({ m }) {
  const formula = m.formula_pretty || m.formula || '—'
  const stable = m.is_stable != null ? truthy(m.is_stable) : null
  const metrics = [
    ['Band Gap', fmt(m.band_gap), 'eV'],
    ['Density', fmt(m.density), 'g/cm³'],
    ['ΔEf', fmt(m.formation_energy_per_atom ?? m.predicted_formation_energy_eV_per_atom), 'eV/at'],
    ['Type', m.is_metal != null ? (truthy(m.is_metal) ? 'Metal' : 'Non-Metal') : null, ''],
  ]
  return (
    <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col justify-between hover:shadow-lg transition-shadow">
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center justify-between">
          <span className="font-label-code text-metric-val text-on-surface font-bold">{subscriptFormula(formula)}</span>
          {stable != null && (
            <span className={`px-2 py-0.5 rounded-full bg-surface-container font-label-code text-label-code flex items-center gap-1 ${stable ? 'text-on-tertiary-container' : 'text-amber-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stable ? 'bg-on-tertiary-container' : 'bg-amber-600'}`} />
              {stable ? 'Stable' : 'Metastable'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 bg-surface-container-low/60 p-2.5 rounded-lg">
          {metrics.map(([label, value, unit]) => (
            <div key={label} className="flex flex-col">
              <span className="font-label-code text-label-code text-on-surface-variant uppercase">{label}</span>
              <span className="font-metric-val text-base sm:text-headline-sm text-on-surface">
                {value ?? 'N/A'} {unit && value != null && <span className="font-metric-unit text-metric-unit text-on-surface-variant">{unit}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="pt-space-md flex items-center justify-between">
        <span className="font-label-code text-label-code text-on-surface-variant">{m.material_id ?? '—'}</span>
        <Link
          className="inline-flex items-center gap-1 font-label-ui text-label-ui text-secondary font-semibold hover:underline"
          to={`/analyze/${encodeURIComponent(formula)}`}
        >
          Analyze Material
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    </div>
  )
}

// Summary chips + analysis CTA for prediction/discovery answers (real values only).
function PredictionStrip({ predictions, formula }) {
  if (!predictions) return null
  const chips = [
    ['Type', predictions.material_type?.material_type],
    ['Eg', predictions.band_gap?.value != null ? `${predictions.band_gap.value.toFixed(2)} eV` : null],
    ['Density', predictions.density?.value != null ? `${predictions.density.value.toFixed(2)} g/cm³` : null],
    ['ΔEf', predictions.formation_energy_per_atom?.value != null ? `${predictions.formation_energy_per_atom.value.toFixed(2)} eV/atom` : null],
  ].filter(([, v]) => v != null)
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-space-sm pt-space-xs">
      {chips.map(([label, value]) => (
        <div key={label} className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-surface-container-high text-on-surface font-label-code text-xs sm:text-label-code flex items-center gap-1.5 shadow-sm">
          <span className="text-on-surface-variant">{label}:</span>
          <span className="font-semibold">{value}</span>
        </div>
      ))}
      {formula && (
        <Link
          className="w-full sm:w-auto sm:ml-auto inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary font-label-ui text-xs sm:text-label-ui px-3.5 sm:px-4 py-2 rounded-lg hover:bg-on-primary-fixed-variant transition-colors shadow-sm"
          to={`/analyze/${encodeURIComponent(formula)}`}
        >
          <span>Open Analysis Page</span>
          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
        </Link>
      )}
    </div>
  )
}

// Renders structured engine data from a chat turn as real cards.
export default function EngineBlocks({ engine }) {
  if (!engine?.result) return null
  const r = engine.result

  if (r.ranked_candidates?.length) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md pt-space-xs">
        {r.ranked_candidates.slice(0, 3).map((m) => (
          <MaterialResultCard key={m.material_id} m={m} />
        ))}
      </div>
    )
  }
  if (r.similar_materials?.length || r.results?.length) {
    const list = (r.similar_materials || r.results).slice(0, 3)
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md pt-space-xs">
        {list.map((m, i) => (
          <MaterialResultCard key={m.material_id || i} m={m} />
        ))}
      </div>
    )
  }
  if (r.predictions || (r.prediction && r.resolved_formula)) {
    const predictions = r.predictions ?? { [r.prediction.target]: r.prediction }
    return <PredictionStrip predictions={predictions} formula={r.resolved_formula || r.resolved_reference?.formula_pretty} />
  }
  return null
}
