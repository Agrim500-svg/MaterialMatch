import { useState } from 'react'
import SimilarityPanel from '../components/explore/SimilarityPanel'
import LandscapePanel from '../components/explore/LandscapePanel'
import ImageSearchPanel from '../components/explore/ImageSearchPanel'

const TABS = [
  { id: 'similarity', label: 'Similarity Search', icon: 'bubble_chart' },
  { id: 'landscape', label: 'Material Landscape', icon: 'scatter_plot' },
  { id: 'image', label: 'Image Search', icon: 'biotech' },
]

export default function ExplorePage() {
  const [tab, setTab] = useState('similarity')

  return (
    <div className="flex flex-col w-full">
      {/* Page header + mode switcher */}
      <section className="w-full pb-space-lg">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-space-xs mb-1">
              <span className="font-label-code text-[11px] sm:text-label-code uppercase tracking-wider text-secondary flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                Cross-Embedding Exploration Engine
              </span>
              <span className="text-outline-variant font-label-code text-label-code hidden sm:inline">/</span>
              <span className="font-label-code text-[11px] sm:text-label-code text-on-surface-variant">10,000-Record Local Index</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Explore Materials</h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
              Search, compare, and discover materials across the MaterialMatch database — composition
              similarity, the existing PCA clustering landscape, or vision-assisted image ingestion.
            </p>
          </div>
          <div className="flex p-1 bg-surface-container rounded-xl shadow-inner gap-1 overflow-x-auto max-w-full" role="tablist">
            {TABS.map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-space-md py-1.5 sm:py-2 rounded-lg font-label-ui text-xs sm:text-label-ui whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    active
                      ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[16px] sm:text-[18px] ${active ? 'text-secondary' : ''}`}>{t.icon}</span>
                  <span>{t.label}</span>
                  {active && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-label-code hidden sm:inline">
                      Active
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* One workspace at a time */}
      {tab === 'similarity' && <SimilarityPanel />}
      {tab === 'landscape' && <LandscapePanel />}
      {tab === 'image' && <ImageSearchPanel />}
    </div>
  )
}
