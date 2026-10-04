import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { canonicalizeFormula } from '../utils/formatters'
import IdentifierChassis from '../components/analysis/IdentifierChassis'
import PropertyGrid from '../components/analysis/PropertyGrid'
import DiscoveryTabs from '../components/analysis/DiscoveryTabs'
import AiCta from '../components/analysis/AiCta'
import { EmptyState, ErrorState, LoadingState } from '../components/ui'

export default function AnalysisPage() {
  const { formula } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  // Redirect to canonical formula casing if different (e.g. /analyze/si -> /analyze/Si)
  useEffect(() => {
    if (formula) {
      const canonical = canonicalizeFormula(formula)
      if (canonical && canonical !== formula) {
        navigate(`/analyze/${encodeURIComponent(canonical)}`, { replace: true })
      }
    }
  }, [formula, navigate])

  const run = () => {
    if (!formula) return
    setLoading(true)
    setError(null)
    const target = canonicalizeFormula(formula)
    api
      .discover(target, 6)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setData(null)
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formula])

  return (
    <div className="flex flex-col w-full">
      {formula && <IdentifierChassis formula={formula} data={data} onReanalyze={run} />}

      {loading && <LoadingState label={`Analyzing material (${formula})…`} />}
      {error && <ErrorState error={error} onRetry={run} />}
      {!loading && !error && !data && (
        <EmptyState title="No analysis available" hint="Check the formula or try again." />
      )}

      {data && (
        <>
          <PropertyGrid predictions={data.ml_prediction} reference={data.resolved_reference} />
          <DiscoveryTabs data={data} />
          <AiCta formula={data.resolved_reference?.formula_pretty || formula} />
        </>
      )}
    </div>
  )
}
