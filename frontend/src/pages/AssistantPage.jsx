import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import EngineBlocks from '../components/assistant/EngineBlocks'
import { intentLabel } from '../utils/formatters'

const SUGGESTED = [
  { label: 'Analyze Si', icon: 'search' },
  { label: 'Find low-density materials', icon: 'filter_alt' },
  { label: 'Find materials with band gap 1–3 eV', icon: 'equalizer' },
  { label: 'Find similar materials', icon: 'hub' },
  { label: 'Explain conditional band gap prediction', icon: 'help' },
]

const GREETING = {
  role: 'assistant',
  text: 'I can analyze material properties (type, band gap, formation energy, density), find similar materials, and rank candidates. Ask me about a formula like Si, GaAs, or SiC.',
  intent: null,
  engine: null,
  route: null,
  latencyMs: null,
  at: new Date(),
}

function timeLabel(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function UserMessage({ message }) {
  return (
    <div className="flex items-start gap-space-md justify-end">
      <div className="flex flex-col items-end gap-1.5 max-w-2xl">
        <div className="flex items-center gap-2">
          <span className="font-label-code text-label-code text-on-surface-variant">You</span>
          <span className="text-outline text-xs">{timeLabel(message.at)}</span>
        </div>
        <div className="bg-surface-container-high text-on-surface px-3.5 sm:px-space-lg py-2.5 sm:py-3 rounded-2xl rounded-tr-none shadow-sm font-body-md sm:font-body-lg text-body-md sm:text-body-lg break-words">
          {message.text}
        </div>
      </div>
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 text-on-surface-variant font-label-code text-xs sm:text-label-code font-semibold shadow-sm">
        YOU
      </div>
    </div>
  )
}

function AssistantMessage({ message, onRetry }) {
  const isError = message.blocked
  return (
    <div className="flex items-start gap-2.5 sm:gap-space-md justify-start">
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-sm">
        <span className="material-symbols-outlined text-[18px] sm:text-[20px]">cognition</span>
      </div>
      <div className="flex flex-col gap-2.5 sm:gap-space-md w-full max-w-3xl min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-label-code text-[11px] sm:text-label-code font-semibold text-secondary">MaterialMatch Co-Pilot</span>
          {message.intent && message.intent !== 'small_talk' && message.intent !== 'unclear' && (
            <span className="px-2 py-0.5 rounded bg-surface-container-low font-label-code text-[10px] sm:text-label-code text-on-tertiary-container">
              {intentLabel(message.intent)}
            </span>
          )}
          {message.latencyMs != null && (
            <span className="text-outline text-xs">{message.latencyMs} ms</span>
          )}
          {isError && (
            <span className="px-2 py-0.5 rounded bg-error-container font-label-code text-[10px] sm:text-label-code text-on-error-container">
              request failed
            </span>
          )}
        </div>
        <div className="bg-surface-container-low text-on-surface p-3.5 sm:p-space-lg rounded-2xl rounded-tl-none font-body-md text-body-md leading-relaxed whitespace-pre-wrap break-words">
          {message.text}
          {isError && message.retryText && onRetry && (
            <div className="mt-3 pt-2.5 border-t border-outline-variant/30 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRetry(message.retryText)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-label-code text-on-surface transition-colors cursor-pointer border border-outline-variant/40"
              >
                <span className="material-symbols-outlined text-[14px] text-secondary">refresh</span>
                <span>Retry this query</span>
              </button>
            </div>
          )}
        </div>
        {message.route && (message.route.intent || message.route.query || message.route.target) && (
          <div className="flex flex-wrap items-center gap-2 text-xs font-label-code text-on-surface-variant">
            <span>Routed:</span>
            {message.route.intent && (
              <span className="px-2 py-0.5 rounded bg-surface-container font-medium text-on-surface">
                {message.route.intent}
              </span>
            )}
            {message.route.query && (
              <span className="px-2 py-0.5 rounded bg-surface-container font-medium text-on-surface">
                {message.route.query}
              </span>
            )}
            {message.route.target && message.route.intent === 'predict_property' && (
              <span className="px-2 py-0.5 rounded bg-surface-container font-medium text-on-surface">
                target: {message.route.target}
              </span>
            )}
          </div>
        )}
        <EngineBlocks engine={message.engine} />
      </div>
    </div>
  )
}

const RAIL_METRICS = [
  ['Local Sample', '10,000 records'],
  ['Feature Space', '153 composition descriptors'],
  ['Models Online', '4 V1 components'],
  ['Formation Energy MAE', '0.18 eV/atom (holdout)'],
  ['Density MAE', '0.38 g/cm³ (holdout)'],
  ['Band Gap MAE', '0.79 eV (non-metals, holdout)'],
  ['Classifier F1 (metal)', '0.82 (holdout)'],
]

export default function AssistantPage() {
  const [messages, setMessages] = useState([GREETING])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [searchParams] = useSearchParams()
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const sentInitial = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    const material = searchParams.get('material')
    if (material && !sentInitial.current) {
      sentInitial.current = true
      send(`Analyze ${material}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recentQueries = messages.filter((m) => m.role === 'user').slice(-6).reverse()

  const send = async (text) => {
    const message = (text ?? input).trim()
    if (!message || busy) return
    setInput('')
    const startedAt = performance.now()
    setMessages((m) => [...m, { role: 'user', text: message, at: new Date() }])
    setBusy(true)
    try {
      const history = messages
        .filter((m) => m.text && !m.blocked)
        .map(({ role, text }) => ({ role, content: text }))
      const result = await api.chat(message, history)
      const latencyMs = Math.max(1, Math.round(performance.now() - startedAt))
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: result.reply,
          engine: result.engine,
          route: result.route,
          intent: result.intent,
          latencyMs,
          at: new Date(),
        },
      ])
    } catch (error) {
      const latencyMs = Math.max(1, Math.round(performance.now() - startedAt))
      const isCloud = Boolean(import.meta.env.VITE_API_URL)
      const isTimeoutOrDown = latencyMs > 35000 || error?.status === 502 || error?.type === 'backend_unavailable'

      let errorText = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
      if (isCloud && isTimeoutOrDown) {
        errorText = 'The cloud server (Render free tier) was spinning up from sleep (~50s cold boot) or timed out. The server is now awake — please click "Retry this query" below!'
      } else {
        errorText = `I couldn't complete that: ${errorText}`
      }

      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: errorText,
          intent: null,
          blocked: true,
          retryText: message,
          latencyMs,
          at: new Date(),
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="py-space-lg flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-code text-label-code uppercase tracking-wider">
            <span>Computational Pipeline</span>
            <span>/</span>
            <span className="text-secondary font-semibold">Semantic Co-Pilot</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">MaterialMatch AI</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            Explore materials using natural language — answers are grounded in the MaterialMind discovery engine and its four V1 ML components.
          </p>
        </div>
        <div className="inline-flex flex-wrap items-center gap-space-xs px-3 py-1.5 rounded-2xl sm:rounded-full bg-surface-container text-on-surface font-label-code text-[11px] sm:text-label-code shadow-sm">
          <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse shrink-0" />
          <span className="text-on-surface-variant">Model:</span>
          <span className="font-medium text-on-surface">Gemini router + 4 ML components</span>
          <span className="text-outline text-xs hidden sm:inline">• grounded in engine</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg pb-space-xl">
        {/* Conversation */}
        <div className="xl:col-span-9 flex flex-col gap-space-lg">
          <div className="bg-surface-container-lowest rounded-xl p-3.5 sm:p-space-lg md:p-space-xl shadow-sm flex flex-col gap-space-xl min-h-[26rem] sm:min-h-[30rem]">
            {messages.map((message, index) =>
              message.role === 'user' ? (
                <UserMessage key={index} message={message} />
              ) : (
                <AssistantMessage key={index} message={message} onRetry={send} />
              ),
            )}
            {busy && (
              <div className="flex items-start gap-2.5 sm:gap-space-md justify-start">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">cognition</span>
                </div>
                <div className="flex items-center gap-2 bg-surface-container-low px-3.5 sm:px-space-lg py-3 rounded-2xl rounded-tl-none text-xs sm:text-sm text-on-surface-variant">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
                  Routing your question and calling engine tools…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions + composer */}
          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-secondary">tips_and_updates</span>
              <span className="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant">Suggested Inquiries</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => send(s.label)}
                  className="px-3 py-1.5 rounded-full bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors font-body-sm text-xs sm:text-body-sm shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px] text-secondary">{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative bg-surface-container-lowest p-2 rounded-2xl shadow-md">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center px-3 sm:px-space-md pt-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  rows={2}
                  className="w-full bg-transparent resize-none font-body-md text-sm sm:text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none leading-relaxed"
                  placeholder='Ask about a material or discovery criteria (e.g. "Analyze Si" or "top lightweight semiconductors")...'
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2 sm:px-space-sm pt-1.5 pb-1.5 bg-surface-container-low/50 rounded-xl">
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setInput((v) => (v.startsWith('Analyze ') ? v : `Analyze ${v}`))
                      textareaRef.current?.focus()
                    }}
                    className="p-1.5 sm:p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors flex items-center gap-1 font-label-code text-xs sm:text-label-code cursor-pointer"
                    title="Prefix the message to analyze a formula"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">attachment</span>
                    <span>Attach Formula</span>
                  </button>
                  <span className="p-1.5 sm:p-2 flex items-center gap-1 font-label-code text-xs sm:text-label-code text-on-surface-variant" title="Answers are generated only from engine results">
                    <span className="material-symbols-outlined text-[16px] sm:text-[18px]">tune</span>
                    <span className="hidden sm:inline">Engine-grounded</span>
                  </span>
                </div>
                <div className="flex items-center justify-end gap-space-sm">
                  <span className="hidden sm:inline font-label-code text-label-code text-outline">Press Enter ↵</span>
                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-on-primary-fixed font-label-ui text-xs sm:text-label-ui px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer w-full sm:w-auto"
                  >
                    <span>Synthesize Query</span>
                    <span className="material-symbols-outlined text-[16px]">send</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Right rail — honest engine context instead of fabricated stats */}
        <div className="xl:col-span-3 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <span className="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant">Engine Context</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">science</span>
            </div>
            <div className="flex flex-col gap-space-xs font-body-sm text-body-sm">
              {RAIL_METRICS.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <span className="text-on-surface-variant">{label}</span>
                  <span className="font-metric-val font-semibold text-on-surface">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-sm">
            <span className="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant">Classification Structure</span>
            {[
              ['Metal share of sample', '50.8%'],
              ['Non-metal share', '49.2%'],
              ['Band-gap model scope', 'Non-metals only'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between font-label-code text-label-code">
                <span className="text-on-surface-variant">{label}</span>
                <span className="text-on-surface font-semibold">{value}</span>
              </div>
            ))}
            <div className="mt-1 p-3 bg-surface-container-low rounded-lg flex items-start gap-2 text-on-surface-variant font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[18px] text-secondary shrink-0 mt-0.5">verified_user</span>
              <span>Responses may be generated by Gemini with real engine data; ML values remain screening estimates.</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-sm">
            <span className="font-label-ui text-label-ui uppercase tracking-wider text-on-surface-variant">This Session's Queries</span>
            {recentQueries.length === 0 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">No queries yet — ask above.</p>
            )}
            <div className="flex flex-col gap-2">
              {recentQueries.map((q, i) => (
                <button
                  key={i}
                  onClick={() => send(q.text)}
                  className="p-2 rounded-lg hover:bg-surface-container transition-colors flex flex-col gap-0.5 text-left"
                >
                  <span className="font-body-sm font-medium text-on-surface line-clamp-1">{q.text}</span>
                  <span className="font-label-code text-label-code text-on-surface-variant">{timeLabel(q.at)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
