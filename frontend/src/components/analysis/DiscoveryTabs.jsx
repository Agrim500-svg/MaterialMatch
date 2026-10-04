import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { landscapeImageUrl } from '../../api/client'
import { subscriptFormula } from '../../utils/formatters'

const TABS = [
  { id: 'similar', label: 'Similar Materials' },
  { id: 'landscape', label: 'Material Landscape' },
  { id: 'candidate', label: 'Candidate Context' },
]

function SimilarCard({ material }) {
  const navigate = useNavigate()
  const formula = material.formula_pretty
  const score = material.similarity_score
  const metric = (label, value, unit) => (
    <div>
      <span className="block font-label-code text-[10px] text-on-surface-variant uppercase">{label}</span>
      <span className="font-metric-val text-body-md font-semibold text-on-surface">
        {value != null ? Number(value).toFixed(2) : 'N/A'}{' '}
        {unit && <span className="font-metric-unit text-metric-unit text-on-surface-variant font-normal">{unit}</span>}
      </span>
    </div>
  )
  return (
    <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col justify-between hover:bg-surface-container transition-colors shadow-sm">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-metric-val text-headline-sm font-bold text-on-surface">
                {subscriptFormula(formula)}
              </span>
            </div>
            <span className="inline-block mt-1 font-label-code text-[11px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface">
              {material.is_metal === true || material.is_metal === 'True' ? 'Metal' : material.is_metal === false || material.is_metal === 'False' ? 'Non-Metal' : 'Type N/A'}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-metric-val text-body-sm font-bold text-secondary">
              {score != null ? `${(score * 100).toFixed(0)}%` : '—'}
            </span>
            <span className="font-label-code text-[10px] text-on-surface-variant">Similarity</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-space-md pt-space-sm bg-surface-container-lowest/60 p-2.5 rounded-lg">
          {metric('Band Gap', material.band_gap, 'eV')}
          {metric('Density', material.density, 'g/cm³')}
          <div className="col-span-2">{metric('Formation Energy', material.formation_energy_per_atom, 'eV/atom')}</div>
        </div>
      </div>
      <div className="mt-space-md pt-2">
        <button
          onClick={() => navigate(`/analyze/${encodeURIComponent(formula)}`)}
          className="w-full py-1.5 px-3 rounded-lg bg-surface-container-lowest hover:bg-primary-container hover:text-on-primary font-label-ui text-label-ui text-on-surface transition-all shadow-sm flex items-center justify-center gap-1"
        >
          <span>Analyze Material</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </div>
    </div>
  )
}

function LandscapeTab({ data }) {
  const context = data?.cluster_context
  return (
    <div className="flex flex-col gap-space-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs text-on-surface-variant font-label-code text-label-code">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Explore where this material sits — existing Phase 4 PCA clustering of the 10,000-record sample (unchanged by ML predictions).
        </p>
      </div>
      {context ? (
        <div className="rounded-lg border border-tertiary-fixed-dim bg-tertiary-fixed/20 p-3 font-body-sm text-body-sm text-on-surface">
          This exact record belongs to exploratory cluster <strong>#{context.cluster}</strong>.{' '}
          {context.cluster_note}
        </div>
      ) : (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Cluster membership is available only for exact records in the local sample. The landscape below is global sample context.
        </p>
      )}
      <div className="relative w-full bg-surface-container-low rounded-xl overflow-hidden">
        <img
          src={landscapeImageUrl('clusters')}
          alt="PCA material landscape colored by exploratory clusters"
          className="w-full h-auto block"
        />
      </div>
    </div>
  )
}

function CandidateTab({ data }) {
  const context = data?.cluster_context
  return (
    <div className="flex flex-col gap-space-md">
      <div className="bg-surface-container-low rounded-xl p-4 sm:p-space-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
        <div className="flex items-start gap-space-md">
          <div className="h-12 w-12 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">hub</span>
          </div>
          <div>
            <span className="font-label-code text-label-code text-secondary font-semibold uppercase">Screening Context</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mt-0.5">
              Lightweight Stable Semiconductors
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1 leading-relaxed max-w-2xl">
              {context
                ? `This record sits in exploratory cluster #${context.cluster} — a descriptive grouping of the local sample, not a rank or quality label.`
                : 'The Phase 5 screening workflow ranks density-first within the 10k sample after metal/band-gap/stability filtering. See the full ranked list.'}
            </p>
          </div>
        </div>
        <div className="shrink-0 self-stretch md:self-center">
          <Link
            to="/candidates"
            className="inline-flex items-center justify-center gap-2 px-space-lg py-3 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-all font-headline-sm text-label-ui font-bold shadow-md w-full md:w-auto"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">rocket_launch</span>
            <span>Explore Candidates</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function DiscoveryTabs({ data }) {
  const [tab, setTab] = useState('similar')

  return (
    <section className="w-full pb-space-xl">
      <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-space-lg shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pb-space-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-secondary" />
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">Material Discovery</h2>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Relational neighbors, structural landscape map, and contextual screening information.
            </p>
          </div>
          <div className="flex items-center bg-surface-container-low p-1 rounded-lg gap-1 self-stretch sm:self-start font-label-ui text-label-ui overflow-x-auto max-w-full" role="tablist">
            {TABS.map((tabItem) => (
              <button
                key={tabItem.id}
                role="tab"
                aria-selected={tab === tabItem.id}
                onClick={() => setTab(tabItem.id)}
                className={`px-3 sm:px-space-md py-1.5 rounded-md transition-all whitespace-nowrap text-xs sm:text-label-ui cursor-pointer ${
                  tab === tabItem.id
                    ? 'bg-surface-container-lowest shadow-sm text-on-surface font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tabItem.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'similar' && (
          <div className="flex flex-col gap-space-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-on-surface-variant font-label-code text-xs sm:text-label-code">
              <span>Ranked by composition + property similarity over the sample</span>
              <span className="truncate max-w-[200px] sm:max-w-none">Target: {subscriptFormula(data?.resolved_reference?.formula_pretty)}</span>
            </div>
            {data?.similar_materials?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                {data.similar_materials.slice(0, 6).map((m) => (
                  <SimilarCard key={m.material_id} material={m} />
                ))}
              </div>
            ) : (
              <p className="font-body-sm text-body-sm text-on-surface-variant">No similar materials returned.</p>
            )}
          </div>
        )}
        {tab === 'landscape' && <LandscapeTab data={data} />}
        {tab === 'candidate' && <CandidateTab data={data} />}
      </div>
    </section>
  )
}
