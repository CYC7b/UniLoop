import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { translations } from '../lib/i18n'
import { CATEGORY_DEF } from '../services/productService'

const UIContext = createContext(null)

export const UIProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => localStorage.getItem('app_language') || 'zh')
  const [toast, setToast] = useState(null)
  const [userLocation, setUserLocation] = useState(null)

  useEffect(() => {
    localStorage.setItem('app_language', language)
  }, [language])

  const showToast = useCallback((type, message, duration = 3000) => {
    setToast({ type, message, duration })
  }, [])

  const clearToast = useCallback(() => setToast(null), [])
  const toggleLanguage = useCallback(() => {
    setLanguage(prev => (prev === 'zh' ? 'en' : 'zh'))
  }, [])
  const normalize = useCallback((str) => str.toLowerCase().replace(/[^a-z0-9]/g, ''), [])

  const value = useMemo(() => ({
    language,
    translations,
    categories: CATEGORY_DEF,
    toggleLanguage,
    toast,
    showToast,
    clearToast,
    userLocation,
    setUserLocation,
    normalize
  }), [language, toggleLanguage, toast, showToast, clearToast, userLocation, normalize])

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export const useUI = () => useContext(UIContext)
