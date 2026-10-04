// Centralized API client for the MaterialMind FastAPI backend.
// The backend always answers with the envelope
//   success: {"ok": true,  "data": {...}}
//   failure: {"ok": false, "error": {"type": ..., "message": ...}}
// so this layer unwraps `data` and throws a shaped error for non-2xx/ok:false.

export class ApiError extends Error {
  constructor(status, type, message) {
    super(message)
    this.status = status
    this.type = type || 'internal_error'
  }
}

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const url = (path) => `${BASE_URL}${path}`

async function post(path, body) {
  let response
  try {
    response = await fetch(url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'backend_unavailable', 'Cannot reach the MaterialMind backend.')
  }
  const payload = await response.json().catch(() => null)
  if (response.ok && payload?.ok) return payload.data
  const detail = payload?.detail
  const message =
    payload?.error?.message ||
    (Array.isArray(detail) ? detail.map((d) => d.msg).join('; ') : null) ||
    `Request failed with status ${response.status}.`
  throw new ApiError(response.status, payload?.error?.type, message)
}

async function postForm(path, formData) {
  let response
  try {
    response = await fetch(url(path), { method: 'POST', body: formData })
  } catch {
    throw new ApiError(0, 'backend_unavailable', 'Cannot reach the MaterialMind backend.')
  }
  const payload = await response.json().catch(() => null)
  if (response.ok && payload?.ok) return payload.data
  throw new ApiError(
    response.status,
    payload?.error?.type,
    payload?.error?.message || `Request failed with status ${response.status}.`,
  )
}

export const api = {
  discover: (query, k = 8) => post('/api/discover', { query, k }),
  predict: (query, target = 'all') => post('/api/predict', { query, target }),
  similar: (query, profile = 'combined', k = 12) => post('/api/similar', { query, profile, k }),
  rank: (params = 20) => {
    const payload =
      typeof params === 'number'
        ? { k: params, include_predictions: true }
        : { include_predictions: true, ...params }
    return post('/api/rank', payload)
  },
  searchImage: (file, mode = 'auto', k = 8) => {
    const formData = new FormData()
    formData.append('file', file)
    return postForm(`/api/search-image?mode=${mode}&k=${k}`, formData)
  },
  chat: (message, history = []) => post('/api/chat', { message, history }),
}

export async function fetchLandscapeSummary() {
  const response = await fetch(url('/api/landscape/summary'))
  const payload = await response.json().catch(() => null)
  if (response.ok && payload?.ok) return payload.data
  throw new ApiError(response.status, payload?.error?.type, payload?.error?.message || 'Landscape unavailable.')
}

export const landscapeImageUrl = (kind) => `${BASE_URL}/api/landscape/image?kind=${kind}`

export async function fetchHealth() {
  try {
    const response = await fetch(url('/api/health'))
    const payload = await response.json()
    return response.ok && payload?.ok === true
  } catch {
    return false
  }
}
