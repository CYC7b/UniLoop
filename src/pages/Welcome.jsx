import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../context/UIContext.jsx'

const Welcome = () => {
  const navigate = useNavigate()
  const { language, translations } = useUI()
  const t = translations[language]

  const handleStart = () => {
    localStorage.setItem('hasVisited', 'true')
    navigate('/home')
  }

  return (
    <div className="min-h-screen flex flex-col justify-between px-6 py-12 grain-overlay"
      style={{ background: '#FAF9F7' }}
    >
      {/* Decorative top line */}
      <div className="flex items-center gap-4 mb-auto">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(217,119,87,0.5))' }} />
        <span className="text-[10px] uppercase tracking-[0.3em] text-uniloop-500/60 font-sans">Est. 2024</span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(217,119,87,0.5), transparent)' }} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
        {/* Brand mark */}
        <div className="mb-10 relative">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{
              background: 'linear-gradient(145deg, #D97757, #C06642)',
              boxShadow: '0 12px 40px rgba(217,119,87,0.35), inset 0 1px 1px rgba(255,255,255,0.2)',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FAF9F7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>

          <h1 className="text-5xl font-serif font-bold text-uniloop-900 tracking-tight leading-none mb-2">
            UniLoop
          </h1>
          {/* Decorative underline */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="w-8 h-px bg-uniloop-400/50" />
            <div className="w-2 h-2 rounded-full bg-uniloop-400/70" />
            <div className="w-16 h-px bg-uniloop-400/70" />
            <div className="w-2 h-2 rounded-full bg-uniloop-400/70" />
            <div className="w-8 h-px bg-uniloop-400/50" />
          </div>
        </div>

        <p className="text-uniloop-700/70 text-base mb-14 font-serif italic">
          {t.welcomeSubtitle}
        </p>

        {/* Features */}
        <div className="w-full max-w-xs space-y-4">
          {[
            { icon: '🛡', title: t.welcomeFeature1Title, desc: t.welcomeFeature1Desc },
            { icon: '🌿', title: t.welcomeFeature2Title, desc: t.welcomeFeature2Desc },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-4 text-left px-5 py-4 rounded-2xl"
              style={{
                background: 'rgba(253, 252, 250, 0.7)',
                border: '1px solid rgba(200, 120, 80, 0.2)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span className="text-2xl shrink-0">{f.icon}</span>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-uniloop-600 mb-0.5">{f.title}</div>
                <div className="text-xs text-uniloop-800/60">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="w-full max-w-xs mx-auto space-y-3">
        <button
          onClick={handleStart}
          className="w-full py-4 rounded-2xl text-[#FAF9F7] font-bold text-base tracking-wide transition-all active:scale-95"
          style={{
            background: 'linear-gradient(145deg, #D97757, #C06642)',
            boxShadow: '0 8px 28px rgba(217,119,87,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          {t.getStarted}
        </button>

        {/* Bottom watermark */}
        <p className="text-center text-[10px] uppercase tracking-[0.25em] text-uniloop-500/40 pt-2">
          Campus Marketplace
        </p>
      </div>
    </div>
  )
}

export default Welcome
