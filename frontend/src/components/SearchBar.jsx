import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const EXAMPLE_FORMULAS = ['Si', 'Fe', 'GaAs', 'SiC', 'Fe2O3']

export default function SearchBar({ initial = '', large = false }) {
  const [value, setValue] = useState(initial)
  const navigate = useNavigate()

  const submit = (formula) => {
    const trimmed = String(formula ?? value).trim()
    if (!trimmed) return
    navigate(`/analyze/${encodeURIComponent(trimmed)}`)
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className={`flex w-full gap-2 ${large ? 'max-w-2xl mx-auto' : ''}`}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter chemical formula (e.g. GaAs, SiC) or Material ID (mp-…)"
          className={`flex-1 rounded-lg border border-[--color-line] bg-white px-4 text-sm outline-none focus:border-[--color-brand-500] focus:ring-2 focus:ring-blue-100 ${
            large ? 'py-3' : 'py-2.5'
          }`}
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className={`rounded-lg bg-[--color-navy-900] px-5 text-sm font-semibold text-white transition hover:bg-[--color-navy-800] disabled:cursor-not-allowed disabled:opacity-50 ${
            large ? 'py-3' : 'py-2.5'
          }`}
        >
          Analyze Material
        </button>
      </form>
      {large && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[--color-ink-400]">
          <span>Try an example:</span>
          {EXAMPLE_FORMULAS.map((f) => (
            <button
              key={f}
              onClick={() => submit(f)}
              className="rounded-full border border-[--color-line] bg-white px-3 py-1 font-medium text-[--color-navy-800] hover:border-[--color-brand-400] hover:bg-blue-50"
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
