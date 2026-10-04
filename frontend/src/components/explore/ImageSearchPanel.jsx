import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { fmt, subscriptFormula } from '../../utils/formatters'
import { EmptyState, ErrorState, LoadingState } from '../ui'

const MODES = [
  { id: 'auto', label: 'Auto detect' },
  { id: 'text', label: 'OCR / chart' },
  { id: 'structure', label: 'Structure diagram' },
]

function DetectedCard({ search, queryType }) {
  const navigate = useNavigate()
  const best = search.similar_materials?.[0]
  return (
    <div className="bg-surface-container-low rounded-xl p-space-md hover:bg-surface-container transition-all">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-headline-sm text-base font-bold text-on-surface">
              {subscriptFormula(search.query)}
            </span>
            <span className="font-label-code text-label-code text-on-surface-variant font-medium">
              ({queryType === 'material_id' ? 'Material ID' : 'Formula'})
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            {best ? `Nearest local analog: ${subscriptFormula(best.formula_pretty)}` : 'No local analog returned'}
          </span>
        </div>
        <div className="text-right">
          <span className="font-metric-val text-sm font-bold text-secondary">
            {best?.similarity_score != null ? `${(best.similarity_score * 100).toFixed(0)}% Match` : '—'}
          </span>
          <span className="block font-label-code text-[10px] text-on-surface-variant">Similarity</span>
        </div>
      </div>
      {best && (
        <div className="grid grid-cols-3 gap-2 mt-3 pt-2 font-label-code text-[11px]">
          <div>
            <span className="text-on-surface-variant block text-[10px]">BAND GAP</span>
            <span className="font-semibold text-on-surface">{fmt(best.band_gap) ?? 'N/A'} eV</span>
          </div>
          <div>
            <span className="text-on-surface-variant block text-[10px]">DENSITY</span>
            <span className="font-semibold text-on-surface">{fmt(best.density) ?? 'N/A'} g/cm³</span>
          </div>
          <div>
            <span className="text-on-surface-variant block text-[10px]">FORM. ENERGY</span>
            <span className="font-semibold text-on-surface">{fmt(best.formation_energy_per_atom) ?? 'N/A'} eV/at</span>
          </div>
        </div>
      )}
      <div className="mt-3 pt-2 flex items-center justify-end">
        <button
          onClick={() => navigate(`/analyze/${encodeURIComponent(search.query)}`)}
          className="w-full text-center py-1.5 px-3 rounded bg-primary text-on-primary font-label-ui text-label-ui hover:bg-on-primary-fixed transition-colors shadow-sm"
        >
          Analyze Material
        </button>
      </div>
    </div>
  )
}

export default function ImageSearchPanel() {
  const inputRef = useRef(null)
  const [mode, setMode] = useState('auto')
  const [state, setState] = useState({ loading: false, error: null, result: null, fileName: null })

  const analyze = async (file) => {
    if (!file) return
    setState((s) => ({ ...s, loading: true, error: null, fileName: file.name }))
    try {
      const result = await api.searchImage(file, mode, 6)
      setState({ loading: false, error: null, result, fileName: file.name })
    } catch (error) {
      // Keep any previous result visible rather than wiping the workspace.
      setState((s) => ({ ...s, loading: false, error, fileName: file.name }))
    }
  }

  const interpretation = state.result?.interpretation
  const searches = state.result?.searches ?? []
  const hits = (interpretation?.formulas?.length ?? 0) + (interpretation?.material_ids?.length ?? 0)

  return (
    <section className="w-full flex flex-col gap-space-md pb-space-lg">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-secondary" />
          <span className="font-label-code text-label-code uppercase tracking-wider text-secondary">Visual Ingestion Pipeline</span>
        </div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-0.5">Search Materials from an Image</h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
          Upload a photo or screenshot with material names, formulas, charts, or structure diagrams.
          MaterialMatch interprets it with Gemini Vision and searches the local 10,000-record index for the
          recognized formulas and material IDs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
        {/* Upload zone */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-4 sm:p-space-lg shadow-sm flex flex-col justify-between">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              analyze(e.dataTransfer.files?.[0])
            }}
            className="relative group cursor-pointer bg-surface-container-low hover:bg-surface-container rounded-xl p-4 sm:p-space-xl flex flex-col items-center justify-center text-center transition-all min-h-[260px] sm:min-h-[280px]"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center text-secondary mb-4 sm:mb-space-md group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[28px] sm:text-[32px]">document_scanner</span>
            </div>
            <h3 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-semibold">Drop an image here or click to browse</h3>
            <p className="font-body-md text-xs sm:text-body-md text-on-surface-variant max-w-md mt-1">
              Screenshots, plots, tables, or crystal structure diagrams containing chemical formulas
              or Materials Project identifiers.
            </p>
            <div className="flex items-center gap-2 mt-4 sm:mt-space-md">
              <span className="px-4 py-2 rounded-lg bg-surface-container-lowest text-on-surface font-label-ui text-xs sm:text-label-ui shadow-sm group-hover:bg-surface-container-high transition-colors flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                <span>Upload Image</span>
              </span>
            </div>
            <span className="font-label-code text-[10px] sm:text-[11px] text-on-surface-variant mt-3 sm:mt-space-md">
              PNG, JPEG, WebP · up to 15 MiB
            </span>
          </div>
          <div className="mt-space-md pt-space-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="font-label-code text-label-code text-on-surface-variant">Interpretation mode:</span>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-space-sm">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`px-2.5 py-1 rounded font-label-code text-[11px] transition-colors cursor-pointer ${
                    mode === m.id
                      ? 'bg-secondary-fixed text-on-secondary-fixed font-semibold'
                      : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => analyze(e.target.files?.[0])}
          />
        </div>

        {/* Result panel */}
        <div className="lg:col-span-5 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest rounded-xl p-3.5 sm:p-space-md shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between pb-space-xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">document_scanner</span>
                <span className="font-headline-sm text-sm text-on-surface font-semibold">Computer Vision Identification</span>
              </div>
              {state.result && (
                <span className="font-label-code text-[11px] text-on-tertiary-container px-2 py-0.5 rounded-full bg-surface-container">
                  {hits > 0 ? `${hits} Recognized Quer${hits === 1 ? 'y' : 'ies'}` : 'No formulas recognized'}
                </span>
              )}
            </div>

            {state.loading && <LoadingState label={`Interpreting ${state.fileName}…`} />}
            {state.error && <ErrorState error={state.error} />}

            {!state.loading && !state.error && !state.result && (
              <EmptyState
                title="Upload an image to start"
                hint="Vision interprets and searches the local index. Requires GEMINI_API_KEY on the backend."
              />
            )}

            {state.result && (
              <>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {interpretation?.image_kind?.replaceAll('_', ' ') || 'Interpretation'} ·{' '}
                  {state.result.confidence_note}
                </p>
                {interpretation?.confidence != null && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-label-code text-on-surface-variant">
                    Vision self-confidence: <strong className="text-on-surface">{(interpretation.confidence * 100).toFixed(0)}%</strong> (not calibrated)
                  </div>
                )}
                {state.result.status === 'no_search_query_recognized' && (
                  <p className="mt-2 font-body-sm text-amber-700">
                    No formula or material ID was recognized in the image. Try a clearer screenshot or a
                    structure diagram with labels.
                  </p>
                )}
                {searches.length > 0 && (
                  <div className="mt-space-md flex flex-col gap-space-sm">
                    {searches.map((search, index) => (
                      <DetectedCard key={`${search.query}-${index}`} search={search} queryType={search.query_type} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
