import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Package, Flag, LogOut, Languages } from 'lucide-react'
import { useLang } from '../context/LangContext.jsx'

const Layout = ({ children, onLogout }) => {
  const { lang, toggleLang, t } = useLang()

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t.nav.dashboard },
    { to: '/users', icon: Users, label: t.nav.users },
    { to: '/products', icon: Package, label: t.nav.products },
    { to: '/reports', icon: Flag, label: t.nav.reports },
  ]

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="px-6 py-6 border-b border-slate-700/50">
          <div className="text-xl font-black tracking-tight">UniLoop Admin</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">{t.subtitle}</div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-uniloop-500 text-white shadow-lg shadow-uniloop-500/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700/50 space-y-1">
          <button
            onClick={toggleLang}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-all w-full"
          >
            <Languages size={18} />
            <span>{lang === 'zh' ? 'English' : '中文'}</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all w-full"
          >
            <LogOut size={18} />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

export default Layout
