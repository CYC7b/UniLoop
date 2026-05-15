import React from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import Logo from './Logo'
import { useChat } from '../context/ChatContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import Toast from './Toast.jsx'

const Layout = () => {
  const navigate = useNavigate()
  const { unreadCount } = useChat()
  const { language, toggleLanguage, toast, clearToast } = useUI()
  const label = language === 'zh' ? 'EN' : '中文'

  return (
    <div className="min-h-screen relative grain-overlay"
      style={{
        background: '#FAF9F7',
      }}
    >
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[70] pt-6 pb-3 px-6"
        style={{
          background: 'rgba(250, 249, 247, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(200, 120, 80, 0.2)',
        }}
      >
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link to="/home" className="shrink-0">
            <Logo />
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleLanguage}
              className="px-3 py-1.5 rounded-full text-uniloop-700 text-xs font-bold uppercase tracking-widest transition-all hover:bg-uniloop-100/60"
              style={{ border: '1px solid rgba(217,119,87,0.3)' }}
            >
              {label}
            </button>

            <button
              onClick={() => navigate('/inbox')}
              className="w-9 h-9 rounded-full flex items-center justify-center relative text-uniloop-600 transition-all hover:bg-uniloop-100/60"
              style={{ border: '1px solid rgba(217,119,87,0.25)' }}
              title={language === 'zh' ? '消息' : 'Inbox'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-uniloop-500 text-[#FAF9F7] text-[9px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center leading-none border border-[#FAF9F7]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="pt-20 pb-32 max-w-7xl mx-auto">
        <Outlet />
      </div>

      <BottomNav />
      <Toast toast={toast} onClose={clearToast} />
    </div>
  )
}

export default Layout
