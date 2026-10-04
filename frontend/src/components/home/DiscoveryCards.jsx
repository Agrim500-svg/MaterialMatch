const CARDS = [
  {
    icon: 'grain',
    title: 'Material Properties',
    body: 'Predict material type, band gap classification, thermodynamic formation energy, and theoretical bulk density.',
    tags: ['Classification', 'Conditional ML'],
  },
  {
    icon: 'share',
    title: 'Similar Materials',
    body: 'Find materials with similar stoichiometric composition and electronic response over the local material index.',
    tags: ['Embedding Search', 'Cosine Metric'],
  },
  {
    icon: 'scatter_plot',
    title: 'Material Landscape',
    body: 'Explore crystal regimes through PCA projections and cluster regions of phase space.',
    tags: ['High-dim Projection', 'Latent Space'],
  },
  {
    icon: 'track_changes',
    title: 'Candidate Discovery',
    body: 'Identify stable crystals matching density and band-gap screens for optical and electronic applications.',
    tags: ['Multi-objective', 'Property Filters'],
  },
]

export default function DiscoveryCards() {
  return (
    <section className="w-full mt-14">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <span className="font-label-code text-label-code uppercase tracking-wider text-secondary">
            Discovery Capabilities
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">What you can discover</h2>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          Designed for researchers, solid-state chemists, and computational materials engineers
          targeting rapid synthesis.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">
        {CARDS.map((card) => (
          <div
            key={card.title}
            className="bg-surface-container-lowest rounded-xl p-4 sm:p-space-lg shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary group-hover:bg-primary-container group-hover:text-on-primary transition-colors duration-200 mb-5">
                <span className="material-symbols-outlined text-[26px]">{card.icon}</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{card.title}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">{card.body}</p>
            </div>
            <div className="mt-6 pt-4 flex flex-wrap gap-1.5">
              {card.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded bg-surface-container font-label-code text-label-code text-on-surface-variant"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
