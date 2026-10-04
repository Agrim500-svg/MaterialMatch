import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { fmt, subscriptFormula, canonicalizeFormula } from '../../utils/formatters'
import { EmptyState, ErrorState, LoadingState } from '../ui'

const QUICK_SEEDS = ['Si', 'GaAs', 'GaN', 'SiC', 'CsPbI3', 'TiO2']

const PROFILES = [
  { id: 'combined', label: 'Composition + properties' },
  { id: 'composition', label: 'Composition only' },
  { id: 'properties', label: 'Properties only' },
]

function ResultRow({ material, seed }) {
  const navigate = useNavigate()
  if (seed) {
    return (
      <tr className="bg-secondary/5 hover:bg-secondary/10 transition-colors">
        <td className="py-3.5 px-space-md whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="px-1.5 py-0.5 text-[10px] font-label-code bg-secondary text-on-secondary rounded">SEED</span>
          </div>
        </td>
        <td className="py-3.5 px-space-md font-metric-val text-base font-bold text-on-surface">
          {subscriptFormula(material.formula)}
          <span className="block text-[11px] font-label-code text-on-surface-variant font-normal">
            {material.material_id || 'query reference'}
          </span>
        </td>
        <td className="py-3.5 px-space-md"><ClassBadge value={material.is_metal} /></td>
        <td className="py-3.5 px-space-md text-right font-metric-val text-sm text-outline-variant">N/A</td>
        <td className="py-3.5 px-space-md text-right font-metric-val text-sm text-outline-variant">N/A</td>
        <td className="py-3.5 px-space-md text-right font-metric-val text-sm text-outline-variant">N/A</td>
        <td className="py-3.5 px-space-md text-center">
          <ActionButton onNavigate={() => navigate(`/analyze/${encodeURIComponent(material.formula)}`)} />
        </td>
      </tr>
    )
  }

  const score = material.similarity_score
  const scorePct = score != null ? Math.round(score * 100) : null
  const barColor = scorePct != null && scorePct >= 90 ? 'bg-on-tertiary-container' : scorePct != null && scorePct >= 80 ? 'bg-secondary' : 'bg-secondary-container'

  return (
    <tr className="hover:bg-surface-container-low transition-colors">
      <td className="py-3.5 px-space-md whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 bg-surface-container rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${scorePct ?? 0}%` }} />
          </div>
          <span className="font-metric-val text-sm text-on-surface font-semibold">{scorePct != null ? `${scorePct}%` : '—'}</span>
        </div>
      </td>
      <td className="py-3.5 px-space-md font-metric-val text-base font-bold text-on-surface">
        {subscriptFormula(material.formula_pretty)}
        <span className="block text-[11px] font-label-code text-on-surface-variant font-normal">
          {material.material_id || '—'}
        </span>
      </td>
      <td className="py-3.5 px-space-md"><ClassBadge value={material.is_metal} /></td>
      <td className="py-3.5 px-space-md text-right font-metric-val text-sm font-semibold text-on-surface">
        {fmt(material.band_gap) ?? 'N/A'} <span className="text-outline-variant font-normal text-xs">eV</span>
      </td>
      <td className="py-3.5 px-space-md text-right font-metric-val text-sm text-on-surface">
        {fmt(material.density) ?? 'N/A'} <span className="text-outline-variant font-normal text-xs">g/cm³</span>
      </td>
      <td className="py-3.5 px-space-md text-right font-metric-val text-sm text-on-surface">
        {fmt(material.formation_energy_per_atom) ?? 'N/A'} <span className="text-outline-variant font-normal text-xs">eV/at</span>
      </td>
      <td className="py-3.5 px-space-md text-center">
        <ActionButton onNavigate={() => navigate(`/analyze/${encodeURIComponent(material.formula_pretty)}`)} />
      </td>
    </tr>
  )
}

function ClassBadge({ value }) {
  if (value == null) return <span className="text-xs font-label-code text-on-surface-variant">—</span>
  const metal = value === true || value === 'True' || value === 'true'
  const metalBg = metal ? 'bg-surface-container-highest text-on-surface' : 'bg-surface-container text-on-surface-variant'
  return (
    <span className={`px-2 py-1 rounded font-label-code text-label-code ${metalBg}`}>
      {metal ? 'Metal' : 'Non-Metal'}
    </span>
  )
}

function ActionButton({ onNavigate }) {
  return (
    <button
      onClick={onNavigate}
      className="inline-flex items-center gap-1 px-3 py-1 rounded bg-surface-container-low text-on-surface hover:bg-primary hover:text-on-primary font-label-ui text-label-ui transition-colors"
    >
      <span>Analyze</span>
      <span className="material-symbols-outlined text-[14px]">insights</span>
    </button>
  )
}

