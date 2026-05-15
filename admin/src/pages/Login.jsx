import React, { useState } from 'react'
import { setToken } from '../lib/api'
import { loginAdmin } from '../services/adminService'
import { Lock, Mail, ArrowRight, Languages } from 'lucide-react'
import { useLang } from '../context/LangContext.jsx'

const Login = ({ onLogin }) => {
  const { lang, toggleLang, t } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await loginAdmin(email, password)
      if (!data.is_admin) {
        setError(t.accessDenied)
        return
      }
      setToken(data.token)
      onLogin(data.token)
    } catch (err) {
      setError(err.message || '网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-uniloop-500 rounded-2xl mb-4 shadow-lg shadow-uniloop-500/30">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">UniLoop Admin</h1>
          <p className="text-sm text-slate-400 mt-1">{t.loginTitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-6 space-y-4 border border-slate-700/50">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">{t.email}</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full bg-slate-700/50 border border-slate-600 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-uniloop-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">{t.password}</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-700/50 border border-slate-600 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-uniloop-500 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-uniloop-500 hover:bg-uniloop-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-uniloop-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{t.signIn}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button onClick={toggleLang} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors">
            <Languages size={14} />
            <span>{lang === 'zh' ? 'English' : '中文'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
