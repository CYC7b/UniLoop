import { api } from '../lib/api'

export const loginAdmin = async (email, password) => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(data?.error || `登录失败 (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

export const getStats = () => api.get('/api/admin/stats')

export const listProducts = (params) => api.get(`/api/admin/products?${params}`)
export const updateProductStatus = (id, status) => api.put(`/api/admin/products/${id}/status`, { status })
export const deleteProduct = (id) => api.del(`/api/admin/products/${id}`)

export const listReports = (params) => api.get(`/api/admin/reports?${params}`)
export const resolveReport = (id) => api.put(`/api/admin/reports/${id}/resolve`)
export const deleteReport = (id) => api.del(`/api/admin/reports/${id}`)

export const listUsers = (params) => api.get(`/api/admin/users?${params}`)
export const updateUserVerification = (id, status) => api.put(`/api/admin/users/${id}/verification`, { status })
export const deleteUser = (id) => api.del(`/api/admin/users/${id}`)
