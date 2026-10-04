import { useEffect, useState } from 'react'
import { fetchLandscapeSummary, landscapeImageUrl } from '../../api/client'
import { EmptyState, ErrorState, LoadingState } from '../ui'

const VIEW_MODES = [
  { id: 'clusters', label: 'Clusters' },
  { id: 'band_gap', label: 'Band Gap' },
]

export default function LandscapePanel() {
  const [mode, setMode] = useState('clusters')
  const [zoom, setZoom] = useState(1)
  const [summary, setSummary] = useState({ data: null, error: null, loading: true })

  useEffect(() => {
    let cancelled = false
    fetchLandscapeSummary()
      .then((data) => !cancelled && setSummary({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setSummary({ data: null, error, loading: false }))
    return () => {
      cancelled = true
    }
  }, [])

  const metadata = summary.data?.metadata
  const clusterSummary = summary.data?.cluster_summary ?? []

  return (
    <section className="w-full flex flex-col gap-space-md">
      {/* Section header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="font-label-code text-label-code uppercase tracking-wider text-secondary">Manifold Projection</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-0.5">Material Landscape</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            Existing Phase 4 PCA clustering of the 10,000-record sample. Colors mark exploratory cluster assignments; projections are computed before any prediction model runs.
          </p>
        </div>
        <div className="flex items-center gap-space-xs bg-surface-container p-1 rounded-lg self-start">
          {VIEW_MODES.map((v) => (
            <button
              key={v.id}
              onClick={() => setMode(v.id)}
              className={`px-3 py-1 rounded font-label-code text-label-code transition-colors ${
                mode === v.id
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {summary.loading && <LoadingState label="Loading landscape artifacts…" />}
      {summary.error && <ErrorState error={summary.error} />}

      {!summary.loading && !summary.error && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
          {/* Main canvas */}
          <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-3.5 sm:p-space-md shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[460px]">
            <div className="flex flex-wrap items-center justify-between gap-space-sm z-10">
              <div className="flex flex-wrap items-center gap-space-sm">
                <span className="font-label-code text-[11px] px-2 py-1 rounded bg-surface-container-low text-on-surface-variant">
                  {metadata?.rows_clustered?.toLocaleString() ?? '—'} Screened Structures
                </span>
                <span className="font-label-code text-[11px] px-2 py-1 rounded bg-surface-container-low text-on-surface-variant">
                  k = {metadata?.selected_k_by_sampled_silhouette ?? '—'} clusters
                </span>
                {metadata?.selected_k_sampled_silhouette != null && (
                  <span className="font-label-code text-[11px] px-2 py-1 rounded bg-surface-container-low text-on-surface-variant">
                    silhouette ≈ {Number(metadata.selected_k_sampled_silhouette).toFixed(3)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-0.5">
                <button
                  className="p-1 hover:bg-surface-container rounded text-on-surface-variant hover:text-on-surface disabled:opacity-30 cursor-pointer"
                  title="Zoom In"
                  onClick={() => setZoom((z) => Math.min(4, z * 1.25))}
                  disabled={zoom >= 4}
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
                <button
                  className="p-1 hover:bg-surface-container rounded text-on-surface-variant hover:text-on-surface disabled:opacity-30 cursor-pointer"
                  title="Zoom Out"
                  onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))}
                  disabled={zoom <= 0.5}
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <button
                  className="p-1 hover:bg-surface-container rounded text-on-surface-variant hover:text-on-surface cursor-pointer"
                  title="Reset View"
                  onClick={() => setZoom(1)}
                >
                  <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                </button>
              </div>
            </div>

            <div className="w-full my-auto py-space-sm relative overflow-auto flex items-center justify-center">
              <img
                src={landscapeImageUrl(mode)}
                alt={mode === 'clusters' ? 'PCA material landscape colored by exploratory clusters' : 'PCA material landscape colored by database band gap'}
                className="max-w-none transition-transform origin-center rounded-lg border border-surface-container"
                style={{ transform: `scale(${zoom})`, maxHeight: '26rem', maxWidth: '100%' }}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 font-label-code text-[11px] text-on-surface-variant pt-2 border-t border-surface-container-low">
              <span>PCA 2-component projection</span>
              <span>Features: scaled composition + properties</span>
              <span>Static precomputed artifact</span>
            </div>
          </div>

          {/* Right rail: real cluster summaries */}
          <div className="lg:col-span-4 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest rounded-xl p-3.5 sm:p-space-md shadow-sm">
              <div className="flex items-center gap-2 mb-space-xs">
                <span className="material-symbols-outlined text-secondary text-[22px]">hub</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">Topology Engine</span>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Materials with similar composition and property profiles cluster together in PCA space;
                K-Means discovers the groups shown below.
              </p>
              {metadata && (
                <div className="mt-space-md flex flex-col gap-space-sm font-body-sm text-body-sm">
                  <div className="p-3 bg-surface-container-low rounded-lg">
                    <span className="font-label-code text-label-code font-semibold text-on-surface block">Dimensionality Reduction</span>
                    <p className="text-on-surface-variant text-[12px] mt-0.5">
                      {metadata.landscape ?? '2-component PCA'} · {metadata.clustering_space ?? 'PCA components retaining 95% of variance'}
                    </p>
                  </div>
                  {metadata.preprocessing && (
                    <div className="p-3 bg-surface-container-low rounded-lg">
                      <span className="font-label-code text-label-code font-semibold text-on-surface block">Preprocessing</span>
                      <p className="text-on-surface-variant text-[12px] mt-0.5">{metadata.preprocessing}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
              <span className="font-label-code text-label-code uppercase tracking-wider text-on-surface-variant block mb-2">
                Cluster Summary (real counts)
              </span>
              {clusterSummary.length === 0 && (
                <EmptyState title="No cluster summary" hint="Clustering artifacts unavailable." />
              )}
              <div className="flex flex-col gap-2">
                {clusterSummary.map((c) => {
                  const total = clusterSummary.reduce((s, x) => s + (x.materials ?? 0), 0)
                  const pct = total ? Math.round(((c.materials ?? 0) / total) * 100) : 0
                  return (
                    <div key={c.cluster} className="font-label-code text-[11px]">
                      <div className="flex justify-between mb-1">
                        <span>
                          Cluster {c.cluster} <span className="text-on-surface-variant">({c.top_elements || 'n/a'})</span>
                        </span>
                        <span className="text-on-surface-variant font-semibold">{c.materials} materials · {pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full bg-secondary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      {c.median_band_gap != null && (
                        <div className="mt-0.5 text-[10px] text-on-surface-variant">
                          median band gap {Number(c.median_band_gap).toFixed(2)} eV · median density {c.median_density != null ? Number(c.median_density).toFixed(2) : '—'} g/cm³
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
