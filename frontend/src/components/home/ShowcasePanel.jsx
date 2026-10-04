import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { subscriptFormula } from '../../utils/formatters'

function MetricCell({ label, value, unit, note }) {
  return (
    <div className="p-2.5 sm:p-3 rounded-lg bg-surface-container-low flex flex-col justify-between min-w-0">
      <span className="font-label-code text-[11px] sm:text-label-code uppercase text-on-surface-variant truncate">{label}</span>
      <span className="font-metric-val text-sm sm:text-metric-val text-on-surface mt-1 sm:mt-1.5 break-words">
        {value ?? '—'} <span className="font-metric-unit text-[10px] sm:text-metric-unit text-outline">{unit}</span>
      </span>
      <span className="font-body-sm text-[11px] sm:text-body-sm text-on-surface-variant mt-1 line-clamp-2 break-words leading-tight">{note ?? '—'}</span>
    </div>
  )
}

function DecorativeDosChart({ gapText }) {
  // Decorative band diagram rendered exactly as the Stitch design specified; the
  // shape is illustrative — actual numbers come from the property cards above.
  return (
    <div className="mt-2 pt-3 bg-surface-container-low rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-label-ui text-label-ui uppercase text-on-surface font-semibold">
          Predicted Electronic DOS &amp; Electronic Dispersion
        </span>
        <span className="font-label-code text-label-code text-outline">Fermi level E_f = 0 eV</span>
      </div>
      <div className="w-full h-24 relative flex items-center">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 600 80">
          <line stroke="#c6c6cd" strokeDasharray="3 3" strokeWidth="0.5" x1="0" x2="600" y1="70" y2="70" />
          <line stroke="#006398" strokeDasharray="2 2" strokeWidth="1" x1="280" x2="280" y1="0" y2="80" />
          <path d="M 0 70 Q 50 68, 90 40 T 170 30 T 230 55 T 260 70 L 260 70 L 0 70 Z" fill="#5bb8fe" fillOpacity="0.35" />
          <path d="M 0 70 Q 50 68, 90 40 T 170 30 T 230 55 T 260 70" fill="none" stroke="#006398" strokeWidth="2" />
          <path d="M 380 70 Q 420 50, 460 30 T 540 20 T 600 45 L 600 70 L 380 70 Z" fill="#68dba9" fillOpacity="0.35" />
          <path d="M 380 70 Q 420 50, 460 30 T 540 20 T 600 45" fill="none" stroke="#069669" strokeWidth="2" />
          <line stroke="#131b2e" strokeWidth="1.5" x1="260" x2="380" y1="65" y2="65" />
          <circle cx="260" cy="65" fill="#131b2e" r="2.5" />
          <circle cx="380" cy="65" fill="#131b2e" r="2.5" />
        </svg>
        <span className="absolute top-1/2 left-[52%] -translate-y-1/2 bg-surface-container-lowest px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-metric-unit text-primary-container shadow-sm font-semibold truncate max-w-[130px] sm:max-w-none">
          {gapText ?? 'Run an analysis to fill with real values'}
        </span>
      </div>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Decorative diagram — the reported band gap comes from the two-stage ML model above.
      </p>
    </div>
  )
}

function IdlePanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-10 px-4">
      <span className="material-symbols-outlined text-[32px] text-outline-variant">hub</span>
      <p className="mt-3 font-headline-sm text-headline-sm text-on-surface">Nearest Latent Analogs</p>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-xs">
        Pick an example formula or run an analysis to load real similarity results here.
      </p>
    </div>
  )
}

