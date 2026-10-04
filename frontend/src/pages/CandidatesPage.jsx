import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { fmt, subscriptFormula } from '../utils/formatters'
import { EmptyState, ErrorState, LoadingState } from '../components/ui'

const SORTS = [
  { id: 'rank', label: 'Rank (backend default — density first)' },
  { id: 'gap_asc', label: 'Band Gap (Low to High)' },
  { id: 'gap_desc', label: 'Band Gap (High to Low)' },
  { id: 'fe_asc', label: 'ML Formation Energy (Most negative)' },
  { id: 'density_desc', label: 'Density (High to Low)' },
]

function stabilityLabel(isStable) {
  if (isStable === true || isStable === 'True' || isStable === 'true') return 'Stable'
  return 'Metastable'
}

function sortCandidates(rows, sortId) {
  const copy = [...rows]
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : Number.POSITIVE_INFINITY)
  switch (sortId) {
    case 'gap_asc':
      return copy.sort((a, b) => num(a.band_gap) - num(b.band_gap))
    case 'gap_desc':
      return copy.sort((a, b) => num(b.band_gap) - num(a.band_gap))
    case 'fe_asc':
      return copy.sort(
        (a, b) =>
          num(a.predicted_formation_energy_eV_per_atom) - num(b.predicted_formation_energy_eV_per_atom),
      )
    case 'density_desc':
      return copy.sort((a, b) => num(b.density) - num(a.density))
    default:
      return copy.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  }
}

