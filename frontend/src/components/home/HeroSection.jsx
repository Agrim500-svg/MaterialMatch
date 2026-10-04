import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LatticeBackdrop from './LatticeBackdrop'
import {
  canonicalizeFormula,
  parseFormulaParts,
  formulaBreakdown,
  subscriptFormula,
} from '../../utils/formatters'

const EXAMPLE_CHIPS = ['Si', 'Fe', 'GaAs', 'SiC', 'Fe2O3', 'TiO2', 'GaN']

export default function HeroSection({ onPreview }) {
  const [value, setValue] = useState('')
  const navigate = useNavigate()

  const trimmed = value.trim()
  const isMpId = /^mp-\w+/i.test(trimmed)
  const canonical = canonicalizeFormula(trimmed)
  const parts = parseFormulaParts(canonical)
  const breakdown = parts ? formulaBreakdown(parts) : null

  const pickChip = (formula) => {
    setValue(formula)
    onPreview?.(formula)
  }

  const submit = (e) => {
    e.preventDefault()
    if (!trimmed) return
    const target = isMpId ? trimmed.toLowerCase() : canonical || trimmed
    navigate(`/analyze/${encodeURIComponent(target)}`)
  }

  return (
    <section className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-surface via-surface-container-low to-surface pt-8 sm:pt-12 pb-10 sm:pb-16 px-3 sm:px-space-xl">
      <LatticeBackdrop />
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Category pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-lowest shadow-sm mb-5 sm:mb-6 max-w-full">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
          </span>
          <span className="font-label-code text-[11px] sm:text-label-code text-secondary tracking-wider uppercase font-semibold truncate">
            Computational Materials Science &amp; ML Screening
          </span>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl md:text-display text-on-surface tracking-tight max-w-2xl text-balance">
          Discover Materials with AI
        </h1>
        <p className="font-body-md sm:font-body-lg text-body-md sm:text-body-lg text-on-surface-variant mt-3 sm:mt-4 max-w-xl text-balance">
          Predict crystalline properties, screen similar crystallographic lattices, and identify
          optimal compound candidates in milliseconds using machine learning.
        </p>

        {/* Search card */}
        <div className="w-full mt-8 sm:mt-10 p-2 sm:p-2.5 bg-surface-container-lowest rounded-xl shadow-md transition-all duration-200">
          <form className="flex flex-col md:flex-row items-stretch gap-2" onSubmit={submit}>
            <div className="relative flex-1 flex items-center">
              <div className="absolute left-3.5 sm:left-4 flex items-center pointer-events-none text-secondary">
                <span className="material-symbols-outlined text-[20px] sm:text-[22px]">science</span>
              </div>
              <input
                autoComplete="off"
                spellCheck={false}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-surface-container-low rounded-lg font-metric-val text-sm sm:text-metric-val text-on-surface placeholder:text-outline/70 placeholder:font-body-md placeholder:text-xs sm:placeholder:text-sm focus:bg-surface-container-lowest focus:outline-none transition-colors"
                placeholder="Enter formula e.g. GaN, Fe2O3, BaTiO3, or mp-149..."
                type="text"
              />
              <span className="hidden sm:inline-flex absolute right-3 px-2 py-1 bg-surface-container text-on-surface-variant font-label-code text-label-code rounded">
                Formula / MP-ID
              </span>
            </div>
            <button
              type="submit"
              disabled={!trimmed}
              className="group relative inline-flex items-center justify-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 bg-primary-container text-on-primary rounded-lg font-label-ui text-xs sm:text-label-ui hover:bg-on-surface transition-all duration-150 shadow-sm shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <span>Analyze Material</span>
              <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-0.5">
                arrow_forward
              </span>
            </button>
          </form>

          {/* Live formula feedback */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-2 sm:px-3 pt-3 mt-2 font-label-code text-label-code text-on-surface-variant">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
              {trimmed === '' ? (
                <span className="inline-flex items-center gap-1.5 text-outline font-medium shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
                  <span>Awaiting input</span>
                </span>
              ) : isMpId ? (
                <span className="inline-flex items-center gap-1.5 text-secondary font-medium shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  <span>Materials Project ID</span>
                </span>
              ) : parts !== null ? (
                <span className="inline-flex items-center gap-1.5 text-on-tertiary-container font-medium shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-on-tertiary-container" />
                  <span>Stoichiometry parsed</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-error font-medium shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-error" />
                  <span>Unrecognized formula</span>
                </span>
              )}
              <span className="text-outline-variant hidden sm:inline">|</span>
              <span className="text-on-surface truncate max-w-[200px] sm:max-w-none">
                {trimmed ? (isMpId ? trimmed.toLowerCase() : breakdown || trimmed) : 'e.g. GaN, Fe2O3, mp-149'}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-on-surface-variant font-metric-unit text-metric-unit shrink-0">
              <span>Parse: <strong className="text-secondary font-semibold">Local</strong></span>
            </div>
          </div>
        </div>

        {/* Example chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-on-surface-variant">
          <span className="font-label-ui text-label-ui uppercase tracking-wider text-outline text-xs mr-1">
            Try example:
          </span>
          {EXAMPLE_CHIPS.map((chip) => {
            const active = value === chip
            return (
              <button
                key={chip}
                type="button"
                onClick={() => pickChip(chip)}
                className={`px-3 py-1 rounded font-label-code text-label-code transition-colors cursor-pointer ${
                  active
                    ? 'bg-secondary-fixed text-on-secondary-fixed font-semibold'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                }`}
              >
                {subscriptFormula(chip)}
              </button>
            )
          })}
        </div>

        {/* Honest model status strip */}
        <div className="mt-8 sm:mt-10 inline-flex flex-wrap items-center justify-center gap-y-2 gap-x-4 sm:gap-x-6 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl sm:rounded-full bg-surface-container-lowest/80 backdrop-blur-md shadow-sm text-on-surface-variant font-label-code text-[11px] sm:text-label-code">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
            <span className="text-on-surface font-medium">4 Core ML Models Active</span>
          </div>
          <span className="text-outline-variant hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-secondary">bolt</span>
            <span>Local Inference</span>
          </div>
          <span className="text-outline-variant hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-on-surface">database</span>
            <span className="text-on-surface font-semibold">10,000</span>
            <span>Records in Sample</span>
          </div>
        </div>
      </div>
    </section>
  )
}
