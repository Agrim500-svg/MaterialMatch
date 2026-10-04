const STEPS = [
  { n: '01', icon: 'keyboard', title: 'Input Formula', body: 'Chemical composition validation, stoichiometry parser, and elemental normalization.', tag: '[Input Parser]' },
  { n: '02', icon: 'psychology', title: 'ML Prediction', body: 'Composition-descriptor regressors plus conditional band-gap regression for screened properties.', tag: '[Four ML models]' },
  { n: '03', icon: 'bubble_chart', title: 'Material Discovery', body: 'Similarity querying over the 10,000-record sample with fast nearest-neighbor search.', tag: '[Similarity Index]' },
  { n: '04', icon: 'verified', title: 'Candidate Exploration', body: 'Density-first constraint screening against the Phase 5 lightweight-stable candidate pool.', tag: '[Ranking workflow]' },
]

export default function PipelineSteps() {
  return (
    <section className="w-full mt-16 pb-12">
      <div className="text-center max-w-xl mx-auto mb-10">
        <span className="font-label-code text-label-code uppercase tracking-wider text-secondary">
          Computational Pipeline
        </span>
        <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">How MaterialMatch works</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-2">
          From raw Hill formulation to screened candidate recommendation.
        </p>
      </div>
      <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="hidden md:block absolute top-1/2 left-12 right-12 h-0.5 bg-surface-container -translate-y-8 pointer-events-none -z-0" />
        {STEPS.map((step) => (
          <div key={step.n} className="relative z-10 bg-surface-container-lowest p-4 sm:p-space-md rounded-xl shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary font-label-code text-label-code font-bold flex items-center justify-center">
                {step.n}
              </div>
              <span className="material-symbols-outlined text-secondary text-[20px]">{step.icon}</span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{step.title}</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1.5">{step.body}</p>
            <div className="mt-4 pt-3 font-label-code text-label-code text-outline text-[11px]">
              {step.tag}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