function exportCsv(candidates) {
  if (!candidates?.length) return
  const rows = [
    ['rank', 'material_id', 'formula', 'material_type', 'band_gap_eV', 'density_g_cm3', 'ml_formation_energy_eV_per_atom', 'energy_above_hull_eV_per_atom', 'relative_density_rank_score'],
    ...candidates.map((c) => [
      c.rank, c.material_id, c.formula_pretty, c.is_metal === false || c.is_metal === 'False' ? 'non-metal' : 'metal',
      c.band_gap ?? '', c.density ?? '', c.predicted_formation_energy_eV_per_atom ?? '',
      c.energy_above_hull ?? '', c.relative_density_rank_score ?? '',
    ]),
  ]
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'candidate_screening.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

// Real scatter of returned candidates: density (y) vs band gap (x).
function CandidateScatter({ candidates }) {
  const points = (candidates || []).filter(
    (c) => Number.isFinite(Number(c.band_gap)) && Number.isFinite(Number(c.density)),
  )
  if (!points.length) return null
  const xMax = Math.max(...points.map((p) => Number(p.band_gap))) || 1
  const yMax = Math.max(...points.map((p) => Number(p.density))) || 1
  const x = (v) => 30 + (Number(v) / xMax) * 200
  const y = (v) => 155 - (Number(v) / yMax) * 130
  // top-ranked candidate highlighted in secondary color, others in tertiary
  return (
    <div className="relative w-full h-40 rounded-lg bg-surface-container overflow-hidden">
      <svg className="w-full h-full p-2" fill="none" viewBox="0 0 240 170" xmlns="http://www.w3.org/2000/svg">
        {[30, 70, 110, 150].map((gy) => (
          <line key={gy} stroke="currentColor" className="text-outline-variant/40" strokeDasharray="2 2" x1="25" x2="235" y1={gy} y2={gy} />
        ))}
        {[60, 120, 180].map((gx) => (
          <line key={gx} stroke="currentColor" className="text-outline-variant/40" strokeDasharray="2 2" x1={gx} x2={gx} y1="15" y2="155" />
        ))}
        <line stroke="currentColor" className="text-outline-variant/80" x1="25" x2="235" y1="155" y2="155" />
        <line stroke="currentColor" className="text-outline-variant/80" x1="25" x2="25" y1="15" y2="155" />
        {points.map((p) => (
          <circle
            key={p.material_id}
            className={p.rank === 1 ? 'fill-secondary' : 'fill-on-tertiary-container'}
            cx={x(p.band_gap)}
            cy={y(p.density)}
            r={p.rank === 1 ? 5 : 3}
            fillOpacity={p.rank === 1 ? 1 : 0.7}
          >
            <title>{`${p.formula_pretty} · gap ${fmt(p.band_gap)} eV · density ${fmt(p.density)} g/cm³`}</title>
          </circle>
        ))}
        <text className="fill-on-surface-variant font-mono" fontSize="8" x="28" y="165">band gap →</text>
        <text className="fill-on-surface-variant font-mono" fontSize="8" x="200" y="12">density ↑</text>
      </svg>
      <div className="absolute bottom-2 left-2 font-label-code text-[10px] text-on-surface-variant bg-surface-container-lowest/90 rounded px-1.5 py-0.5">
        {points.length} returned candidates
      </div>
    </div>
  )
}

export default function CandidatesPage() {
  const [k, setK] = useState(20)
  const [sort, setSort] = useState('rank')
  const [classFilter, setClassFilter] = useState('nonmetal')
  const [maxDensity, setMaxDensity] = useState('3.0')
  const [minGap, setMinGap] = useState(0)
  const [maxGap, setMaxGap] = useState(3.0)
  const [stableOnly, setStableOnly] = useState(true)
  const [state, setState] = useState({ loading: true, error: null, result: null })
  const navigate = useNavigate()

  const load = (limit = k, overrides = {}) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    const activeClass = overrides.classFilter ?? classFilter
    const activeDensity = overrides.maxDensity ?? maxDensity
    const activeMinGap = overrides.minGap ?? minGap
    const activeMaxGap = overrides.maxGap ?? maxGap
    const activeStable = overrides.stableOnly ?? stableOnly

    api
      .rank({
        k: limit,
        material_class: activeClass,
        min_gap: activeMinGap,
        max_gap: activeMaxGap,
        max_density: activeDensity === 'all' ? null : Number(activeDensity),
        stable_only: activeStable,
      })
      .then((result) => setState({ loading: false, error: null, result }))
      .catch((error) => setState({ loading: false, error, result: null }))
  }

  useEffect(() => {
    load(k, { classFilter, maxDensity, minGap, maxGap, stableOnly })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, classFilter, maxDensity, minGap, maxGap, stableOnly])

  const resetFilters = () => {
    setClassFilter('nonmetal')
    setMaxDensity('3.0')
    setMinGap(0)
    setMaxGap(3.0)
    setStableOnly(true)
    setSort('rank')
    load(k, {
      classFilter: 'nonmetal',
      maxDensity: '3.0',
      minGap: 0,
      maxGap: 3.0,
      stableOnly: true,
    })
  }

  const summary = state.result?.ranking_summary
  const candidates = useMemo(() => {
    const rows = state.result?.ranked_candidates || []
    return sortCandidates(rows, sort)
  }, [state.result, sort])

  const top = candidates[0]

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="relative w-full py-space-xl overflow-hidden">
        <div className="absolute -top-24 right-1/4 w-96 h-96 rounded-full bg-secondary/5 blur-3xl pointer-events-none" />
        <div className="absolute top-8 left-10 w-72 h-72 rounded-full bg-tertiary-fixed-dim/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md relative z-10">
          <div className="space-y-space-xs max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant">
              <span className="material-symbols-outlined text-[15px] text-secondary">tune</span>
              <span className="font-label-code text-label-code uppercase tracking-wider">Candidate Discovery Workflow</span>
              <span className="w-1 h-1 rounded-full bg-outline" />
              <span className="font-label-code text-label-code text-on-tertiary-container">Density-First Ranking</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Candidate Discovery</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
              Screen and rank materials from the 10,000-record sample. The default benchmark targets lightweight stable semiconductors, and filters can be tuned below.
            </p>
          </div>
          {summary && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-space-sm shrink-0 font-label-code text-label-code">
              <div className="bg-surface-container-lowest px-3 py-2 sm:px-space-md sm:py-2.5 rounded-xl shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-on-tertiary-container animate-ping" />
                <span className="text-on-surface-variant">Database Space:</span>
                <span className="font-metric-val text-sm sm:text-metric-val text-on-surface">
                  {summary.rows_input?.toLocaleString()}
                </span>
                <span className="text-on-surface-variant text-[11px]">records</span>
              </div>
              <div className="bg-surface-container-lowest px-3 py-2 sm:px-space-md sm:py-2.5 rounded-xl shadow-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
                <span className="text-on-surface-variant">Eligible:</span>
                <span className="text-on-surface font-semibold">
                  {(summary.eligible_candidate_count ?? summary.stable_lightweight_candidate_count)?.toLocaleString()} candidates
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start pb-space-xl">
        {/* Left: criteria panel */}
        <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-space-md lg:sticky lg:top-20">
          <div className="bg-surface-container-lowest rounded-xl p-3.5 sm:p-space-md shadow-sm space-y-space-md">
            <div className="flex items-center justify-between pb-space-xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">filter_alt</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">Screening Criteria</span>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="font-label-code text-[11px] text-secondary hover:underline cursor-pointer"
                title="Reset to Phase 5 default criteria"
              >
                Reset Defaults
              </button>
            </div>

            <div className="space-y-space-sm font-body-sm text-body-sm">
              {/* Material Class control */}
              <div className="rounded-lg bg-surface-container-low px-3 py-2 space-y-1">
                <span className="block font-label-code text-[10px] uppercase tracking-wider text-on-surface-variant">
                  Material Class
                </span>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full bg-surface-container-lowest px-2 py-1.5 rounded text-[12px] font-semibold text-on-surface focus:outline-none cursor-pointer border border-outline-variant/30"
                >
                  <option value="nonmetal">Non-Metal (is_metal = false)</option>
                  <option value="metal">Metal (is_metal = true)</option>
                  <option value="all">All Classes</option>
                </select>
                {classFilter === 'metal' && (
                  <p className="text-[10px] text-secondary font-label-code pt-0.5">
                    Note: Metals have band gap ≈ 0 eV. Ensure Min Gap is 0 eV to include metallic candidates.
                  </p>
                )}
              </div>

              {/* Band Gap Range */}
              <div className="rounded-lg bg-surface-container-low px-3 py-2 space-y-1">
                <div className="flex justify-between items-center font-label-code text-[10px] uppercase tracking-wider text-on-surface-variant">
                  <span>Band Gap</span>
                  <span>{minGap} – {maxGap} eV</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div>
                    <span className="text-[10px] text-on-surface-variant block font-label-code">Min eV:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={minGap}
                      onChange={(e) => setMinGap(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-surface-container-lowest px-2 py-1 rounded text-xs font-semibold text-on-surface focus:outline-none border border-outline-variant/30"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant block font-label-code">Max eV:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="15"
                      value={maxGap}
                      onChange={(e) => setMaxGap(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-surface-container-lowest px-2 py-1 rounded text-xs font-semibold text-on-surface focus:outline-none border border-outline-variant/30"
                    />
                  </div>
                </div>
              </div>

              {/* Density Ceiling */}
              <div className="rounded-lg bg-surface-container-low px-3 py-2 space-y-1">
                <span className="block font-label-code text-[10px] uppercase tracking-wider text-on-surface-variant">
                  Density Ceiling
                </span>
                <select
                  value={maxDensity}
                  onChange={(e) => setMaxDensity(e.target.value)}
                  className="w-full bg-surface-container-lowest px-2 py-1.5 rounded text-[12px] font-semibold text-on-surface focus:outline-none cursor-pointer border border-outline-variant/30"
                >
                  <option value="2.0">&lt;= 2.00 g/cm³ (Ultra-light)</option>
                  <option value="2.5">&lt;= 2.50 g/cm³ (Lightweight)</option>
                  <option value="3.0">&lt;= 3.00 g/cm³ (Phase 5 25th percentile)</option>
                  <option value="all">No ceiling</option>
                </select>
              </div>

              {/* Thermodynamic Stability */}
              <div className="rounded-lg bg-surface-container-low px-3 py-2 space-y-1">
                <span className="block font-label-code text-[10px] uppercase tracking-wider text-on-surface-variant">
                  Thermodynamics
                </span>
                <select
                  value={stableOnly ? 'stable' : 'all'}
                  onChange={(e) => setStableOnly(e.target.value === 'stable')}
                  className="w-full bg-surface-container-lowest px-2 py-1.5 rounded text-[12px] font-semibold text-on-surface focus:outline-none cursor-pointer border border-outline-variant/30"
                >
                  <option value="stable">Stable only (energy above hull = 0)</option>
                  <option value="all">Include metastable</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2">
              <span className="font-label-code text-[11px] text-on-surface-variant uppercase tracking-wider">Show top</span>
              <select
                value={k}
                onChange={(e) => setK(Number(e.target.value))}
                className="bg-transparent font-label-code text-label-code text-on-surface font-semibold focus:outline-none cursor-pointer"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} candidates</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => load()}
              className="w-full py-3 px-space-md rounded-lg bg-primary-container text-on-primary font-label-ui text-label-ui tracking-wide uppercase hover:opacity-95 shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">science</span>
              Refresh Candidates
            </button>

            {/* Source info with overflow protection */}
            <div className="p-3 rounded-lg bg-surface-container flex flex-col gap-1.5 text-on-surface-variant font-label-code text-[11px] overflow-hidden">
              <div className="flex items-center justify-between">
                <span>Source:</span>
                <span className="text-on-surface font-semibold">Materials Project {summary?.source_database_version ?? 'sample'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Dataset:</span>
                <span className="text-on-surface font-semibold truncate max-w-[170px]" title={summary?.source_csv ?? ''}>
                  {summary?.source_csv ? summary.source_csv.split(/[\\/]/).pop() : 'sample.csv'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-xs">
            <span className="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant">Candidate Space Projection</span>
            <CandidateScatter candidates={candidates} />
            <div className="flex justify-between items-center font-label-code text-[11px] text-on-surface-variant">
              <span>Band Gap vs Density ({candidates.length} shown)</span>
            </div>
          </div>
        </aside>

        {/* Right: results */}
        <main className="lg:col-span-8 xl:col-span-9 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Discovery Results</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container font-label-code text-label-code text-on-surface-variant">
                {candidates.length} candidates returned
              </span>
            </div>
            <div className="flex items-center gap-space-xs self-end sm:self-auto">
              <div className="relative flex items-center bg-surface-container-low rounded-lg px-2.5 py-1.5 font-label-code text-label-code">
                <span className="text-on-surface-variant mr-1 hidden sm:inline">Sort:</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="bg-transparent text-on-surface font-semibold focus:outline-none cursor-pointer pr-4"
                >
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => exportCsv(candidates)}
                disabled={!candidates.length}
                className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-ui text-label-ui flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">file_download</span>
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {state.loading && <LoadingState label="Ranking candidates…" />}
          {state.error && <ErrorState error={state.error} onRetry={() => load()} />}

          {!state.loading && !state.error && state.result && (
            <>
              {!candidates.length && (
                <EmptyState title="No candidates returned" hint="The screening filters found no matches in the sample." />
              )}
              {candidates.length > 0 && (
                <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-container-low text-on-surface-variant font-label-code text-label-code uppercase tracking-wider">
                          <th className="py-3.5 px-space-md">Formula</th>
                          <th className="py-3.5 px-space-sm">Material Type</th>
                          <th className="py-3.5 px-space-sm text-right">Band Gap</th>
                          <th className="py-3.5 px-space-sm text-right">Density</th>
                          <th className="py-3.5 px-space-sm text-right">ML Formation Energy</th>
                          <th className="py-3.5 px-space-sm text-center">Stability</th>
                          <th className="py-3.5 px-space-md text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container-low font-body-md text-body-md">
                        {candidates.map((c) => {
                          const metal = c.is_metal === true || c.is_metal === 'True' || c.is_metal === 'true'
                          const stable = stabilityLabel(c.is_stable)
                          return (
                            <tr key={c.material_id} className="hover:bg-surface-container-low/60 transition-colors">
                              <td className="py-space-sm px-space-md">
                                <div className="flex items-center gap-space-sm">
                                  <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center font-metric-val text-metric-val text-on-surface font-bold">
                                    {subscriptFormula(c.formula_pretty).slice(0, 2)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-headline-sm text-headline-sm text-on-surface leading-snug">
                                      {subscriptFormula(c.formula_pretty)}
                                    </span>
                                    <span className="font-body-sm text-body-sm text-on-surface-variant">{c.material_id} · rank #{c.rank}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-space-sm px-space-sm">
                                <span className={`px-2 py-0.5 rounded font-label-code text-label-code ${metal ? 'bg-surface-container-highest text-on-surface' : 'bg-surface-container text-on-surface-variant'}`}>
                                  {metal ? 'Metal' : 'Non-Metal'}
                                </span>
                              </td>
                              <td className="py-space-sm px-space-sm text-right">
                                <span className="font-metric-val text-metric-val text-on-surface">{fmt(c.band_gap) ?? 'N/A'}</span>
                                <span className="font-metric-unit text-metric-unit text-on-surface-variant ml-0.5">eV</span>
                              </td>
                              <td className="py-space-sm px-space-sm text-right">
                                <span className="font-metric-val text-metric-val text-on-surface">{fmt(c.density) ?? 'N/A'}</span>
                                <span className="font-metric-unit text-metric-unit text-on-surface-variant ml-0.5">g/cm³</span>
                              </td>
                              <td className="py-space-sm px-space-sm text-right">
                                <span className="font-metric-val text-metric-val text-on-surface font-semibold">{fmt(c.predicted_formation_energy_eV_per_atom) ?? 'N/A'}</span>
                                <span className="font-metric-unit text-metric-unit text-on-surface-variant ml-0.5">eV/atom</span>
                              </td>
                              <td className="py-space-sm px-space-sm text-center">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-code text-label-code font-semibold ${
                                  stable === 'Stable' ? 'bg-surface-container text-on-tertiary-container' : 'bg-surface-container text-secondary'
                                }`}>
                                  <span className={`w-2 h-2 rounded-full ${stable === 'Stable' ? 'bg-on-tertiary-container' : 'bg-secondary'}`} />
                                  {stable}
                                </span>
                              </td>
                              <td className="py-space-sm px-space-md text-right">
                                <button
                                  onClick={() => navigate(`/analyze/${encodeURIComponent(c.formula_pretty)}`)}
                                  className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-on-surface-variant font-label-ui text-label-ui transition-all shadow-sm"
                                >
                                  Analyze
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-3 sm:px-space-md py-3 bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-label-code text-[11px] sm:text-label-code text-on-surface-variant">
                    <span className="break-words">
                      Showing {candidates.length} of {summary?.stable_lightweight_candidate_count ?? '—'} eligible candidates
                      {summary?.ordinal_score_note ? <span className="hidden sm:inline"> · {summary.ordinal_score_note}</span> : ''}
                    </span>
                    <span className="shrink-0">Density-first ranking from Phase 5 workflow</span>
                  </div>
                </div>
              )}

              {top && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm space-y-space-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary">star_half</span>
                        <span className="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant">Rank #1 Match</span>
                      </div>
                      <span className="font-label-code text-label-code px-2 py-0.5 rounded bg-surface-container-low text-on-tertiary-container font-semibold">
                        Density rank score: {top.relative_density_rank_score}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-space-sm flex-wrap">
                      <h3 className="font-headline-lg text-headline-lg text-on-surface font-bold">{subscriptFormula(top.formula_pretty)}</h3>
                      <span className="font-body-md text-body-md text-on-surface-variant">{top.material_id}</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      Lowest density eligible candidate under the current screening criteria. Formation
                      energy shown is a supplementary ML estimate and does not influence rank.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-space-xs font-label-code">
                      <div className="bg-surface-container-low p-2 rounded-lg">
                        <span className="text-[10px] text-on-surface-variant uppercase block">Band Gap (DB)</span>
                        <span className="font-metric-val text-body-md text-on-surface font-semibold">{fmt(top.band_gap) ?? 'N/A'} <span className="text-[10px] text-on-surface-variant">eV</span></span>
                      </div>
                      <div className="bg-surface-container-low p-2 rounded-lg">
                        <span className="text-[10px] text-on-surface-variant uppercase block">Density (DB)</span>
                        <span className="font-metric-val text-body-md text-on-surface font-semibold">{fmt(top.density) ?? 'N/A'} <span className="text-[10px] text-on-surface-variant">g/cm³</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-space-xs">
                        <span className="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant">Stability Context</span>
                        <span className="font-label-code text-label-code text-on-surface-variant">MP sample</span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Energy above hull for the rank-1 record: <strong className="text-on-surface">{fmt(top.energy_above_hull, 3) ?? 'N/A'} eV/atom</strong>.
                        Stability values come from the Materials Project sample; ML formation-energy values
                        are screening estimates and do not change rank.
                      </p>
                    </div>
                    <div className="pt-space-sm space-y-1.5">
                      <div className="flex justify-between font-label-code text-label-code">
                        <span className="text-on-surface-variant">Relative density rank score (0–100, ordinal):</span>
                        <span className="text-on-tertiary-container font-semibold">{top.relative_density_rank_score}</span>
                      </div>
                      <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                        <div className="bg-on-tertiary-container h-full rounded-full" style={{ width: `${top.relative_density_rank_score ?? 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Disclaimer */}
      <div className="w-full mb-space-xl">
        <div className="rounded-xl bg-surface-container-low p-3.5 sm:p-space-md shadow-sm flex flex-col sm:flex-row items-start gap-space-md">
          <div className="p-2.5 rounded-lg bg-surface-container-lowest text-secondary shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[24px]">verified_user</span>
          </div>
          <div className="space-y-1">
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">Computational Screening Notice &amp; Methodological Bounds</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Candidate results are intended for computational screening and should be validated using
              appropriate experimental or higher-fidelity computational methods (e.g. DFT, GW approximations).
              MaterialMatch predictions do not guarantee synthesizability or device performance.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