export default function ShowcasePanel({ previewFormula }) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null, formula: null })

  useEffect(() => {
    if (!previewFormula) return
    let cancelled = false

    api
      .discover(previewFormula, 3)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null, formula: previewFormula })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', data: null, error, formula: previewFormula })
      })

    return () => {
      cancelled = true
    }
  }, [previewFormula])

  const isLoading = previewFormula && state.formula !== previewFormula && state.status !== 'error'
  const data = state.data
  const reference = data?.resolved_reference
  const predictions = data?.ml_prediction
  const similar = data?.similar_materials ?? []
  const formula = data?.resolved_reference?.formula_pretty || reference?.formula_pretty || previewFormula
  const prettyFormula = formula ? subscriptFormula(formula) : null
  const bandGap = predictions?.band_gap
  const isMetal = predictions?.material_type?.material_type === 'Metal'
  const confidence = predictions?.material_type?.classification_probability

  return (
    <section className="w-full mt-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Live screening preview card */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-4 sm:p-space-lg shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-md gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-label-ui text-label-ui uppercase tracking-wider text-secondary">
                  Active Target Inference
                </span>
                <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-code text-label-code font-semibold text-[10px]">
                  ML ESTIMATE
                </span>
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface mt-1">
                {isLoading ? (
                  <span className="inline-flex items-center gap-2 text-on-surface-variant font-body-md">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
                    Analyzing {subscriptFormula(previewFormula)}…
                  </span>
                ) : (
                  prettyFormula ?? 'No material selected'
                )}
              </h2>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {reference?.material_id ? (
                <span className="px-2.5 py-1 rounded bg-surface-container font-label-code text-label-code text-on-surface-variant">
                  {reference.material_id}
                </span>
              ) : null}
              {reference?.is_stable != null ? (
                <span className="px-2.5 py-1 rounded bg-secondary-fixed text-on-secondary-fixed font-label-code text-label-code">
                  {reference.is_stable ? 'Stable' : 'Not stable'}
                </span>
              ) : null}
              {isMetal != null ? (
                <span className={`px-2.5 py-1 rounded font-label-code text-label-code ${isMetal ? 'bg-surface-container-highest text-on-surface' : 'bg-tertiary-fixed text-on-tertiary-fixed'}`}>
                  {isMetal ? 'Metal' : 'Non-Metal'}
                </span>
              ) : null}
            </div>
          </div>

          {/* 2x2 / 4-col metric grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
            <MetricCell
              label="Band Gap"
              value={bandGap?.value != null ? bandGap.value.toFixed(2) : null}
              unit="eV"
              note={
                bandGap == null
                  ? 'Awaiting analysis'
                  : bandGap.stage === 'classifier_only'
                    ? 'Metal — classifier route'
                    : 'Conditional ML regression'
              }
            />
            <MetricCell
              label="Formation Energy"
              value={predictions?.formation_energy_per_atom?.value != null ? predictions.formation_energy_per_atom.value.toFixed(2) : null}
              unit="eV/atom"
              note={predictions ? 'ML prediction' : 'Awaiting analysis'}
            />
            <MetricCell
              label="Mass Density"
              value={predictions?.density?.value != null ? predictions.density.value.toFixed(2) : null}
              unit="g/cm³"
              note={predictions ? 'ML prediction' : 'Awaiting analysis'}
            />
            <MetricCell
              label="Material Type"
              value={predictions?.material_type?.material_type ?? null}
              unit={confidence != null ? `${Math.round(confidence * 100)}% conf.` : ''}
              note={predictions ? 'Classifier self-confidence' : 'Awaiting analysis'}
            />
          </div>

          <DecorativeDosChart
            gapText={
              bandGap?.value != null
                ? `E_g: ${bandGap.value.toFixed(2)} eV ${isMetal ? '(metallic)' : 'predicted'}`
                : null
            }
          />

          {formula && (
            <div className="mt-3 text-right">
              <Link
                to={`/analyze/${encodeURIComponent(formula)}`}
                className="inline-flex items-center gap-1 font-label-ui text-label-ui text-secondary hover:underline"
              >
                Full analysis
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          )}
        </div>

        {/* Latent neighbors & confidence summary */}
        <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-4 sm:p-space-lg shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-label-ui text-label-ui uppercase tracking-wider text-secondary">
                Isostructural Matches
              </span>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">hub</span>
            </div>
            {state.status === 'idle' && <IdlePanel />}
            {state.status === 'loading' && (
              <div className="py-12 text-center text-on-surface-variant font-label-code text-label-code">
                Searching similar materials…
              </div>
            )}
            {state.status === 'error' && (
              <div className="py-10 text-center">
                <p className="text-error font-label-code text-label-code">Preview unavailable</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{state.error?.message}</p>
              </div>
            )}
            {state.status === 'ready' && (
              <>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">Nearest Latent Analogs</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  Cosine-style composition similarity over the 10,000-record sample.
                </p>
                <div className="mt-4 space-y-2.5">
                  {similar.length === 0 && (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">No neighbors returned.</p>
                  )}
                  {similar.slice(0, 3).map((m) => (
                    <Link
                      key={m.material_id}
                      to={`/analyze/${encodeURIComponent(m.formula_pretty)}`}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded bg-surface-container-highest flex items-center justify-center font-label-code text-label-code text-on-surface font-semibold">
                          {subscriptFormula(m.formula_pretty).slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-label-ui text-label-ui text-on-surface">
                            {subscriptFormula(m.formula_pretty)}
                          </div>
                          <div className="font-metric-unit text-metric-unit text-on-surface-variant">
                            {m.band_gap != null ? `Eg ${Number(m.band_gap).toFixed(2)} eV` : 'gap N/A'}
                          </div>
                        </div>
                      </div>
                      <span className="font-label-code text-label-code text-secondary font-bold">
                        {m.similarity_score != null ? `${(m.similarity_score * 100).toFixed(1)}%` : '—'}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Classifier confidence bar */}
          <div className="mt-4 pt-3">
            <div className="flex justify-between items-center mb-1.5 font-label-code text-label-code">
              <span className="text-on-surface-variant">Classifier confidence</span>
              <span className="text-on-tertiary-container font-semibold">
                {confidence != null ? `${(confidence * 100).toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-on-tertiary-container rounded-full transition-all duration-500"
                style={{ width: confidence != null ? `${confidence * 100}%` : '0%' }}
              />
            </div>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              Model self-confidence for the metal/non-metal head — not accuracy.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
