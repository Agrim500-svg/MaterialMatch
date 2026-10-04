import { Link } from 'react-router-dom'
import { subscriptFormula } from '../../utils/formatters'

export default function AiCta({ formula }) {
  return (
    <section className="w-full pb-space-lg">
      <div className="bg-primary-container text-on-primary rounded-xl p-4 sm:p-space-xl shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-space-lg">
        <div className="relative z-10 max-w-2xl min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-on-primary-container/20 text-secondary-fixed font-label-code text-[11px] sm:text-label-code mb-space-sm max-w-full">
            <span className="material-symbols-outlined text-[16px] shrink-0">neurology</span>
            <span className="truncate">MaterialMatch Computational Reasoning Engine</span>
          </div>
          <h3 className="font-headline-lg text-xl sm:text-headline-lg text-white font-bold tracking-tight break-words">
            Ask MaterialMatch AI about {subscriptFormula(formula)}
          </h3>
          <p className="font-body-md text-body-md text-primary-fixed-dim mt-2 leading-relaxed">
            Continue this analysis conversationally — similar materials, screening criteria, property
            comparisons, and candidate context grounded in the real engine output for {formula}.
          </p>
        </div>
        <div className="relative z-10 shrink-0 w-full md:w-auto">
          <Link
            to={`/assistant?material=${encodeURIComponent(formula)}`}
            className="inline-flex items-center justify-center gap-2 px-space-lg py-3 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-all font-headline-sm text-label-ui font-bold shadow-md w-full md:w-auto"
          >
            <span className="material-symbols-outlined text-[20px] text-secondary">chat</span>
            <span>Open AI Assistant</span>
          </Link>
        </div>
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />
      </div>
    </section>
  )
}
