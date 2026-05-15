import React, { useState, useEffect } from 'react'
import { getStats } from '../services/adminService'
import { useLang } from '../context/LangContext.jsx'
import { Users, Package, Flag, MessageSquare, ShieldCheck, Clock } from 'lucide-react'

const iconMap = {
  total_users: Users,
  total_products: Package,
  active_products: Package,
  total_conversations: MessageSquare,
  pending_reports: Flag,
  pending_verifications: Clock,
}

const colorMap = {
  total_users: ['bg-blue-500', 'shadow-blue-500/20'],
  total_products: ['bg-uniloop-500', 'shadow-uniloop-500/20'],
  active_products: ['bg-uniloop-400', 'shadow-uniloop-400/20'],
  total_conversations: ['bg-violet-500', 'shadow-violet-500/20'],
  pending_reports: ['bg-orange-500', 'shadow-orange-500/20'],
  pending_verifications: ['bg-amber-500', 'shadow-amber-500/20'],
}

const STAT_KEYS = ['total_users', 'total_products', 'active_products', 'total_conversations', 'pending_reports', 'pending_verifications']

const Dashboard = () => {
  const { t } = useLang()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStats().then(data => {
      setStats(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-800">{t.dashboardTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{t.dashboardDesc}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
              <div className="h-10 w-10 bg-slate-200 rounded-xl mb-4" />
              <div className="h-8 w-20 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-28 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {STAT_KEYS.map(key => {
            const Icon = iconMap[key]
            const [color, shadow] = colorMap[key]
            return (
              <div key={key} className="bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-lg transition-shadow">
                <div className={`inline-flex items-center justify-center w-10 h-10 ${color} rounded-xl mb-4 shadow-lg ${shadow}`}>
                  <Icon size={20} className="text-white" />
                </div>
                <div className="text-3xl font-black text-slate-800">{stats?.[key] ?? 0}</div>
                <div className="text-sm text-slate-500 font-medium mt-1">{t.stats[key]}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Dashboard
