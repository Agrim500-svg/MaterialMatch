import { useNavigate } from 'react-router-dom'
import { Badge } from './ui'

// One card per material; fields shown only when the API actually returns them.
export default function MaterialCard({ material, showScore = true }) {
  const navigate = useNavigate()
  const formula = material?.formula_pretty || material?.formula || '—'
  const fields = [
    ['Type', material.is_metal == null ? null : material.is_metal ? 'Metal' : 'Non-Metal'],
    ['Band gap', material.band_gap != null ? `${Number(material.band_gap).toFixed(2)} eV` : null],
    ['Density', material.density != null ? `${Number(material.density).toFixed(2)} g/cm³` : null],
    ['Formation energy', material.formation_energy_per_atom != null ? `${Number(material.formation_energy_per_atom).toFixed(2)} eV/atom` : null],
  ].filter(([, v]) => v != null)

  return (
    <div className="card flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-base font-semibold text-[--color-navy-900]">{formula}</h4>
        {showScore && material.similarity_score != null && (
          <Badge tone="neutral" title="Relative similarity, not a probability">
            {(Number(material.similarity_score) * 100).toFixed(1)}%
          </Badge>
        )}
      </div>
      {material.material_id && <p className="mt-0.5 text-xs text-[--color-ink-400]">{material.material_id}</p>}
      {fields.length > 0 && (
        <dl className="mt-3 space-y-1 text-xs">
          {fields.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-[--color-ink-400]">{label}</dt>
              <dd className="font-medium text-[--color-ink-900]">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {material.similarity_reasons && (
        <p className="mt-2 line-clamp-2 text-xs text-[--color-ink-400]" title={material.similarity_reasons}>
          {material.similarity_reasons}
        </p>
      )}
      <button
        onClick={() => navigate(`/analyze/${encodeURIComponent(formula)}`)}
        className="mt-3 w-full rounded-lg border border-[--color-navy-800] px-3 py-1.5 text-sm font-medium text-[--color-navy-800] transition hover:bg-[--color-navy-900] hover:text-white"
      >
        Analyze Material
      </button>
    </div>
  )
}
