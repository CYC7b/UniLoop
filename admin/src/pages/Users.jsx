import React, { useState, useEffect, useCallback } from 'react'
import { deleteUser, listUsers, updateUserVerification } from '../services/adminService'
import { useLang } from '../context/LangContext.jsx'
import { Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, Trash2, Shield } from 'lucide-react'

const VERIFICATIONS = ['', 'unverified', 'pending', 'verified']

const Users = () => {
  const { t } = useLang()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [verification, setVerification] = useState('')
  const [loading, setLoading] = useState(true)

  const limit = 15

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      if (search) params.set('search', search)
      if (verification) params.set('verification', verification)
      const res = await listUsers(params)
      setUsers(res.data)
      setTotal(res.total)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [page, search, verification])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const totalPages = Math.ceil(total / limit) || 1

  const handleVerify = async (id, status) => {
    if (!confirm(t.confirmVerify(status))) return
    try {
      await updateUserVerification(id, status)
      fetchUsers()
    } catch {}
  }

  const handleDelete = async (id) => {
    if (!confirm(t.confirmDeleteUser)) return
    try {
      await deleteUser(id)
      fetchUsers()
    } catch {}
  }

  const statusBadge = (s) => {
    const map = {
      verified: 'bg-uniloop-100 text-uniloop-700',
      pending: 'bg-amber-100 text-amber-700',
      unverified: 'bg-slate-100 text-slate-500',
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${map[s] || map.unverified}`}>
        {s}
      </span>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800">{t.usersTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{total} {t.totalUsers}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t.searchUsers}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400"
            />
          </div>
          <select
            value={verification}
            onChange={(e) => { setVerification(e.target.value); setPage(1) }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400"
          >
            <option value="">{t.allStatus}</option>
            {VERIFICATIONS.filter(Boolean).map(v => (
              <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thUser}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thEmail}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thSchool}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thVerification}</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-center">{t.thProducts}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thJoined}</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-right">{t.thActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-400">{t.loading}</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-400">{t.noUsers}</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar_url || 'data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2080%2080%27%3E%3Crect%20width%3D%2780%27%20height%3D%2780%27%20rx%3D%2740%27%20fill%3D%27%23e2e8f0%27%2F%3E%3Ccircle%20cx%3D%2740%27%20cy%3D%2730%27%20r%3D%2713%27%20fill%3D%27%2394a3b8%27%2F%3E%3Cpath%20d%3D%27M17%2068c4-15%2016-23%2023-23s19%208%2023%2023%27%20fill%3D%27%2394a3b8%27%2F%3E%3C%2Fsvg%3E'} alt="" className="w-8 h-8 rounded-full bg-slate-100 object-cover" onError={(e) => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Ccircle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%23e2e8f0%22/%3E%3Ctext x=%2220%22 y=%2226%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-size=%2216%22%3E?%3C/text%3E%3C/svg%3E' }} />
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        {u.full_name || 'Unnamed'}
                        {u.is_admin && <Shield size={12} className="text-uniloop-500" />}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.school || '-'}</td>
                  <td className="px-4 py-3">{statusBadge(u.verification_status)}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{u.product_count}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {u.verification_status !== 'verified' && (
                        <button onClick={() => handleVerify(u.id, 'verified')} title="Verify" className="p-1.5 rounded-lg hover:bg-uniloop-50 text-slate-400 hover:text-uniloop-600 transition-colors">
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {u.verification_status === 'verified' && (
                        <button onClick={() => handleVerify(u.id, 'unverified')} title="Revoke" className="p-1.5 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-colors">
                          <XCircle size={16} />
                        </button>
                      )}
                      {!u.is_admin && (
                        <button onClick={() => handleDelete(u.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500">{t.pageOf(page, totalPages)}</div>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Users
