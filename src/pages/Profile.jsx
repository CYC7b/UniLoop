import { useRef, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useProducts } from '../context/ProductContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { CheckCircle, Trash2, ChevronRight, UserCircle, X, Mail, FileText, Camera, Edit3 } from 'lucide-react'
import ProductCardImage from '../components/ProductCardImage.jsx'
import { DEFAULT_AVATAR } from '../lib/avatar'

const Profile = () => {
  const navigate = useNavigate()
  const { user, uploadAvatar, updateUser, logoutUser, sendVerificationEmail, verifyOTP, uploadVerificationDoc, session } = useAuth()
  const { deleteProduct, fetchUserProducts, fetchFavoriteProducts, favorites } = useProducts()
  const { language, translations, showToast } = useUI()
  const t = translations[language]
  const [tab, setTab] = useState('my')
  const [confirmDialog, setConfirmDialog] = useState(null)

  const [myListings, setMyListings] = useState([])
  const [favoriteItems, setFavoriteItems] = useState([])
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    if (session?.user?.id) {
      setLoadingData(true)
      Promise.all([
        fetchUserProducts(session.user.id),
        fetchFavoriteProducts()
      ]).then(([mine, favs]) => {
        setMyListings(mine)
        setFavoriteItems(favs)
      }).finally(() => setLoadingData(false))
    }
  }, [session?.user?.id, fetchUserProducts, fetchFavoriteProducts, favorites])

  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState(user.name || '')
  const [schoolInput, setSchoolInput] = useState(user.school || '')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('email')
  const [emailInput, setEmailInput] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [sendingCode, setSendingCode] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [verifyLoading, setVerifyLoading] = useState(false)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  useEffect(() => {
    setNameInput(user.name || '')
    setSchoolInput(user.school || '')
  }, [user.name, user.school])

  const handleSaveProfile = () => {
    const name = nameInput.trim()
    const school = schoolInput.trim()
    if (!name || !school) return
    updateUser({ name, school })
    setEditing(false)
  }

  const handleSendCode = async () => {
    if (!emailInput.toLowerCase().endsWith('.edu.my')) {
      showToast('warning', language === 'zh' ? '请输入有效的学校邮箱 (*.edu.my)' : 'Please enter a valid school email (*.edu.my)')
      return
    }
    setSendingCode(true)
    try {
      await sendVerificationEmail(emailInput)
      setCodeSent(true)
      setCountdown(60)
    } catch (err) {
      console.error('Send OTP error:', err)
      showToast('error', err.message || 'Failed to send code')
    } finally {
      setSendingCode(false)
    }
  }

  const handleEmailSubmit = async () => {
    if (!emailInput.toLowerCase().endsWith('.edu.my')) {
      showToast('warning', language === 'zh' ? '请输入有效的学校邮箱 (*.edu.my)' : 'Please enter a valid school email (*.edu.my)')
      return
    }
    if (!codeInput.trim()) {
      showToast('warning', language === 'zh' ? '请输入验证码' : 'Please enter the code')
      return
    }
    setVerifyLoading(true)
    try {
      await verifyOTP(emailInput, codeInput)
      setIsModalOpen(false)
      showToast('success', language === 'zh' ? '认证成功！' : 'Verified successfully!')
    } catch (err) {
      console.error('Verify OTP error:', err)
      showToast('error', err.message || (language === 'zh' ? '验证码错误' : 'Invalid code'))
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleDocSubmit = async () => {
    if (!selectedFile) {
      showToast('warning', language === 'zh' ? '请先选择文件' : 'Please select a file first')
      return
    }
    setVerifyLoading(true)
    try {
      await uploadVerificationDoc(selectedFile)
      setIsModalOpen(false)
      showToast('success', language === 'zh' ? '资料已提交，请等待审核' : 'Submitted! Please wait for review.')
    } catch (err) {
      console.error('Upload doc error:', err)
      showToast('error', err.message || (language === 'zh' ? '上传失败' : 'Upload failed'))
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleDelete = async (id) => {
    setConfirmDialog({
      message: t.confirmDelete,
      onConfirm: async () => {
        setConfirmDialog(null)
        const success = await deleteProduct(id)
        if (success) {
          setMyListings(prev => prev.filter(l => l.id !== id))
          setFavoriteItems(prev => prev.filter(l => l.id !== id))
        }
      },
      onCancel: () => setConfirmDialog(null)
    })
  }

  const Card = ({ item, isOwner }) => (
    <div className="bg-white/80 backdrop-blur-sm rounded-[2rem] overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.03)] border border-white/60 relative group flex flex-col h-full hover:shadow-[0_12px_30px_rgba(0,0,0,0.06)] transition-all duration-300">
      <Link to={`/product/${item.id}`} className="block flex-1 flex flex-col">
        <ProductCardImage
          images={item.thumbnails?.length ? item.thumbnails : item.imageUrls?.length ? item.imageUrls : [item.imageUrl]}
          alt={item.title}
        />
        <div className="flex flex-col flex-1 px-3 pt-3 pb-3">
          <div className="text-[13px] text-slate-800 font-bold leading-snug line-clamp-2 mb-1.5">{item.title}</div>
          <div className="flex items-center justify-between mt-auto pt-2">
            <div className="text-uniloop-600 font-black text-[15px]">{item.currency === 'CNY' ? '¥' : 'RM'} {item.price}</div>
            <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-wider">{item.category || 'Others'}</div>
          </div>
        </div>
      </Link>
      {isOwner && (
        <div className="absolute top-4 right-4 flex gap-1.5 z-10">
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/edit/${item.id}`) }} className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-md text-uniloop-600 hover:text-uniloop-700 hover:bg-uniloop-50 rounded-full shadow-sm border border-white transition-colors"><Edit3 size={14} /></button>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(item.id) }} className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full shadow-sm border border-white transition-colors"><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  )

  const Empty = ({ text }) => (
    <div className="flex flex-col items-center justify-center text-center text-gray-400 py-10 w-full col-span-2">
      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3"><div className="w-8 h-8 rounded bg-gray-100" /></div>
      <div className="text-xs">{text}</div>
    </div>
  )

  const fileRef = useRef(null)

  return (
    <div className="mx-auto max-w-2xl min-h-screen flex flex-col pb-24 relative">
      <div className="px-4 pt-6">
        <div className="px-6 pt-8 pb-8 rounded-3xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #D97757 0%, #C06642 60%, #9A4428 100%)',
            boxShadow: '0 12px 40px rgba(180,80,40,0.32), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-uniloop-300/20 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-5 relative z-10">
            <div className="relative shrink-0">
              <img onClick={() => fileRef.current?.click()} src={user.avatar || DEFAULT_AVATAR} alt="avatar" className="w-20 h-20 rounded-full object-cover cursor-pointer border-[3px] border-white/80 shadow-[0_8px_16px_rgba(0,0,0,0.1)] transition-transform hover:scale-105" />
              <div className="absolute bottom-0 right-0 bg-white text-uniloop-600 p-1.5 rounded-full shadow-sm border-[2px] border-[#C07040]"><Camera size={12} strokeWidth={3} /></div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; uploadAvatar(f) }} />
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-3">
                  <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder={t.username} className="w-full px-4 py-2.5 rounded-2xl border border-white/30 bg-white/20 text-white placeholder-white/70 text-sm focus:ring-2 focus:ring-white outline-none transition-all font-bold" />
                  <input value={schoolInput} onChange={e => setSchoolInput(e.target.value)} placeholder={t.schoolName} className="w-full px-4 py-2.5 rounded-2xl border border-white/30 bg-white/20 text-white placeholder-white/70 text-sm focus:ring-2 focus:ring-white outline-none transition-all font-bold" />
                  <button onClick={handleSaveProfile} className="w-full py-2.5 rounded-2xl bg-white text-uniloop-600 font-black shadow-lg shadow-black/10 active:scale-95 transition-all text-[13px] uppercase tracking-wider">{t.saveChanges}</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="text-xl font-black text-white truncate drop-shadow-sm">{user.name}</div>
                    {user.verificationStatus === 'verified' && <CheckCircle size={20} fill="#fdfbf7" className="text-[#C07040] shrink-0" />}
                  </div>
                  <div className="text-[13px] text-uniloop-50 font-bold truncate mt-1 opacity-90 drop-shadow-sm">{user.school || 'Universiti Malaya'}</div>
                  <div className="mt-4">
                    {user.verificationStatus === 'unverified' && <button onClick={() => setIsModalOpen(true)} className="bg-white text-uniloop-600 text-[11px] font-black px-5 py-2 rounded-full shadow-lg shadow-black/10 active:scale-95 transition-all uppercase tracking-wider">{t.verifyNow}</button>}
                    {user.verificationStatus === 'pending' && <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-400 text-amber-900 rounded-full text-[11px] font-black shadow-lg shadow-black/5 uppercase tracking-wider"><span className="animate-pulse">⏳</span>{t.pendingBadge}</div>}
                    {user.verificationStatus === 'verified' && <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 min-w-max text-white border border-white/30 rounded-full text-[11px] font-black uppercase tracking-wider backdrop-blur-md"><span>✅</span>{t.verifiedBadge}</div>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="px-4 mt-4">
          <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] px-6 py-4 shadow-[0_8px_20px_rgba(0,0,0,0.03)] border border-white/60">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{language === 'zh' ? '用户 ID' : 'User ID'}</div>
            <div className="text-xs font-mono text-slate-500 break-all select-all">{session?.user?.id}</div>
          </div>
        </div>
      )}

      <div className="px-4 mt-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-3 shadow-[0_8px_20px_rgba(0,0,0,0.03)] border border-white/60 space-y-2">
          <button onClick={() => { if (editing) { setNameInput(user.name); setSchoolInput(user.school) }; setEditing(e => !e) }} className="w-full flex items-center justify-between p-4 bg-white/40 hover:bg-white rounded-2xl transition-all active:scale-95">
            <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-[1.2rem] bg-amber-50 flex items-center justify-center text-amber-500 shadow-sm border border-amber-100/50"><UserCircle size={22} /></div><span className="text-[15px] font-black text-slate-700">{t.editProfile}</span></div>
            <ChevronRight size={18} className="text-slate-300" />
          </button>
          <button onClick={() => { setConfirmDialog({ message: t.confirmLogout, onConfirm: async () => { setConfirmDialog(null); await logoutUser(); navigate('/auth') }, onCancel: () => setConfirmDialog(null) }) }} className="w-full flex items-center justify-between p-4 bg-white/40 hover:bg-red-50 rounded-2xl transition-all active:scale-95">
            <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-[1.2rem] bg-red-50 flex items-center justify-center text-red-400 shadow-sm border border-red-100/50"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></div><span className="text-[15px] font-black text-red-400">{t.logout}</span></div>
          </button>
        </div>
      </div>

      <div className="mt-8 px-4 flex-1">
        <div className="flex gap-2">
          <button onClick={() => setTab('my')} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-[1.5rem] ${tab === 'my' ? 'bg-uniloop-50 text-uniloop-600 shadow-sm border border-uniloop-100/50' : 'bg-white/50 text-slate-400 hover:bg-white/80 border border-transparent'}`}>{t.myListings}</button>
          <button onClick={() => setTab('fav')} className={`flex-1 py-3 text-[13px] font-black transition-all rounded-[1.5rem] ${tab === 'fav' ? 'bg-amber-50 text-amber-500 shadow-sm border border-amber-100/50' : 'bg-white/50 text-slate-400 hover:bg-white/80 border border-transparent'}`}>{t.favorites}</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {tab === 'my' && (myListings.length ? myListings.map(item => <Card key={item.id} item={item} isOwner={true} />) : <Empty text={t.noListings} />)}
          {tab === 'fav' && (favoriteItems.length ? favoriteItems.map(item => <Card key={item.id} item={item} isOwner={false} />) : <Empty text={t.noFavorites} />)}
        </div>
      </div>


      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-6 pb-4 flex justify-between items-center border-b border-gray-50 sticky top-0 bg-white z-10">
              <h3 className="text-xl font-black text-gray-900">{t.verification}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-400"><X size={18} /></button>
            </div>
            <div className="flex p-1.5 bg-gray-50 mx-6 mt-6 rounded-2xl">
              <button onClick={() => setActiveTab('email')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black rounded-xl transition-all ${activeTab === 'email' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}><Mail size={14} />{t.campusEmail}</button>
              <button onClick={() => setActiveTab('document')} className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black rounded-xl transition-all ${activeTab === 'document' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}><FileText size={14} />{t.uploadIdCard}</button>
            </div>
            <div className="p-6 pb-10">
              {activeTab === 'email' ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">{t.campusEmail}</label>
                    <div className="relative">
                      <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="yourname@student.edu.my" className="w-full bg-gray-50 border-none rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
                      <button onClick={handleSendCode} disabled={sendingCode || countdown > 0} className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white text-[10px] font-bold px-4 rounded-xl active:scale-95 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed">
                        {sendingCode ? t.sendingCode : countdown > 0 ? `${t.resendIn} ${countdown}s` : t.sendCode}
                      </button>
                    </div>
                    {codeSent && <div className="text-[10px] text-uniloop-600 font-bold ml-1">{t.codeSent}</div>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">{t.verificationCode}</label>
                    <input type="text" value={codeInput} onChange={e => setCodeInput(e.target.value)} placeholder="000000" className="w-full bg-gray-50 border-none rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none tracking-[0.3em] text-center font-mono" />
                  </div>
                  <button onClick={handleEmailSubmit} disabled={verifyLoading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 active:scale-95 transition-all mt-2 disabled:opacity-50">{verifyLoading ? t.loading : t.verifyInstantly}</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-100 rounded-[24px] p-10 text-center bg-gray-50 relative group hover:bg-gray-100 transition-colors">
                    <input type="file" accept="image/*,.pdf" onChange={e => setSelectedFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform"><Camera size={24} /></div>
                      <div className="text-[11px] font-black text-gray-600">{selectedFile ? selectedFile.name : t.uploadHint}</div>
                      <p className="text-[10px] text-gray-400 px-4">{t.uploadFormats}</p>
                    </div>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-2xl"><p className="text-[10px] text-indigo-700 font-bold leading-relaxed">{t.reviewHint}</p></div>
                  <button onClick={handleDocSubmit} disabled={verifyLoading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50">{verifyLoading ? t.loading : t.submitForReview}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDialog && <ConfirmDialog message={confirmDialog.message} confirmText={t.confirm} cancelText={t.cancel} onConfirm={confirmDialog.onConfirm} onCancel={confirmDialog.onCancel} />}
    </div>
  )
}

export default Profile