function exportCsv(result) {
  if (!result?.results?.length) return
  const rows = [
    ['rank', 'material_id', 'formula', 'class', 'band_gap_eV', 'density_g_cm3', 'formation_energy_eV_per_atom', 'similarity_score', 'shared_elements'],
    ...(result.results || []).map((m, i) => [
      i + 1,
      m.material_id ?? '',
      m.formula_pretty ?? '',
      m.is_metal == null ? '' : (m.is_metal === true || m.is_metal === 'True' || m.is_metal === 'true' ? 'metal' : 'non-metal'),
      m.band_gap ?? '',
      m.density ?? '',
      m.formation_energy_per_atom ?? '',
      m.similarity_score ?? '',
      m.shared_elements ?? '',
    ]),
  ]
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `similar_to_${result.query || 'query'}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function SimilarityPanel() {
  const [formula, setFormula] = useState('Si')
  const [profile, setProfile] = useState('combined')
  const [k, setK] = useState(6)
  const [state, setState] = useState({ loading: false, error: null, result: null })

  const search = async (query = formula) => {
    const trimmed = String(query).trim()
    if (!trimmed) return
    const canonical = canonicalizeFormula(trimmed)
    setFormula(canonical)
    setState({ loading: true, error: null, result: null })
    try {
      const result = await api.similar(canonical, profile, k)
      setState({ loading: false, error: null, result })
    } catch (error) {
      setState({ loading: false, error, result: null })
    }
  }

  return (
    <section className="w-full flex flex-col gap-space-lg">
      {/* Query toolbar */}
      <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-space-lg shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-space-md">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              search()
            }}
            className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <div className="relative flex-1 flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-secondary pointer-events-none text-[20px]">travel_explore</span>
              <input
                className="w-full pl-11 pr-3 py-2.5 sm:py-3 bg-surface-container-low text-on-surface font-label-code text-sm sm:text-[15px] font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all"
                placeholder="Enter formula (e.g. Si, GaAs, CsPbI3)..."
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <select
                value={k}
                onChange={(e) => setK(Number(e.target.value))}
                aria-label="Number of neighbors"
                className="px-2.5 py-2 rounded-lg bg-surface-container text-xs font-label-code text-on-surface-variant focus:outline-none cursor-pointer border border-outline-variant/30"
              >
                {[6, 10, 20].map((n) => (
                  <option key={n} value={n}>k={n} NN</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={state.loading}
                className="h-9 px-3.5 rounded-lg bg-primary text-on-primary font-label-ui text-xs sm:text-label-ui hover:bg-on-primary-fixed transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <span>Find Similar</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </form>
          <div className="flex flex-wrap items-center gap-space-sm pt-2 lg:pt-0">
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-low rounded-lg">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">tune</span>
              <label className="font-label-code text-label-code text-on-surface-variant whitespace-nowrap">Similarity profile:</label>
              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                className="bg-transparent font-label-code text-label-code text-on-surface font-medium focus:outline-none cursor-pointer"
              >
                {PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick seeds */}
        <div className="flex items-center gap-2 mt-space-sm pt-space-xs overflow-x-auto">
          <span className="font-label-code text-[11px] text-on-surface-variant uppercase tracking-wider shrink-0">Quick Seeds:</span>
          {QUICK_SEEDS.map((seed) => (
            <button
              key={seed}
              onClick={() => search(seed)}
              className={`px-2.5 py-1 rounded font-label-code text-label-code transition-colors ${
                formula === seed && state.result
                  ? 'bg-secondary/10 text-secondary hover:bg-secondary/20'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
              }`}
            >
              {subscriptFormula(seed)}
            </button>
          ))}
        </div>
      </div>

      {state.loading && <LoadingState label="Searching similar materials…" />}
      {state.error && <ErrorState error={state.error} onRetry={() => search()} />}

      {state.result && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* Results table */}
          <div className="lg:col-span-8 flex flex-col bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
            <div className="px-3 sm:px-space-md py-space-sm bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-base sm:text-headline-sm text-on-surface">Nearest Latent Neighbors</span>
                <span className="font-label-code text-[11px] sm:text-label-code px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                  Top {state.result.results?.length ?? 0} Ranked
                </span>
              </div>
              <span className="font-label-code text-[11px] sm:text-label-code text-on-surface-variant">
                Metric: {state.result.profile} blend
              </span>
            </div>
            <div className="overflow-x-auto">
              {state.result.results?.length ? (
                <table className="w-full text-left font-body-md text-body-md border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high/40 text-on-surface-variant font-label-code text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-space-md" title="Relative similarity, not a probability">Rank / Match</th>
                      <th className="py-3 px-space-md">Formula</th>
                      <th className="py-3 px-space-md">Class</th>
                      <th className="py-3 px-space-md text-right">Band Gap</th>
                      <th className="py-3 px-space-md text-right">Density</th>
                      <th className="py-3 px-space-md text-right">Formation Energy</th>
                      <th className="py-3 px-space-md text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low">
                    <ResultRow
                      seed
                      material={{ formula: state.result.query, material_id: state.result.results?.[0]?.reference_material_id }}
                    />
                    {state.result.results.map((m, i) => (
                      <ResultRow key={m.material_id || i} material={m} />
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title="No similar materials found" hint="The local index is a 10,000-record sample." />
              )}
            </div>
            <div className="p-3 sm:p-space-md bg-surface-container-low/50 flex flex-col sm:flex-row items-start sm:items-center justify-between text-on-surface-variant font-label-code text-[11px] sm:text-label-code gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-on-tertiary-container shrink-0" />
                <span className="break-words">Local index: 10,000 Records • {state.result.score_note}</span>
              </div>
              <button
                onClick={() => exportCsv(state.result)}
                className="hover:text-on-surface flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
              >
                <span>Export results (CSV)</span>
                <span className="material-symbols-outlined text-[14px]">download</span>
              </button>
            </div>
          </div>

          {/* Right rail: seed insight card */}
          <SeedRail query={state.result.query} result={state.result} />
        </div>
      )}

      {!state.loading && !state.error && !state.result && (
        <EmptyState title="Search for similar materials" hint="Enter a formula above or pick a quick seed to start." />
      )}
    </section>
  )
}

// Live values for the chosen seed come from the real prediction endpoints —
// no fabricated properties.
function SeedRail({ query, result }) {
  const [pred, setPred] = useState({ data: null, error: null })

  useEffect(() => {
    if (!query) return
    let cancelled = false
    api
      .predict(query, 'all')
      .then((data) => {
        if (!cancelled) setPred({ data, error: null })
      })
      .catch((error) => {
        if (!cancelled) setPred({ data: null, error })
      })
    return () => {
      cancelled = true
    }
  }, [query])

  const predictions = pred.data?.predictions
  const bandGap = predictions?.band_gap
  const fe = predictions?.formation_energy_per_atom
  const density = predictions?.density
  const type = predictions?.material_type

  const cell = (label, value, unit, tone = 'text-on-surface') => (
    <div className="flex flex-col">
      <span className="font-label-code text-[10px] uppercase text-on-surface-variant">{label}</span>
      <span className={`font-metric-val text-metric-val ${tone}`}>
        {value ?? 'N/A'} {unit && <span className="font-metric-unit text-metric-unit text-on-surface-variant">{unit}</span>}
      </span>
    </div>
  )

  return (
    <div className="lg:col-span-4 flex flex-col gap-space-md">
      <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
        <div className="flex items-center justify-between pb-space-sm">
          <span className="font-label-code text-label-code uppercase tracking-wider text-on-surface-variant">Reference Anchor</span>
          {type?.material_type && (
            <span className={`px-2 py-0.5 rounded-full font-label-code text-[11px] font-semibold ${type.material_type === 'Metal' ? 'bg-surface-container-highest text-on-surface' : 'bg-tertiary-fixed text-on-tertiary-fixed'}`}>
              {type.material_type}
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <div>
            <h2 className="font-display text-4xl text-on-surface font-bold">{subscriptFormula(query)}</h2>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {result?.results?.[0]?.reference_material_id || 'query material'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-space-md pt-space-sm bg-surface-container-low p-space-sm rounded-lg">
          {cell('Band Gap (ML)', bandGap?.value != null ? bandGap.value.toFixed(2) : null, 'eV', 'text-secondary')}
          {cell('Material Type', type?.material_type ?? null, type?.classification_probability != null ? `${(type.classification_probability * 100).toFixed(0)}% conf.` : null)}
          {cell('Formation Energy (ML)', fe?.value != null ? fe.value.toFixed(2) : null, 'eV/at', fe?.value != null && fe.value < 0 ? 'text-on-tertiary-container' : 'text-on-surface')}
          {cell('Density (ML)', density?.value != null ? density.value.toFixed(2) : null, 'g/cm³')}
        </div>
      </div>

      <div className="bg-surface-container-high/40 rounded-xl p-space-md">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">auto_awesome</span>
          <span className="font-headline-sm text-sm text-on-surface font-semibold">Similarity Search Methodology</span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          Candidates are prioritized by a {result?.profile ?? 'combined'} blend of element-fraction cosine
          similarity and standardized descriptor Euclidean distance over the 10,000-record Materials
          Project sample. Scores are relative, not probabilities.
        </p>
      </div>
    </div>
  )
}
