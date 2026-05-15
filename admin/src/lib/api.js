const API_URL = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'admin_token'

export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function setToken(token) { localStorage.setItem(TOKEN_KEY, token) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }

async function request(method, path, body) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 || res.status === 403) {
    clearToken()
    window.location.reload()
    return
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
}
