import React, { createContext, useContext, useState } from 'react'
import { translations } from '../lib/i18n'

const LangContext = createContext()

export const LangProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('admin_lang') || 'zh')

  const toggleLang = () => {
    const next = lang === 'zh' ? 'en' : 'zh'
    setLang(next)
    localStorage.setItem('admin_lang', next)
  }

  const t = translations[lang]

  return (
    <LangContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
