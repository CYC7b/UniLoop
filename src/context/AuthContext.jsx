import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearToken, getToken, setToken } from '../lib/api'
import * as authService from '../services/authService'
import * as profileService from '../services/profileService'
import { DEFAULT_AVATAR } from '../lib/avatar'
import { useUI } from './UIContext'

const AuthContext = createContext(null)

const guestUser = {
  name: 'Guest User',
  school: 'Universiti Malaya (UM)',
  verified: false,
  verificationStatus: 'unverified',
  avatar: DEFAULT_AVATAR
}

function mapProfile(profile) {
  return {
    id: profile.id,
    name: profile.full_name || profile.email?.split('@')[0] || 'User',
    school: profile.school || 'Universiti Malaya (UM)',
    verified: profile.verification_status === 'verified',
    verificationStatus: profile.verification_status || 'unverified',
    avatar: profile.avatar_url || DEFAULT_AVATAR,
    email: profile.email
  }
}

function sessionFromProfile(profile) {
  return { user: { id: profile.id, email: profile.email } }
}

export const AuthProvider = ({ children }) => {
  const { language, showToast } = useUI()
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(guestUser)
  const [authLoading, setAuthLoading] = useState(true)

  const applyProfile = useCallback((profile) => {
    setUser(mapProfile(profile))
  }, [])

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await authService.getCurrentUser()
      applyProfile(profile)
      return profile
    } catch (err) {
      console.error('Error fetching profile:', err)
      return null
    }
  }, [applyProfile])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setAuthLoading(false)
      return
    }

    authService.getCurrentUser().then(profile => {
      setSession(sessionFromProfile(profile))
      applyProfile(profile)
    }).catch(() => {
      clearToken()
      setSession(null)
      setUser(guestUser)
    }).finally(() => {
      setAuthLoading(false)
    })
  }, [applyProfile])

  const loginUser = useCallback(async (email, password) => {
    const res = await authService.login(email, password)
    setToken(res.token)
    setSession(sessionFromProfile(res.profile))
    applyProfile(res.profile)
    return res
  }, [applyProfile])

  const registerUser = useCallback(async (email, password, fullName) => {
    const res = await authService.register(email, password, fullName)
    setToken(res.token)
    setSession(sessionFromProfile(res.profile))
    applyProfile(res.profile)
    return res
  }, [applyProfile])

  const logoutUser = useCallback(async () => {
    clearToken()
    setSession(null)
    setUser(guestUser)
  }, [])

  const updateVerificationStatus = useCallback(async (status) => {
    if (!session?.user) return
    setUser(prev => ({ ...prev, verificationStatus: status, verified: status === 'verified' }))
    return true
  }, [session])

  const sendVerificationEmail = useCallback(async (email) => {
    if (!email.toLowerCase().endsWith('.edu.my')) {
      throw new Error('Invalid email domain')
    }
    await authService.sendOTP(email)
    return true
  }, [])

  const verifyOTP = useCallback(async (email, code) => {
    await authService.verifyOTPCode(email, code)
    setUser(prev => ({ ...prev, verificationStatus: 'verified', verified: true }))
    return true
  }, [])

  const uploadVerificationDoc = useCallback(async (file) => {
    if (!session?.user) throw new Error('Not logged in')
    await profileService.submitVerificationDocument(file)
    setUser(prev => ({ ...prev, verificationStatus: 'pending' }))
    return true
  }, [session])

  const uploadAvatar = useCallback(async (rawFile) => {
    if (!session?.user) return
    const { compressAvatar } = await import('../lib/imageUtils.js')
    let file
    try {
      file = await compressAvatar(rawFile)
    } catch {
      file = rawFile
    }

    try {
      const res = await profileService.uploadMyAvatar(file)
      setUser(prev => ({ ...prev, avatar: res.avatar_url }))
      showToast('success', language === 'zh' ? '头像已更新' : 'Avatar updated')
    } catch (err) {
      console.error('Avatar upload error:', err)
      showToast('error', language === 'zh' ? '头像上传失败' : 'Avatar upload failed')
    }
  }, [language, session, showToast])

  const updateUser = useCallback(async ({ name, school }) => {
    if (!session?.user) return
    try {
      await profileService.updateMyProfile({ name, school })
      setUser(prev => ({ ...prev, name, school }))
    } catch (err) {
      console.error('Update user error:', err)
    }
  }, [session])

  const value = useMemo(() => ({
    session,
    user,
    authLoading,
    fetchProfile,
    loginUser,
    registerUser,
    logoutUser,
    updateVerificationStatus,
    sendVerificationEmail,
    verifyOTP,
    uploadVerificationDoc,
    uploadAvatar,
    updateUser
  }), [session, user, authLoading, fetchProfile, loginUser, registerUser, logoutUser,
    updateVerificationStatus, sendVerificationEmail, verifyOTP, uploadVerificationDoc, uploadAvatar, updateUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
