import React, { useState, useEffect, useCallback } from 'react'
import { deleteProduct, listProducts, updateProductStatus } from '../services/adminService'
import { useLang } from '../context/LangContext.jsx'
import { Search, ChevronLeft, ChevronRight, Ban, RotateCcw, Trash2 } from 'lucide-react'

const STATUSES = ['', 'active', 'sold', 'removed']

const Products = () => {
  const { t } = useLang()
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  const limit = 15

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const res = await listProducts(params)
      setProducts(res.data)
      setTotal(res.total)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const totalPages = Math.ceil(total / limit) || 1

  const handleStatus = async (id, newStatus) => {
    if (!confirm(t.confirmStatus(newStatus))) return
    try {
      await updateProductStatus(id, newStatus)
      fetchProducts()
    } catch {}
  }

  const handleDelete = async (id) => {
    if (!confirm(t.confirmDeleteProduct)) return
    try {
      await deleteProduct(id)
      fetchProducts()
    } catch {}
  }

  const statusBadge = (s) => {
    const map = {
      active: 'bg-uniloop-100 text-uniloop-700',
      sold: 'bg-blue-100 text-blue-700',
      removed: 'bg-red-100 text-red-700',
    }
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${map[s] || 'bg-slate-100 text-slate-500'}`}>
        {s}
      </span>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800">{t.productsTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{total} {t.totalProducts}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t.searchProducts}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400"
          >
            <option value="">{t.allStatus}</option>
            {STATUSES.filter(Boolean).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thProduct}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thPrice}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thCategory}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thSeller}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thStatus}</th>
                <th className="px-4 py-3 font-semibold text-slate-500">{t.thCreated}</th>
                <th className="px-4 py-3 font-semibold text-slate-500 text-right">{t.thActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-400">{t.loading}</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-slate-400">{t.noProducts}</td></tr>
              ) : products.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                        {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />}
                      </div>
                      <div className="font-semibold text-slate-800 truncate max-w-[200px]">{p.title}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-semibold">{p.currency === 'CNY' ? '\u00a5' : 'RM'} {p.price}</td>
                  <td className="px-4 py-3 text-slate-600">{p.category || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-800 font-medium">{p.owner_name || '-'}</div>
                    <div className="text-slate-400 text-xs">{p.owner_email || ''}</div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(p.status)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {p.status === 'removed' ? (
                        <button onClick={() => handleStatus(p.id, 'active')} title="Restore" className="p-1.5 rounded-lg hover:bg-uniloop-50 text-slate-400 hover:text-uniloop-600 transition-colors">
                          <RotateCcw size={16} />
                        </button>
                      ) : (
                        <button onClick={() => handleStatus(p.id, 'removed')} title="Remove" className="p-1.5 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-colors">
                          <Ban size={16} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(p.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
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

export default Products
