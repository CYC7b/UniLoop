import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useProducts } from '../context/ProductContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import LocationPicker from '../components/LocationPicker.jsx'
import { ArrowLeft, X, Plus } from 'lucide-react'
import { LoadingButton } from '../components/LoadingSpinner.jsx'
import { compressImages, generateThumbnail } from '../lib/imageUtils.js'

const EditProduct = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { session } = useAuth()
    const { getProductById, updateListing, locations } = useProducts()
    const { categories, language, translations, normalize, showToast } = useUI()
    const t = translations[language]

    const [item, setItem] = useState(null)
    const [title, setTitle] = useState('')

    useEffect(() => {
        getProductById(id, session?.user?.id).then(setItem)
    }, [id, getProductById, session?.user?.id])
    const [price, setPrice] = useState('')
    const [currency, setCurrency] = useState('MYR')
    const [description, setDescription] = useState('')
    const [whatsapp, setWhatsapp] = useState('')
    const [wechat, setWechat] = useState('')
    const [instagram, setInstagram] = useState('')
    const [category, setCategory] = useState('')
    const [tagsInput, setTagsInput] = useState('')
    const [locationName, setLocationName] = useState('')
    const [latlng, setLatlng] = useState({ lat: 3.119, lng: 101.654 })
    const [loading, setLoading] = useState(false)

    // Image Management States
    const [retainedImages, setRetainedImages] = useState([])
    const [deletedImages, setDeletedImages] = useState([])
    const [newImageFiles, setNewImageFiles] = useState([])
    const [newThumbFiles, setNewThumbFiles] = useState([])
    const [newImagePreviews, setNewImagePreviews] = useState([])

    const currencySymbols = { MYR: 'RM', CNY: '¥' }

    useEffect(() => {
        if (item) {
            setTitle(item.title || '')
            setPrice(item.price || '')
            setDescription(item.description || '')
            setWhatsapp(item.whatsapp || '')
            setWechat(item.wechat || '')
            setInstagram(item.instagram || '')
            setCategory(item.category || '')
            setTagsInput((item.tags || []).join(' '))
            setLocationName(item.locationName || '')
            if (item.lat && item.lng) setLatlng({ lat: item.lat, lng: item.lng })
            setRetainedImages(item.images || item.imageUrls || (item.imageUrl ? [item.imageUrl] : []))
        }
    }, [item])

    if (!item) return <div className="mx-auto max-w-md px-4 pt-4">{t.noItemsFound}</div>

    // 检查是否为所有者（使用 Navigate 组件而非命令式 navigate 避免 React 警告）
    if (session?.user?.id !== item.owner_id) {
        return <Navigate to="/home" replace />
    }

    const submit = async (e) => {
        e.preventDefault()
        if (!title.trim()) { showToast('warning', t.titleRequired); return }
        if (!String(price).trim()) { showToast('warning', t.priceRequired); return }

        setLoading(true)
        try {
            let finalLocationName = locationName.trim()
            const normalizedInput = normalize(finalLocationName)
            const existingMatch = locations.find(loc => normalize(loc) === normalizedInput)
            if (existingMatch) finalLocationName = existingMatch

            const tags = tagsInput.split(' ').map(s => s.trim()).filter(Boolean)

            if (retainedImages.length === 0 && newImageFiles.length === 0) {
                showToast('warning', language === 'zh' ? '至少需要一张商品图片' : 'At least one image is required')
                setLoading(false)
                return
            }

            const result = await updateListing(id, {
                title, price, description, whatsapp, wechat, instagram,
                locationName: finalLocationName, lat: latlng?.lat, lng: latlng?.lng, category, tags, currency,
                retainedImages, deletedImages,
                newImages: newImageFiles, newThumbs: newThumbFiles,
            })
            if (result) {
                showToast('success', t.editSuccess)
                navigate(`/product/${id}`)
            }
        } catch (err) {
            console.error('Edit error:', err)
            showToast('error', t.publishFailed)
        } finally {
            setLoading(false)
        }
    }



    const handleRemoveRetained = (url) => {
        const idx = retainedImages.indexOf(url)
        setRetainedImages(prev => prev.filter((_, i) => i !== idx))
        setDeletedImages(prev => [...prev, url])
    }

    const handleRemoveNew = (index) => {
        setNewImageFiles(prev => prev.filter((_, i) => i !== index))
        setNewThumbFiles(prev => prev.filter((_, i) => i !== index))
        setNewImagePreviews(prev => prev.filter((_, i) => i !== index))
    }

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files)
        if (!files.length) return
        setLoading(true)
        try {
            const compressed = await compressImages(files)
            const thumbs = await Promise.all(compressed.map(f => generateThumbnail(f)))
            setNewImageFiles(prev => [...prev, ...compressed])
            setNewThumbFiles(prev => [...prev, ...thumbs])
            const previews = compressed.map(f => URL.createObjectURL(f))
            setNewImagePreviews(prev => [...prev, ...previews])
        } finally {
            setLoading(false)
        }
        e.target.value = '' // Reset input
    }

    return (
        <div className="mx-auto max-w-2xl px-4 pt-6 pb-24">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-gray-600">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-2xl font-black text-gray-900">{t.editProduct}</h1>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide items-center">
                    {/* Retained Old Images */}
                    {retainedImages.map((url, idx) => (
                        <div key={`old-${idx}`} className="w-20 h-20 rounded-xl overflow-hidden border border-gray-100 shrink-0 relative group">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button
                                onClick={() => handleRemoveRetained(url)}
                                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    {/* New Images Previews */}
                    {newImagePreviews.map((url, idx) => (
                        <div key={`new-${idx}`} className="w-20 h-20 rounded-xl overflow-hidden border border-uniloop-200 shrink-0 relative group">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button
                                onClick={() => handleRemoveNew(idx)}
                                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    {/* Add Image Button */}
                    {retainedImages.length + newImageFiles.length < 5 && (
                        <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 shrink-0 cursor-pointer hover:bg-gray-50 transition-colors">
                            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} disabled={loading} />
                            <Plus size={24} />
                        </label>
                    )}
                </div>
            </div>

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">{t.title}</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400 focus:border-transparent transition-all font-medium" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">{t.price}</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currencySymbols[currency]}</span>
                            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400 focus:border-transparent transition-all font-bold text-uniloop-600" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">{t.currency}</label>
                        <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400 focus:border-transparent transition-all appearance-none font-medium text-gray-700">
                            <option value="MYR">{t.currencyMYR}</option>
                            <option value="CNY">{t.currencyCNY}</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">{t.category}</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400 focus:border-transparent transition-all appearance-none font-medium text-gray-700">
                        <option value="">{t.selectCategory}</option>
                        {categories.filter(c => c.key !== 'All').map(c => (
                            <option key={c.key} value={c.key}>{language === 'zh' ? c.zh : c.en}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">{t.descriptionLabel}</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400 focus:border-transparent transition-all resize-none" />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">{t.tags}</label>
                    <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400 focus:border-transparent transition-all" />
                </div>

                {/* Location */}
                <div className="space-y-3 pt-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">{t.location}</label>
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
                <div className="bg-uniloop-50/50 p-5 rounded-2xl border border-uniloop-100/50 space-y-3">
                    <label className="block text-xs font-bold text-uniloop-800 uppercase tracking-wider">{t.contactMethods}</label>
                    <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="WhatsApp" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400/20" />
                    <input value={wechat} onChange={e => setWechat(e.target.value)} placeholder="WeChat" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400/20" />
                    <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="Instagram" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-uniloop-400/20" />
                </div>

                <LoadingButton type="submit" loading={loading} className="w-full bg-uniloop-500 hover:bg-uniloop-600 text-white font-bold py-4 rounded-full shadow-lg shadow-uniloop-200 active:scale-95 transition-all text-sm uppercase tracking-widest mt-8 disabled:opacity-50">
                    {t.updateProduct}
                </LoadingButton>
            </form>
        </div>
    )
}

export default EditProduct
