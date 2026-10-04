// Stitch-identical 2x2 property card grid, fed by real V1 predictions +
// database reference values from /api/discover. Nothing is fabricated:
// values the backend cannot supply (space group, lattice params, DOS shape)
// render as N/A instead.

function Card({ overline, title, badge, main, note, footer }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-space-lg shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="font-label-code text-[11px] sm:text-label-code text-on-surface-variant uppercase tracking-wider">
            {overline}
          </span>
          <h3 className="font-headline-sm text-lg sm:text-headline-sm text-on-surface font-bold mt-0.5">{title}</h3>
        </div>
        <div className="self-start sm:self-auto shrink-0">
          {badge}
        </div>
      </div>
      <div className="py-space-md min-w-0">
        {main}
        {note && (
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed break-words">{note}</p>
        )}
      </div>
      {footer}
    </div>
  )
}

function MetricValue({ value, unit, chip }) {
  return (
    <div className="flex items-baseline gap-space-xs flex-wrap min-w-0">
      <span className="font-metric-val text-2xl sm:text-3xl md:text-[2.5rem] font-bold text-on-surface tracking-tight leading-none break-words">
        {value ?? 'N/A'}
      </span>
      {unit && (
        <span className="font-metric-unit text-lg sm:text-headline-sm text-on-surface-variant font-medium">{unit}</span>
      )}
      {chip && (
        <span className="ml-1 sm:ml-2 font-label-code text-[11px] sm:text-label-code px-2 py-0.5 bg-surface-container-low text-on-surface-variant rounded">
          {chip}
        </span>
      )}
    </div>
  )
}

