import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useChat } from '../context/ChatContext.jsx'
import { useProducts } from '../context/ProductContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { MapPin, Phone, MessageSquare, Heart, Lock, Edit3, Flag, ExternalLink, ChevronRight, ChevronLeft, X, ZoomIn, ZoomOut } from 'lucide-react'
import { getPublicProfile } from '../services/profileService'
import { SkeletonDetail } from '../components/Skeleton.jsx'
import ReportModal from '../components/ReportModal.jsx'
import { DEFAULT_AVATAR } from '../lib/avatar'

const ProductDetail = () => {
  const { id } = useParams()
  const { user, session } = useAuth()
  const { findConversation } = useChat()
  const { getProductById, favorites, toggleFavorite } = useProducts()
  const { language, translations, showToast } = useUI()
  const navigate = useNavigate()
  const t = translations[language]

  const [item, setItem] = useState(null)
  const [loadingItem, setLoadingItem] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoadingItem(true)
    getProductById(id, session?.user?.id).then(res => {
      if (mounted) { setItem(res); setLoadingItem(false) }
    })
    return () => { mounted = false }
  }, [id, getProductById, session?.user?.id])

  const [showReport, setShowReport] = useState(false)
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const scrollRef = useRef(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)
  const [lightboxScale, setLightboxScale] = useState(1)
  const [lightboxPos, setLightboxPos] = useState({ x: 0, y: 0 })
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 })
  const [sellerProfile, setSellerProfile] = useState(null)

  useEffect(() => {
    if (item?.owner_id) {
      getPublicProfile(item.owner_id).then(res => {
        if (res.profile) setSellerProfile(res.profile)
      }).catch(() => {})
    }
  }, [item?.owner_id])

  if (loadingItem) return <SkeletonDetail />
  if (!item) return <div className="mx-auto max-w-md px-4 pt-4">{t.noItemsFound}</div>

  const images = item.imageUrls || [item.imageUrl]
  const isOwner = session?.user?.id && session.user.id === item.owner_id

  const handleScroll = (e) => {
    if (!e.target) return
    const scrollLeft = e.target.scrollLeft
    const width = e.target.clientWidth
    if (width > 0) {
      const idx = Math.round(scrollLeft / width)
      if (idx !== activeImageIdx) setActiveImageIdx(idx)
    }
  }

  const handleChat = async () => {
    if (!user || user.verificationStatus !== 'verified') {
      showToast('warning', language === 'zh' ? '请先完成认证' : 'Please verify first')
      navigate('/profile')
      return
    }
    const existingId = await findConversation(item.id)
    if (existingId) navigate(`/chat/${existingId}`)
    else navigate(`/chat/new?productId=${item.id}`)
  }

  const openWhatsApp = async () => {
    const text = encodeURIComponent(`Hi, I'm interested in: ${item.title}`)
    const number = item.whatsapp || item.contact || ''
    if (!number) return
    try { await navigator.clipboard.writeText(number) } catch {}
    showToast('success', t.whatsappRedirect)
    setTimeout(() => { window.open(`https://wa.me/${number}?text=${text}`, '_blank') }, 1500)
  }
  const copyWeChat = async () => {
    const wid = item.wechat || ''
    if (!wid) return
    try { await navigator.clipboard.writeText(wid) } catch {}
    showToast('success', t.wechatCopied || (language === 'zh' ? '微信号已复制到剪贴板，请在微信粘贴使用粘贴添加' : 'WeChat ID copied to clipboard. Please paste in WeChat to add.'))
  }

  const openLightbox = (idx) => {
    setLightboxIdx(idx)
    setLightboxScale(1)
    setLightboxPos({ x: 0, y: 0 })
    setLightboxOpen(true)
  }
  const closeLightbox = () => setLightboxOpen(false)
  const lightboxPrev = () => {
    if (lightboxIdx <= 0) return
    setLightboxIdx(lightboxIdx - 1)
    setLightboxScale(1)
    setLightboxPos({ x: 0, y: 0 })
  }
  const lightboxNext = () => {
    if (lightboxIdx >= images.length - 1) return
    setLightboxIdx(lightboxIdx + 1)
    setLightboxScale(1)
    setLightboxPos({ x: 0, y: 0 })
  }
  const zoomIn = () => setLightboxScale(s => Math.min(s + 0.5, 5))
  const zoomOut = () => {
    setLightboxScale(s => {
      const next = Math.max(s - 0.5, 1)
      if (next === 1) setLightboxPos({ x: 0, y: 0 })
      return next
    })
  }
  const handleLightboxPointerDown = (e) => {
    if (lightboxScale <= 1) return
    e.preventDefault()
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startPosX: lightboxPos.x, startPosY: lightboxPos.y }
  }
  const handleLightboxPointerMove = (e) => {
    if (!dragRef.current.dragging) return
    setLightboxPos({
      x: dragRef.current.startPosX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.startPosY + (e.clientY - dragRef.current.startY),
    })
  }
  const handleLightboxPointerUp = () => { dragRef.current.dragging = false }
  const handleLightboxWheel = (e) => {
    e.preventDefault()
    if (e.deltaY < 0) zoomIn()
    else zoomOut()
  }

  return (
    <div className="min-h-screen pb-[140px] md:pb-0">
      <div className="mx-auto max-w-6xl md:p-8">
        <div className="md:grid md:grid-cols-2 md:gap-12">
          <div className="relative group w-full aspect-[3/4] md:rounded-[3rem] overflow-hidden bg-white/50 backdrop-blur-sm shadow-sm border border-white/60">
            <div ref={scrollRef} className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide" style={{ scrollBehavior: 'smooth' }} onScroll={handleScroll}>
              {images.map((img, idx) => (
                <div key={idx} className="w-full h-full flex-shrink-0 snap-center relative cursor-pointer" onClick={() => openLightbox(idx)}>
                  <img src={img} alt={`${item.title} ${idx + 1}`} className="w-full h-full object-contain md:object-cover mix-blend-multiply" onError={(e) => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 400%22%3E%3Crect fill=%22%23f3f4f6%22 width=%22400%22 height=%22400%22/%3E%3Ctext fill=%22%239ca3af%22 font-family=%22system-ui%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22%3ENo Image%3C/text%3E%3C/svg%3E' }} />
                </div>
              ))}
            </div>
            <button onClick={() => navigate(-1)} className="absolute top-4 left-4 p-2 bg-white/80 backdrop-blur-md rounded-full shadow-sm md:hidden text-gray-700 z-10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            </button>
            {isOwner && <button onClick={() => navigate(`/edit/${item.id}`)} className="absolute top-4 right-4 p-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-md text-uniloop-600 hover:bg-uniloop-50 transition-colors z-10"><Edit3 size={18} /></button>}
            {!isOwner && session && <button onClick={() => setShowReport(true)} className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-md rounded-full shadow-md text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors hidden md:block z-10"><Flag size={16} /></button>}
            {!isOwner && <button onClick={() => toggleFavorite(item.id)} className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur-md rounded-full shadow-sm md:hidden text-slate-300 transition-all border border-white/50 z-10 active:scale-95"><Heart size={20} className={favorites.includes(item.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-400'} /></button>}
            {images.length > 1 && (
              <>
                <button onClick={() => {
                  if (activeImageIdx <= 0) return
                  const prev = activeImageIdx - 1
                  scrollRef.current?.scrollTo({ left: prev * scrollRef.current.clientWidth, behavior: 'smooth' })
                }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 md:opacity-70 md:hover:opacity-100 transition-opacity active:scale-90 z-10 hover:bg-black/40">
                  <ChevronLeft size={22} />
                </button>
                <button onClick={() => {
                  if (activeImageIdx >= images.length - 1) return
                  const next = activeImageIdx + 1
                  scrollRef.current?.scrollTo({ left: next * scrollRef.current.clientWidth, behavior: 'smooth' })
                }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 md:opacity-70 md:hover:opacity-100 transition-opacity active:scale-90 z-10 hover:bg-black/40">
                  <ChevronRight size={22} />
                </button>
              </>
            )}
            {images.length > 1 && <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10 pointer-events-none">{images.map((_, idx) => <div key={idx} className={`w-1.5 h-1.5 rounded-full shadow-sm transition-all ${idx === activeImageIdx ? 'bg-white scale-125' : 'bg-black/30'}`} />)}</div>}
          </div>

          <div className="relative mt-4 bg-white/90 backdrop-blur-xl rounded-[3rem] mx-2 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.06)] border border-white/50 aspect-[3/4] overflow-y-auto md:mx-0 md:mt-0 md:bg-white/80 md:p-8">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-start gap-4">
                  <h1 className="text-2xl md:text-3xl font-black text-slate-800 leading-tight">{item.title}</h1>
                  <div className="text-uniloop-600 text-3xl font-black whitespace-nowrap">{item.currency === 'CNY' ? '¥' : 'RM'} {item.price}</div>
                </div>
                {item.locationName && (
                  <a href={`https://www.google.com/maps/search/${encodeURIComponent(item.locationName)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 bg-uniloop-50 text-uniloop-700 rounded-full text-[13px] font-bold hover:bg-uniloop-100 active:scale-95 transition-all cursor-pointer">
                    <MapPin size={16} /><span>{item.locationName}</span><ExternalLink size={12} className="text-uniloop-300 ml-0.5" />
                  </a>
                )}
              </div>
              {Array.isArray(item.tags) && item.tags.length > 0 && <div className="flex flex-wrap gap-2">{item.tags.map((tag, idx) => <span key={idx} className="px-4 py-1.5 rounded-full border border-slate-100 bg-white shadow-sm text-slate-500 text-[13px] font-bold hover:bg-uniloop-50 hover:text-uniloop-600 hover:border-uniloop-100 transition-colors">#{tag}</span>)}</div>}
              <div className="pt-6 border-t border-slate-100">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{t.productDesc}</h3>
                <p className="text-[15px] font-medium text-slate-600 leading-relaxed whitespace-pre-line">{item.description || t.noDescription}</p>
              </div>
              {sellerProfile && (
                <div onClick={() => navigate(`/user/${item.owner_id}`)} className="pt-6 border-t border-slate-100 cursor-pointer group">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all group-hover:bg-uniloop-50 group-hover:border-uniloop-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0"><img src={sellerProfile.avatar_url || DEFAULT_AVATAR} alt="Seller Avatar" className="w-full h-full object-cover" /></div>
                      <div className="flex flex-col"><span className="text-[14px] font-bold text-slate-800 leading-tight">{sellerProfile.full_name}</span><span className="text-[12px] text-slate-500">{sellerProfile.school || 'Universiti Malaya (UM)'}</span></div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-400 group-hover:text-uniloop-600 transition-colors"><ChevronRight size={18} /></div>
                  </div>
                </div>
              )}
              <div className="hidden md:block pt-8 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  {isOwner ? (
                    <>
                      <button onClick={() => navigate(`/edit/${item.id}`)} className="col-span-1 flex items-center justify-center gap-2 bg-[#C07040] hover:bg-[#A85C2E] text-white rounded-2xl py-4 font-bold shadow-[0_8px_20px_rgba(192,112,64,0.3)] transition-all active:scale-95"><Edit3 size={20} /><span>{language === 'zh' ? '编辑商品' : 'Edit'}</span></button>
                      <button onClick={() => navigate('/profile')} className="col-span-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl py-4 font-bold transition-all active:scale-95">{language === 'zh' ? '我的主页' : 'My Profile'}</button>
                    </>
                  ) : user.verificationStatus === 'verified' ? (
                    <>
                      <button onClick={handleChat} className="col-span-2 flex items-center justify-center gap-2 bg-[#C07040] hover:bg-[#A85C2E] text-white rounded-2xl py-4 font-bold shadow-[0_8px_20px_rgba(192,112,64,0.3)] transition-all active:scale-95"><MessageSquare size={20} /><span>{t.chat}</span></button>
                      <button onClick={openWhatsApp} disabled={!(item.whatsapp || item.contact)} className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold border-2 transition-all ${item.whatsapp || item.contact ? 'border-uniloop-500 text-uniloop-600 hover:bg-uniloop-50' : 'border-gray-100 text-gray-300 cursor-not-allowed'}`}>WhatsApp</button>
                      <button onClick={copyWeChat} disabled={!item.wechat} className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold border-2 transition-all ${item.wechat ? 'border-uniloop-500 text-uniloop-600 hover:bg-uniloop-50' : 'border-gray-100 text-gray-300 cursor-not-allowed'}`}>WeChat</button>
                    </>
                  ) : (
                    <div className="col-span-2 space-y-3">
                      <button onClick={() => navigate('/profile')} className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-500 rounded-xl py-4 font-bold transition-all hover:bg-gray-200"><Lock size={18} /><span>{t.verifyToChat}</span></button>
                      <div className="text-center text-[10px] text-orange-500 font-bold bg-orange-50 py-2 rounded-lg">{t.verifyRequired}</div>
                    </div>
                  )}
                  {!isOwner && <button onClick={() => toggleFavorite(item.id)} className={`col-span-2 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold border-2 transition-all ${favorites.includes(item.id) ? 'border-amber-200 text-amber-500 bg-amber-50' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}><Heart size={18} className={favorites.includes(item.id) ? 'fill-amber-400 text-amber-400' : ''} /><span>{favorites.includes(item.id) ? t.saved : t.addToFavorites}</span></button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-6 right-6 md:hidden z-50">
        <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-4 flex items-center justify-between gap-4 shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-white/60">
          <div className="flex flex-col px-2">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{t.price}</span>
            <span className="text-2xl font-black text-uniloop-600 leading-none">{item.currency === 'CNY' ? '¥' : 'RM'} {item.price}</span>
          </div>
          {isOwner ? (
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(`/edit/${item.id}`)} className="bg-[#C07040] hover:bg-[#A85C2E] text-white rounded-full px-6 py-3.5 font-bold shadow-[0_8px_20px_rgba(192,112,64,0.3)] active:scale-95 transition-all text-[15px] flex items-center gap-2"><Edit3 size={16} />{language === 'zh' ? '编辑' : 'Edit'}</button>
              <button onClick={() => navigate('/profile')} className="bg-slate-100 text-slate-700 rounded-full px-6 py-3.5 font-bold active:scale-95 transition-all text-[15px]">{language === 'zh' ? '主页' : 'Profile'}</button>
            </div>
          ) : user.verificationStatus === 'verified' ? (
            <div className="flex items-center gap-2">
              <button onClick={handleChat} className="bg-[#C07040] hover:bg-[#A85C2E] text-white rounded-full px-8 py-3.5 font-bold shadow-[0_8px_20px_rgba(192,112,64,0.3)] active:scale-95 transition-all text-[15px]">{t.chat}</button>
            </div>
          ) : (
            <button onClick={() => navigate('/profile')} className="flex-1 bg-slate-800 text-white rounded-full px-6 py-3.5 font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><Lock size={18} /><span>{t.verifyToContact}</span></button>
          )}
        </div>
      </div>

      {showReport && <ReportModal type="product" targetId={item.id} onClose={() => setShowReport(false)} />}

      {lightboxOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={closeLightbox}
          onPointerMove={handleLightboxPointerMove} onPointerUp={handleLightboxPointerUp} onPointerLeave={handleLightboxPointerUp}>
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button onClick={(e) => { e.stopPropagation(); zoomOut() }} className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 transition-colors active:scale-90"><ZoomOut size={20} /></button>
            <span className="text-white/70 text-sm font-medium min-w-[3rem] text-center">{Math.round(lightboxScale * 100)}%</span>
            <button onClick={(e) => { e.stopPropagation(); zoomIn() }} className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 transition-colors active:scale-90"><ZoomIn size={20} /></button>
            <button onClick={closeLightbox} className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 transition-colors active:scale-90 ml-2"><X size={20} /></button>
          </div>
          {images.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium z-10">
              {lightboxIdx + 1} / {images.length}
            </div>
          )}
          {images.length > 1 && lightboxIdx > 0 && (
            <button onClick={(e) => { e.stopPropagation(); lightboxPrev() }} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 transition-colors active:scale-90 z-10"><ChevronLeft size={24} /></button>
          )}
          {images.length > 1 && lightboxIdx < images.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); lightboxNext() }} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 transition-colors active:scale-90 z-10"><ChevronRight size={24} /></button>
          )}
          <div className="max-w-[90vw] max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}
            onWheel={handleLightboxWheel}
            onPointerDown={handleLightboxPointerDown}
            style={{ cursor: lightboxScale > 1 ? 'grab' : 'default', touchAction: 'none' }}>
            <img
              src={images[lightboxIdx]}
              alt={`${item.title} ${lightboxIdx + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain select-none"
              style={{ transform: `scale(${lightboxScale}) translate(${lightboxPos.x / lightboxScale}px, ${lightboxPos.y / lightboxScale}px)`, transition: dragRef.current.dragging ? 'none' : 'transform 0.2s ease' }}
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductDetail
