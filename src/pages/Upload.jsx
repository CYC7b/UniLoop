import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProducts } from '../context/ProductContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import LocationPicker from '../components/LocationPicker.jsx'
import { compressImage, generateThumbnail } from '../lib/imageUtils.js'
import { LoadingButton } from '../components/LoadingSpinner.jsx'

const Upload = () => {
  const { addListing, locations } = useProducts()
  const { categories, language, translations, normalize, showToast } = useUI()
  const t = translations[language]
  const navigate = useNavigate()
  const [images, setImages] = useState([])
  const [thumbs, setThumbs] = useState([])
  const [previews, setPreviews] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('MYR')
  const currencySymbols = { MYR: 'RM', CNY: '¥' }

  const [description, setDescription] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [wechat, setWechat] = useState('')
  const [instagram, setInstagram] = useState('')
  const [category, setCategory] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [locationName, setLocationName] = useState('')
  const [latlng, setLatlng] = useState({ lat: 3.119, lng: 101.654 })

  const onImageChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (images.length + files.length > 9) {
      showToast('warning', t.maxImages)
      return
    }
    // 压缩图片 + 生成缩略图（WebP 格式）
    const compressed = []
    const newThumbs = []
    for (const f of files) {
      try {
        const [c, th] = await Promise.all([compressImage(f), generateThumbnail(f)])
        compressed.push(c)
        newThumbs.push(th)
      } catch (err) {
        showToast('error', language === 'zh'
          ? `图片无法处理：${err.message}`
          : `Image error: ${err.message}`)
      }
    }
    if (compressed.length === 0) return
    setImages([...images, ...compressed])
    setThumbs([...thumbs, ...newThumbs])
    const newPreviews = compressed.map(f => URL.createObjectURL(f))
    setPreviews([...previews, ...newPreviews])
  }

  const removeImage = (index) => {
    const newImages = [...images]; newImages.splice(index, 1); setImages(newImages)
    const newThumbs = [...thumbs]; newThumbs.splice(index, 1); setThumbs(newThumbs)
    const newPreviews = [...previews]; URL.revokeObjectURL(newPreviews[index]); newPreviews.splice(index, 1); setPreviews(newPreviews)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (images.length === 0) { showToast('warning', t.minImages); return }
    if (!title.trim()) { showToast('warning', t.titleRequired); return }
    if (!String(price).trim()) { showToast('warning', t.priceRequired); return }
    if (!category) { showToast('warning', t.categoryRequired); return }
    if (!locationName.trim()) { showToast('warning', t.locationRequired); return }
    if (!whatsapp && !wechat && !instagram) { showToast('warning', t.contactRequired); return }

    let finalLocationName = locationName.trim()
    const normalizedInput = normalize(finalLocationName)
    const existingMatch = locations.find(loc => normalize(loc) === normalizedInput)
    if (existingMatch) finalLocationName = existingMatch

    const tags = tagsInput.split(' ').map(s => s.trim()).filter(Boolean)

    try {
      setSubmitting(true)
      const id = await addListing({
        title, price, images, thumbnails: thumbs, description, whatsapp, wechat, instagram,
        locationName: finalLocationName, lat: latlng?.lat, lng: latlng?.lng, category, tags, currency
      })
      if (id) {
        navigate(`/product/${id}`)
      }
    } catch (err) {
      console.error('Unexpected error in Upload submit:', err)
      showToast('error', t.publishFailed)
    } finally {
      setSubmitting(false)
    }
  }



  const quickTags = [
    { key: 'tagNegotiable' },
    { key: 'tagUrgent' },
    { key: 'tagNew' },
    { key: 'tagDelivery' }
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-24">
      <h1 className="text-2xl font-black text-gray-900 mb-6">{t.sellItem}</h1>

      <form onSubmit={submit} className="space-y-6">
        {/* Images */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-[2rem] shadow-[0_8px_20px_rgba(0,0,0,0.03)] border border-white/60">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-4">{t.productImages}</label>
          <div className="grid grid-cols-3 gap-3">
            {previews.map((url, idx) => (
              <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden shadow-sm group bg-white/50 border border-white/50">
                <img src={url} alt="preview" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-black/50 hover:bg-rose-500 text-white w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors">
                  <div className="text-[10px]">✕</div>
                </button>
              </div>
            ))}
            {images.length < 9 && (
              <label className="aspect-square rounded-2xl border-2 border-dashed border-uniloop-200/50 bg-white/40 flex flex-col items-center justify-center text-uniloop-600/50 cursor-pointer hover:border-uniloop-300 hover:bg-white/60 hover:text-uniloop-600 transition-all group shadow-inner">
                <div className="w-8 h-8 rounded-full bg-uniloop-50 group-hover:bg-uniloop-100 flex items-center justify-center mb-2 transition-colors">
                  <span className="text-xl font-bold leading-none mb-0.5">+</span>
                </div>
                <div className="text-[10px] font-bold">{t.addPhoto}</div>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onImageChange} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-[2rem] shadow-[0_8px_20px_rgba(0,0,0,0.03)] border border-white/60 space-y-4">
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">{t.title}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-white/60 border border-white/50 rounded-2xl p-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-uniloop-400/20 focus:bg-white transition-all font-bold text-slate-700 shadow-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">{t.price}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-uniloop-600 font-bold">{currencySymbols[currency]}</span>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="w-full bg-white/60 border border-white/50 rounded-2xl pl-12 pr-4 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-uniloop-400/20 focus:bg-white transition-all font-black text-uniloop-600 shadow-sm" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">{t.currency}</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full bg-white/60 border border-white/50 rounded-2xl px-4 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-uniloop-400/20 focus:bg-white transition-all appearance-none font-bold text-slate-700 shadow-sm">
                <option value="MYR">{t.currencyMYR}</option>
                <option value="CNY">{t.currencyCNY}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">{t.category}</label>
            <div className="relative">
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-white/60 border border-white/50 rounded-2xl px-4 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-uniloop-400/20 focus:bg-white transition-all appearance-none font-bold text-slate-700 shadow-sm">
                <option value="">{t.selectCategory}</option>
                {categories.filter(c => c.key !== 'All').map(c => (
                  <option key={c.key} value={c.key}>{language === 'zh' ? c.zh : c.en}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">{t.descriptionLabel}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder={t.descPlaceholder} className="w-full bg-white/60 border border-white/50 rounded-2xl p-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-uniloop-400/20 focus:bg-white transition-all resize-none shadow-sm text-slate-700 font-medium" />
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">{t.tags}</label>
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder={language === 'zh' ? '#99新 #急出' : '#like-new #urgent'} className="w-full bg-white/60 border border-white/50 rounded-2xl p-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-uniloop-400/20 focus:bg-white transition-all shadow-sm font-medium text-slate-700" />
            <div className="flex flex-wrap gap-2 mt-3 px-1">
              {quickTags.map(p => (
                <button type="button" key={p.key} onClick={() => {
                  const toAdd = t[p.key]
                  const parts = tagsInput.split(' ').filter(Boolean)
                  if (!parts.includes(toAdd)) setTagsInput([...parts, toAdd].join(' '))
                }} className="px-3 py-1 rounded-full bg-gray-100 hover:bg-uniloop-50 hover:text-uniloop-600 text-gray-600 text-[10px] font-bold transition-colors">
                  + {t[p.key]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-[2rem] shadow-[0_8px_20px_rgba(0,0,0,0.03)] border border-white/60">
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-4 ml-1">{t.location}</label>
          <LocationPicker
            locationName={locationName}
            setLocationName={setLocationName}
            latlng={latlng}
            setLatlng={setLatlng}
            language={language}
            locations={locations}
          />
        </div>

        {/* Contact */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-[2rem] shadow-[0_8px_20px_rgba(0,0,0,0.03)] border border-white/60 space-y-4">
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">{t.contactMethods}</label>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-uniloop-50 text-uniloop-600 flex items-center justify-center shrink-0 shadow-sm border border-uniloop-100/50">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              </div>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="WhatsApp Number" className="flex-1 bg-white/60 border border-white/50 rounded-2xl px-4 py-3.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-uniloop-400/20 focus:bg-white shadow-sm font-medium" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-blue-100/50">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </div>
              <input value={wechat} onChange={e => setWechat(e.target.value)} placeholder="WeChat ID" className="flex-1 bg-white/60 border border-white/50 rounded-2xl px-4 py-3.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white shadow-sm font-medium" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center shrink-0 shadow-sm border border-pink-100/50">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
              </div>
              <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="Instagram ID" className="flex-1 bg-white/60 border border-white/50 rounded-2xl px-4 py-3.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:bg-white shadow-sm font-medium" />
            </div>
          </div>
        </div>

        <LoadingButton
          type="submit"
          loading={submitting}
          className="w-full bg-[#C07040] hover:bg-[#A85C2E] text-white font-bold py-4 rounded-[2rem] shadow-[0_8px_20px_rgba(192,112,64,0.3)] active:scale-95 transition-all text-[15px] uppercase tracking-widest mt-8 flex justify-center items-center h-[56px]"
        >
          {t.listItem}
        </LoadingButton>
      </form>
    </div>
  )
}

export default Upload