export default function PropertyGrid({ predictions, reference }) {
  const materialType = predictions?.material_type
  const bandGap = predictions?.band_gap
  const formationEnergy = predictions?.formation_energy_per_atom
  const density = predictions?.density

  const isMetal = materialType?.material_type === 'Metal'
  const confidencePct =
    materialType?.classification_probability != null
      ? materialType.classification_probability * 100
      : null

  const gapValue = bandGap?.value
  const gapPct = gapValue != null ? Math.min(Math.max(gapValue / 5, 0), 1) * 100 : 0
  const isMetalRoute = bandGap?.stage === 'classifier_only'

  return (
    <section className="w-full pb-space-xl">
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-space-xs pb-space-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-secondary" />
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
              Material Properties
            </h2>
            <span className="font-label-code text-label-code text-secondary uppercase bg-surface-container-low px-2 py-0.5 rounded">
              ML Predictions
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Machine learning predictions from the MaterialMatch V1 pipeline; band gap is evaluated
            conditionally after the metal/non-metal classification. Estimates are not experimental
            or DFT values.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
        {/* CARD 1: MATERIAL TYPE */}
        <Card
          overline="Classification Subsystem"
          title="Material Type"
          badge={
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low text-secondary font-label-code text-label-code">
              <span className="material-symbols-outlined text-[14px]">psychology</span>
              Binary Classifier
            </span>
          }
          main={
            <>
              <MetricValue value={materialType?.material_type ? materialType.material_type.toUpperCase() : null} />
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                Binary metal/non-metal classification from composition only. Classification
                confidence below is a model self-confidence score, not accuracy.
              </p>
            </>
          }
          footer={
            <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-space-xs">
              <div className="flex items-center justify-between font-label-code text-label-code">
                <span className="text-on-surface-variant">Classification Confidence:</span>
                <span className="font-metric-val text-on-surface font-semibold">
                  {confidencePct != null ? `${confidencePct.toFixed(1)}%` : 'N/A'}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${confidencePct != null && confidencePct < 67 ? 'bg-amber-500' : 'bg-secondary'}`}
                  style={{ width: confidencePct != null ? `${confidencePct}%` : '0%' }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-label-code text-on-surface-variant pt-0.5">
                <span>Threshold (0.50)</span>
                {confidencePct != null && confidencePct < 67 && (
                  <span className="text-amber-700 font-medium">Low-confidence classification</span>
                )}
              </div>
            </div>
          }
        />

        {/* CARD 2: BAND GAP */}
        <Card
          overline="Electronic Property"
          title="Band Gap"
          badge={
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-code text-label-code">
              {isMetalRoute ? 'Metal → 0 eV' : 'Conditional ML'}
            </span>
          }
          main={
            <>
              <MetricValue
                value={gapValue != null ? gapValue.toFixed(2) : null}
                unit="eV"
              />
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                {isMetalRoute
                  ? 'The classifier routed this material through the metal branch, so the band gap is 0 eV by definition — the conditional regressor was not invoked.'
                  : 'Non-metal branch: band gap estimated by the conditional non-metal regressor trained on band_gap > 0 records.'}
              </p>
            </>
          }
          footer={
            <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-2">
              <div className="flex items-center justify-between font-label-code text-[11px] text-on-surface-variant">
                <span>Metal (0.0 eV)</span>
                <span className="text-secondary font-semibold">
                  {gapValue != null ? `${gapValue.toFixed(2)} eV` : 'N/A'}
                </span>
                <span>Wide-gap (&gt;3.0 eV)</span>
              </div>
              <div className="relative w-full h-3 bg-surface-container-high rounded-full flex items-center px-1">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-secondary-container via-secondary to-primary-container rounded-full opacity-40"
                  style={{ width: `${gapPct}%` }}
                />
                {gapValue != null && (
                  <div className="absolute flex items-center justify-center -translate-x-1/2" style={{ left: `${gapPct}%` }}>
                    <span className="w-3.5 h-3.5 rounded-full bg-secondary ring-2 ring-surface-container-lowest shadow-sm" />
                  </div>
                )}
              </div>
              <div className="flex justify-between font-label-code text-[10px] text-on-surface-variant">
                <span>Conductor</span>
                <span className="text-on-surface font-semibold">
                  {isMetal ? 'Metal' : gapValue != null && gapValue > 3 ? 'Wide-gap' : gapValue != null ? 'Semiconductor regime' : '—'}
                </span>
                <span>Insulator</span>
              </div>
            </div>
          }
        />

        {/* CARD 3: FORMATION ENERGY */}
        <Card
          overline="Thermodynamics"
          title="Formation Energy"
          badge={
            formationEnergy?.value != null ? (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-code text-label-code font-semibold ${
                formationEnergy.value < 0
                  ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                  : 'bg-error-container text-on-error-container'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${formationEnergy.value < 0 ? 'bg-on-tertiary-container' : 'bg-error'}`} />
                {formationEnergy.value < 0 ? 'Exothermic (ΔEf < 0)' : 'Endothermic (ΔEf ≥ 0)'}
              </span>
            ) : null
          }
          main={
            <>
              <MetricValue
                value={formationEnergy?.value != null ? formationEnergy.value.toFixed(2) : null}
                unit="eV/atom"
              />
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                ML regression from composition descriptors only. Database value shown below when the
                record exists in the local sample.
              </p>
            </>
          }
          footer={
            <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-label-code text-label-code">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">database</span>
                <span className="text-on-surface">Database value (MP sample):</span>
              </div>
              <span className="font-metric-val text-on-surface font-semibold">
                {reference?.formation_energy_per_atom != null
                  ? `${Number(reference.formation_energy_per_atom).toFixed(2)} `
                  : 'N/A '}
                <span className="font-metric-unit text-on-surface-variant font-normal">eV/atom</span>
              </span>
            </div>
          }
        />

        {/* CARD 4: DENSITY */}
        <Card
          overline="Crystallographic Metric"
          title="Density"
          badge={
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-code text-label-code">
              ML prediction
            </span>
          }
          main={
            <>
              <MetricValue
                value={density?.value != null ? density.value.toFixed(2) : null}
                unit="g/cm³"
                chip={isMetal != null ? `Classified ${isMetal ? 'Metal' : 'Non-Metal'}` : null}
              />
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 leading-relaxed">
                Composition-only regression of volumetric mass density. Database value shown below
                when the exact record is present locally.
              </p>
            </>
          }
          footer={
            <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-label-code text-label-code">
              <span className="text-on-surface-variant">Database value (MP sample):</span>
              <span className="font-metric-val text-on-surface font-semibold">
                {reference?.density != null ? `${Number(reference.density).toFixed(2)} ` : 'N/A '}
                <span className="font-metric-unit text-on-surface-variant font-normal">g/cm³</span>
              </span>
            </div>
          }
        />
      </div>
    </section>
  )
}
