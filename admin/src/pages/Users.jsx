import React, { useState, useEffect, useCallback } from 'react'
import { deleteUser, getUserVerificationDoc, listUserVerificationDocs, listUsers, updateUserVerification } from '../services/adminService'
import { useLang } from '../context/LangContext.jsx'
import { Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, Trash2, Shield, FileText, X, ZoomIn, ZoomOut } from 'lucide-react'

const VERIFICATIONS = ['', 'unverified', 'pending', 'verified']

const Users = () => {
  const { t } = useLang()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [verification, setVerification] = useState('')
  const [loading, setLoading] = useState(true)
  const [docViewer, setDocViewer] = useState({
    open: false,
    user: null,
    docs: [],
    index: 0,
    url: '',
    contentType: '',
    loading: false,
    error: ''
  })
  const [docZoom, setDocZoom] = useState(1)
  const [docSize, setDocSize] = useState({ width: 0, height: 0 })

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

  useEffect(() => {
    return () => {
      if (docViewer.url) URL.revokeObjectURL(docViewer.url)
    }
  }, [docViewer.url])

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

  const closeDocViewer = () => {
    if (docViewer.url) URL.revokeObjectURL(docViewer.url)
    setDocViewer({ open: false, user: null, docs: [], index: 0, url: '', contentType: '', loading: false, error: '' })
    setDocZoom(1)
    setDocSize({ width: 0, height: 0 })
  }

  const clampZoom = (value) => Math.max(0.5, Math.min(3, value))

  const loadDoc = async (userId, docs, index) => {
    if (!userId || !docs?.length) return
    if (docViewer.url) URL.revokeObjectURL(docViewer.url)
    setDocViewer(prev => ({ ...prev, docs, index, loading: true, error: '' }))
    setDocZoom(1)
    setDocSize({ width: 0, height: 0 })
    try {
      const doc = docs[index]
      const blob = await getUserVerificationDoc(userId, doc?.name)
      if (!blob) return
      const url = URL.createObjectURL(blob)
      setDocViewer(prev => ({
        ...prev,
        docs,
        index,
        url,
        contentType: doc?.content_type || blob.type || '',
        loading: false,
        error: ''
      }))
    } catch {
      setDocViewer(prev => ({ ...prev, loading: false, error: t.openDocFailed }))
    }
  }

  const handleOpenDoc = async (user) => {
    setDocViewer({ open: true, user, docs: [], index: 0, url: '', contentType: '', loading: true, error: '' })
    setDocZoom(1)
    setDocSize({ width: 0, height: 0 })
    try {
      const data = await listUserVerificationDocs(user.id)
      const docs = data?.docs || []
      if (!docs.length) throw new Error('no-docs')
      const primary = data?.primary
      const index = Math.max(0, docs.findIndex(d => d.name === primary))
      await loadDoc(user.id, docs, index)
    } catch {
      try {
        const blob = await getUserVerificationDoc(user.id)
        if (!blob) throw new Error('no-doc')
        const url = URL.createObjectURL(blob)
        setDocViewer({
          open: true,
          user,
          docs: [{ name: 'document', content_type: blob.type || 'application/octet-stream' }],
          index: 0,
          url,
          contentType: blob.type || '',
          loading: false,
          error: ''
        })
      } catch {
        setDocViewer(prev => ({ ...prev, loading: false, error: t.noVerificationDoc }))
      }
    }
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

  const docUserId = docViewer.user?.id

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
                      <img src={u.avatar_url || '/default-avatar.svg'} alt="" className="w-8 h-8 rounded-full bg-slate-100 object-cover" onError={(e) => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Ccircle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%23e2e8f0%22/%3E%3Ctext x=%2220%22 y=%2226%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-size=%2216%22%3E?%3C/text%3E%3C/svg%3E' }} />
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
                      {(u.verification_doc_url || u.verification_status !== 'unverified') && (
                        <button onClick={() => handleOpenDoc(u)} title={t.viewVerificationDoc} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                          <FileText size={16} />
                        </button>
                      )}
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

      {docViewer.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-[92vw] max-w-5xl h-[85vh] rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-700">{t.verificationDocTitle}</div>
              <button onClick={closeDocViewer} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
              <button
                onClick={() => loadDoc(docUserId, docViewer.docs, Math.max(0, docViewer.index - 1))}
                disabled={!docUserId || docViewer.docs.length <= 1 || docViewer.index === 0 || docViewer.loading}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title={t.prevDoc}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => loadDoc(docUserId, docViewer.docs, Math.min(docViewer.docs.length - 1, docViewer.index + 1))}
                disabled={!docUserId || docViewer.docs.length <= 1 || docViewer.index >= docViewer.docs.length - 1 || docViewer.loading}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title={t.nextDoc}
              >
                <ChevronRight size={16} />
              </button>
              <div className="text-xs text-slate-500">
                {docViewer.docs.length ? `${docViewer.index + 1} / ${docViewer.docs.length}` : t.noVerificationDoc}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setDocZoom(z => clampZoom(Math.round((z - 0.1) * 10) / 10))}
                  disabled={docViewer.loading}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={t.zoomOut}
                >
                  <ZoomOut size={16} />
                </button>
                <div className="text-xs text-slate-500 w-12 text-center">{Math.round(docZoom * 100)}%</div>
                <button
                  onClick={() => setDocZoom(z => clampZoom(Math.round((z + 0.1) * 10) / 10))}
                  disabled={docViewer.loading}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={t.zoomIn}
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-50 min-h-0">
              {docViewer.loading ? (
                <div className="h-full flex items-center justify-center text-slate-400">{t.loadingDoc}</div>
              ) : docViewer.error ? (
                <div className="h-full flex items-center justify-center text-slate-400">{docViewer.error}</div>
              ) : docViewer.url ? (
                (() => {
                  const current = docViewer.docs[docViewer.index]
                  const type = (docViewer.contentType || current?.content_type || '').toLowerCase()
                  const isPdf = type.includes('pdf') || current?.name?.toLowerCase().endsWith('.pdf')
                  if (isPdf) {
                    const pdfZoom = Math.round(docZoom * 100)
                    return (
                      <iframe
                        title="verification-doc"
                        className="w-full h-full"
                        src={`${docViewer.url}#zoom=${pdfZoom}`}
                      />
                    )
                  }
                  return (
                    <div className="w-full h-full min-h-0 overflow-auto">
                      <div className="min-h-full min-w-full flex items-center justify-center p-6">
                        <img
                          src={docViewer.url}
                          alt="verification"
                          className="block max-w-none"
                          onLoad={(e) => {
                            const img = e.currentTarget
                            if (img.naturalWidth && img.naturalHeight) {
                              setDocSize({ width: img.naturalWidth, height: img.naturalHeight })
                            }
                          }}
                          style={{
                            width: docSize.width ? `${docSize.width * docZoom}px` : 'auto',
                            height: docSize.height ? `${docSize.height * docZoom}px` : 'auto'
                          }}
                        />
                      </div>
                    </div>
                  )
                })()
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">{t.noVerificationDoc}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Users
