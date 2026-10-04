import { Badge, ConfidenceIndicator } from './ui'

function fmt(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toFixed(digits)
}

function CardShell({ title, badge, children, footer }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[--color-ink-400]">{title}</h3>
        {badge}
      </div>
      <div className="mt-3">{children}</div>
      {footer && <div className="mt-3 border-t border-[--color-line] pt-3 text-xs text-[--color-ink-400]">{footer}</div>}
    </div>
  )
}

export function MaterialTypeCard({ block }) {
  if (!block) return null
  const isMetal = block.material_type === 'Metal'
  return (
    <CardShell
      title="Material Type"
      badge={<Badge tone={isMetal ? 'metal' : 'nonmetal'}>{isMetal ? 'METAL' : 'NON-METAL'}</Badge>}
      footer="ML classification — model confidence, not accuracy"
    >
      <p className={`text-2xl font-bold ${isMetal ? 'text-[--color-ink-900]' : 'text-emerald-700'}`}>
        {block.material_type}
      </p>
      <ConfidenceIndicator value={block.classification_probability} />
    </CardShell>
  )
}

export function BandGapCard({ block }) {
  if (!block) return null
  const routedAsMetal = block.stage === 'classifier_only'
  return (
    <CardShell
      title="Band Gap"
      badge={<Badge tone="ml">Predicted</Badge>}
      footer={routedAsMetal ? 'Classified as metal — band gap is 0 eV by definition' : 'Conditional non-metal regression (two-stage)'}
    >
      <p className="text-2xl font-bold text-[--color-navy-900]">
        {fmt(block.value)} <span className="text-sm font-medium text-[--color-ink-400]">eV</span>
      </p>
      {routedAsMetal && <p className="mt-1 text-xs text-[--color-ink-400]">Metal classification</p>}
    </CardShell>
  )
}

export function FormationEnergyCard({ block }) {
  if (!block) return null
  return (
    <CardShell title="Formation Energy" badge={<Badge tone="ml">Predicted</Badge>} footer="ML prediction (composition-only)">
      <p className="text-2xl font-bold text-[--color-navy-900]">
        {fmt(block.value)} <span className="text-sm font-medium text-[--color-ink-400]">eV/atom</span>
      </p>
    </CardShell>
  )
}

export function DensityCard({ block }) {
  if (!block) return null
  return (
    <CardShell title="Density" badge={<Badge tone="ml">Predicted</Badge>} footer="ML prediction (composition-only)">
      <p className="text-2xl font-bold text-[--color-navy-900]">
        {fmt(block.value)} <span className="text-sm font-medium text-[--color-ink-400]">g/cm³</span>
      </p>
    </CardShell>
  )
}

export default function PropertyCards({ predictions, reference }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MaterialTypeCard block={predictions?.material_type} />
        <BandGapCard block={predictions?.band_gap} />
        <FormationEnergyCard block={predictions?.formation_energy_per_atom} />
        <DensityCard block={predictions?.density} />
      </div>
      {reference && (
        <div className="mt-4 rounded-xl border border-[--color-line] bg-white/70 p-4">
          <div className="flex items-center gap-2">
            <Badge tone="db">Database values</Badge>
            <span className="text-xs text-[--color-ink-400]">Materials Project reference — not ML predictions</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            {[
              ['Band gap', reference.band_gap, 'eV'],
              ['Formation energy', reference.formation_energy_per_atom, 'eV/atom'],
              ['Density', reference.density, 'g/cm³'],
              ['Metal', reference.is_metal == null ? null : reference.is_metal ? 'Yes' : 'No', ''],
              ['Stable', reference.is_stable == null ? null : reference.is_stable ? 'Yes' : 'No', ''],
              ['E above hull', reference.energy_above_hull, 'eV/atom'],
            ]
              .filter(([, v]) => v != null && v !== '' && !Number.isNaN(v))
              .map(([label, value, unit]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wide text-[--color-ink-400]">{label}</dt>
                  <dd className="font-medium text-[--color-ink-900]">
                    {typeof value === 'number' ? fmt(value, 3) : value} {unit && <span className="text-xs text-[--color-ink-400]">{unit}</span>}
                  </dd>
                </div>
              ))}
          </dl>
          {reference.material_id && (
            <p className="mt-3 text-xs text-[--color-ink-400]">Reference ID: {reference.material_id}</p>
          )}
        </div>
      )}
    </div>
  )
}
