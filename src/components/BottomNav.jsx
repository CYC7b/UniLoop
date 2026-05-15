import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useChat } from '../context/ChatContext.jsx'
import { useUI } from '../context/UIContext.jsx'

const BottomNav = () => {
  const { unreadCount } = useChat()
  const { language, translations } = useUI()
  const t = translations[language]
  const location = useLocation()

  const hidePaths = ['/product', '/chat', '/edit']
  const shouldHide = hidePaths.some(path => location.pathname.startsWith(path))
  if (shouldHide) return null

  const navItems = [
    {
      to: '/home',
      label: t.home,
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={active ? 22 : 19} height={active ? 22 : 19} viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      to: '/inbox',
      label: t.inbox,
      badge: unreadCount > 0,
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={active ? 21 : 18} height={active ? 21 : 18} viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
    },
    {
      to: '/upload',
      label: t.sell,
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={active ? 24 : 20} height={active ? 24 : 20} viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" /><path d="M12 5v14" />
        </svg>
      ),
    },
    {
      to: '/profile',
      label: t.me,
      icon: (active) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={active ? 21 : 18} height={active ? 21 : 18} viewBox="0 0 24 24"
          fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ]

  return (
    <div className="fixed bottom-0 md:bottom-5 left-0 right-0 md:left-5 md:right-5 z-[60] pointer-events-none">
      <div
        className="mx-auto max-w-[440px] md:rounded-[2.5rem] rounded-t-3xl h-[68px] pb-[env(safe-area-inset-bottom)] flex items-stretch pointer-events-auto"
        style={{
          background: 'rgba(253, 252, 250, 0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(200, 120, 80, 0.22)',
          boxShadow: '0 -4px 30px rgba(100, 50, 25, 0.08), 0 2px 0 rgba(200,120,80,0.12) inset',
        }}
      >
        {navItems.map(({ to, label, icon, badge }) => (
          <NavLink key={to} to={to} className="relative flex flex-col items-center justify-center flex-1 group">
            {({ isActive }) => (
              <>
                {/* Active indicator pill */}
                {isActive && (
                  <div
                    className="absolute -top-[22px] w-[52px] h-[52px] rounded-full flex items-center justify-center text-[#FAF9F7]"
                    style={{
                      background: 'linear-gradient(145deg, #D97757, #C06642)',
                      boxShadow: '0 8px 24px rgba(217,119,87,0.45), 0 2px 8px rgba(217,119,87,0.3)',
                    }}
                  >
                    {icon(true)}
                  </div>
                )}

                {/* Inactive icon */}
                {!isActive && (
                  <div className="relative text-uniloop-700/50 group-hover:text-uniloop-600 transition-colors mb-0.5">
                    {icon(false)}
                    {badge && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-uniloop-500 border-2 border-[#FDFCFB]" />
                    )}
                  </div>
                )}

                {/* Label */}
                <span className={`text-[9px] uppercase tracking-widest font-bold mt-auto mb-2 transition-colors ${
                  isActive ? 'text-uniloop-600 mt-8' : 'text-uniloop-700/40 group-hover:text-uniloop-600/60'
                }`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export default BottomNav
