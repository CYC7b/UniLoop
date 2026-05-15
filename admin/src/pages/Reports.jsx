import React, { useState, useEffect, useCallback } from 'react'
import { deleteReport, listReports, resolveReport } from '../services/adminService'
import { useLang } from '../context/LangContext.jsx'
import { ChevronLeft, ChevronRight, CheckCircle, Trash2 } from 'lucide-react'

const Reports = () => {
  const { t } = useLang()
  const [reports, setReports] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [resolved, setResolved] = useState('false')
  const [loading, setLoading] = useState(true)

  const limit = 15

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      if (resolved) params.set('resolved', resolved)
      const res = await listReports(params)
      setReports(res.data)
      setTotal(res.total)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [page, resolved])

  useEffect(() => { fetchReports() }, [fetchReports])

  const totalPages = Math.ceil(total / limit) || 1

  const handleResolve = async (id) => {
    try {
      await resolveReport(id)
      fetchReports()
    } catch {}
  }

  const handleDelete = async (id) => {
    if (!confirm(t.confirmDeleteReport)) return
    try {
      await deleteReport(id)
      fetchReports()
    } catch {}
  }

  const typeBadge = (tp) => {
    const map = {
      product: 'bg-blue-100 text-blue-700',
      user: 'bg-violet-100 text-violet-700',
      conversation: 'bg-amber-100 text-amber-700',
    }
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${map[tp] || 'bg-slate-100 text-slate-500'}`}>
        {tp}
      </span>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800">{t.reportsTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{total} {t.totalReports}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          <select
            value={resolved}
            onChange={(e) => { setResolved(e.target.value); setPage(1) }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400"
          >
            <option value="">{t.all}</option>
            <option value="false">{t.pending}</option>
            <option value="true">{t.resolved}</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thReporter}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thType}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thTargetId}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thReason}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thStatus}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thDate}</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-right">{t.thActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-400">{t.loading}</td></tr>
              ) : reports.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-400">{t.noReports}</td></tr>
              ) : reports.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700 font-medium">{r.reporter_name || 'Unknown'}</td>
                  <td className="px-4 py-3">{typeBadge(r.target_type)}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs truncate max-w-[120px]">{r.target_id}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{r.reason || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${r.resolved ? 'bg-uniloop-100 text-uniloop-700' : 'bg-orange-100 text-orange-700'}`}>
                      {r.resolved ? t.resolved : t.pending}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {!r.resolved && (
                        <button onClick={() => handleResolve(r.id)} title="Resolve" className="p-1.5 rounded-lg hover:bg-uniloop-50 text-slate-400 hover:text-uniloop-600 transition-colors">
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(r.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
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

export default Reports
