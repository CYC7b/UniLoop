import { api } from '../lib/api'

export const getPublicProfile = (userId) => api.get(`/api/profiles/${userId}`)
export const updateMyProfile = ({ name, school }) => api.put('/api/me/profile', { name, school })

export function uploadMyAvatar(file) {
  const formData = new FormData()
  formData.append('avatar', file)
  return api.upload('/api/me/avatar', formData)
}

export function submitVerificationDocument(file) {
  const formData = new FormData()
  formData.append('document', file)
  return api.upload('/api/me/verify-doc', formData)
}
