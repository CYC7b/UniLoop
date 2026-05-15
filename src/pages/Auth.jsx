import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import Logo from '../components/Logo'
import { Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react'

const inputCls = "w-full rounded-xl pl-11 pr-4 py-3 text-sm outline-none transition-all font-medium text-uniloop-900 placeholder-uniloop-700/30"
const inputStyle = {
  background: 'rgba(250, 249, 247, 0.8)',
  border: '1px solid rgba(200, 120, 80, 0.3)',
}
const inputFocusStyle = "focus:ring-2 focus:ring-uniloop-300/50 focus:border-uniloop-400/60"

const Auth = () => {
  const navigate = useNavigate()
  const { loginUser, registerUser } = useAuth()
  const { language, translations } = useUI()
  const text = translations[language] || translations['en']

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await loginUser(email, password)
        navigate('/home')
      } else {
        if (!email.toLowerCase().endsWith('.edu.my')) throw new Error(text.eduEmailRequired)
        await registerUser(email, password, fullName || email.split('@')[0])
        setSuccessMessage(text.registerSuccess)
        navigate('/home')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleGuestBrowse = () => {
    localStorage.setItem('hasVisited', 'true')
    navigate('/home')
  }

  return (
    <div className="min-h-screen flex flex-col grain-overlay"
      style={{ background: '#FAF9F7' }}
    >
      {/* Top ornament */}
      <div className="pt-16 pb-6 flex flex-col items-center">
        <Logo size="lg" />
        <div className="mt-4 flex items-center gap-3 w-48">
          <div className="flex-1 h-px bg-uniloop-300/40" />
          <span className="text-[9px] uppercase tracking-[0.3em] text-uniloop-500/50">
            {mode === 'login' ? text.loginTitle : text.registerTitle}
          </span>
          <div className="flex-1 h-px bg-uniloop-300/40" />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center px-6 pb-10">
        <div className="w-full max-w-sm">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl p-6 space-y-4"
            style={{
              background: 'rgba(253, 252, 250, 0.88)',
              border: '1px solid rgba(200, 120, 80, 0.25)',
              boxShadow: '0 8px 40px rgba(100, 50, 25, 0.10), inset 0 1px 0 rgba(255,255,255,0.6)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold uppercase tracking-widest text-uniloop-500/70 ml-1">
                  {text.fullName}
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-uniloop-400/60" />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    placeholder={text.namePlaceholder}
                    className={`${inputCls} ${inputFocusStyle}`} style={inputStyle} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[9px] font-bold uppercase tracking-widest text-uniloop-500/70 ml-1">
                {text.email}
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-uniloop-400/60" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={text.emailInputPlaceholder} required
                  className={`${inputCls} ${inputFocusStyle}`} style={inputStyle} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[9px] font-bold uppercase tracking-widest text-uniloop-500/70 ml-1">
                {text.password}
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-uniloop-400/60" />
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder={text.passwordInputPlaceholder}
                  required minLength={6}
                  className={`${inputCls} ${inputFocusStyle} pr-11`} style={inputStyle} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-uniloop-400/50 hover:text-uniloop-600 transition-colors">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs font-medium px-4 py-3 rounded-xl text-red-700"
                style={{ background: 'rgba(254, 230, 230, 0.8)', border: '1px solid rgba(220, 100, 100, 0.2)' }}>
                {error}
              </div>
            )}
            {successMessage && (
              <div className="text-xs font-medium px-4 py-3 rounded-xl text-uniloop-700"
                style={{ background: 'rgba(253, 246, 240, 0.8)', border: '1px solid rgba(217,119,87,0.2)' }}>
                {successMessage}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-[#FAF9F7] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{
                background: 'linear-gradient(145deg, #D97757, #C06642)',
                boxShadow: '0 6px 20px rgba(217,119,87,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><span>{mode === 'login' ? text.login : text.register}</span><ArrowRight size={16} /></>
              }
            </button>
          </form>

          {/* Switch mode */}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccessMessage('') }}
            className="w-full text-center text-sm text-uniloop-600/70 font-bold mt-4 py-2 hover:text-uniloop-700 transition-colors"
          >
            {mode === 'login' ? text.switchToRegister : text.switchToLogin}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-4">
            <div className="flex-1 h-px bg-uniloop-300/30" />
            <span className="text-[10px] uppercase tracking-widest text-uniloop-500/40">{text.orContinueWith}</span>
            <div className="flex-1 h-px bg-uniloop-300/30" />
          </div>

          <button
            onClick={handleGuestBrowse}
            className="w-full py-3 rounded-xl font-bold text-sm text-uniloop-700/70 transition-all hover:text-uniloop-800 active:scale-95"
            style={{
              background: 'rgba(250, 249, 247, 0.6)',
              border: '1px solid rgba(200, 120, 80, 0.2)',
            }}
          >
            {text.guestMode}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="pb-8 text-center">
        <p className="text-[9px] uppercase tracking-[0.3em] text-uniloop-500/30">UniLoop · Campus Marketplace</p>
      </div>
    </div>
  )
}

export default Auth
