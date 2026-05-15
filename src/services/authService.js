import { api } from '../lib/api'

export const getCurrentUser = () => api.get('/api/auth/me')
export const login = (email, password) => api.post('/api/auth/login', { email, password })
export const register = (email, password, name) => api.post('/api/auth/register', { email, password, name })
export const sendOTP = (email) => api.post('/api/auth/send-otp', { email })
export const verifyOTPCode = (email, code) => api.post('/api/auth/verify-otp', { email, code })
