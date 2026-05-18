import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { getPublicProfile } from '../services/profileService'
import { ArrowLeft, CheckCircle, Package } from 'lucide-react'
import ProductCardImage from '../components/ProductCardImage.jsx'
import { SkeletonCard } from '../components/Skeleton.jsx'
import { DEFAULT_AVATAR } from '../lib/avatar'

const UserProfile = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { session } = useAuth()
    const { language } = useUI()

    const [profile, setProfile] = useState(null)
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const res = await getPublicProfile(id)
                if (res.profile) setProfile(res.profile)
                if (res.listings) {
                    setProducts(res.listings.map(p => ({
                        id: p.id,
                        title: p.title,
                        price: p.price,
                        imageUrl: p.images?.[0] || '',
                        imageUrls: p.images || [],
                        thumbnails: p.thumbnails || [],
                        category: p.category,
                        currency: p.currency || 'MYR',
                        tags: p.tags || []
                    })))
                }
            } catch (err) {
                console.error('Error fetching user profile:', err)
            } finally {
                setLoading(false)
            }
        }
        if (id) fetchData()
    }, [id])

    const isMe = session?.user?.id === id

    if (loading) {
        return (
            <div className="mx-auto max-w-2xl min-h-screen pb-24">
                <div className="px-4 pt-6">
                    <div className="animate-pulse">
                        <div className="flex items-center gap-4 mb-6"><div className="w-10 h-10 bg-slate-200 rounded-full" /><div className="h-5 bg-slate-200 rounded-xl w-24" /></div>
                        <div className="bg-slate-100 rounded-[2.5rem] h-48 mb-6" />
                        <div className="grid grid-cols-2 gap-3">{[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}</div>
                    </div>
                </div>
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="mx-auto max-w-2xl min-h-screen pb-24">
                <div className="px-4 pt-6">
                    <div className="flex items-center gap-3 mb-8">
                        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-slate-500 hover:text-uniloop-600 transition-colors shadow-sm border border-white/50"><ArrowLeft size={20} /></button>
                    </div>
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4"><Package size={36} /></div>
                        <p className="text-sm font-bold text-slate-500">{language === 'zh' ? '用户不存在' : 'User not found'}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-2xl min-h-screen pb-24">
            <div className="px-4 pt-6 pb-2 sticky top-0 z-10">
                <div className="bg-white/90 backdrop-blur-xl px-5 py-4 rounded-[2rem] shadow-[0_8px_20px_rgba(0,0,0,0.04)] border border-white/60 flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:text-uniloop-600 hover:bg-uniloop-50 transition-colors shadow-sm"><ArrowLeft size={20} /></button>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">{language === 'zh' ? '用户主页' : 'User Profile'}</h1>
                </div>
            </div>

            <div className="px-4 mt-4">
                <div className="bg-[#C07040] px-6 pt-8 pb-8 rounded-[2.5rem] shadow-[0_12px_30px_rgba(192,112,64,0.25)] relative overflow-hidden">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-uniloop-300/20 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center gap-5 relative z-10">
                        <img src={profile.avatar_url || DEFAULT_AVATAR} alt="avatar" className="w-20 h-20 rounded-full object-cover border-[3px] border-white/80 shadow-[0_8px_16px_rgba(0,0,0,0.1)]" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="text-xl font-black text-white truncate drop-shadow-sm">{profile.full_name || 'User'}</div>
                                {profile.verification_status === 'verified' && <CheckCircle size={20} fill="#fdfbf7" className="text-[#C07040] shrink-0" />}
                            </div>
                            <div className="text-[13px] text-uniloop-50 font-bold truncate mt-1 opacity-90 drop-shadow-sm">{profile.school || 'University'}</div>
                            <div className="mt-4">
                                {profile.verification_status === 'verified' ? (
                                    <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 min-w-max text-white border border-white/30 rounded-full text-[11px] font-black uppercase tracking-wider backdrop-blur-md"><span>✅</span>{language === 'zh' ? '已认证 / Verified' : 'Verified'}</div>
                                ) : profile.verification_status === 'pending' ? (
                                    <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-400 text-amber-900 rounded-full text-[11px] font-black shadow-lg shadow-black/5 uppercase tracking-wider"><span className="animate-pulse">⏳</span>{language === 'zh' ? '审核中' : 'Pending'}</div>
                                ) : (
                                    <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 text-white/70 border border-white/20 rounded-full text-[11px] font-bold uppercase tracking-wider backdrop-blur-md">{language === 'zh' ? '未认证' : 'Unverified'}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 mt-4">
                <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] px-6 py-4 shadow-[0_8px_20px_rgba(0,0,0,0.03)] border border-white/60">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{language === 'zh' ? '用户 ID' : 'User ID'}</div>
                    <div className="text-xs font-mono text-slate-500 break-all select-all">{profile.id}</div>
                </div>
            </div>

            <div className="mt-8 px-4">
                <div className="flex items-center gap-2 mb-4 px-1">
                    <Package size={16} className="text-uniloop-600" />
                    <h2 className="text-[13px] font-black text-slate-700 uppercase tracking-wider">
                        {language === 'zh' ? '发布的商品' : 'Published Items'}
                        {products.length > 0 && <span className="ml-2 text-uniloop-600">({products.length})</span>}
                    </h2>
                </div>

                {products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center text-gray-400 py-10">
                        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3"><Package size={24} className="text-slate-300" /></div>
                        <div className="text-xs font-bold">{language === 'zh' ? '暂无发布的商品' : 'No items listed yet'}</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {products.map(item => (
                            <Link key={item.id} to={`/product/${item.id}`} className="bg-white/80 backdrop-blur-sm rounded-[2rem] overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.03)] border border-white/60 group flex flex-col h-full hover:shadow-[0_12px_30px_rgba(0,0,0,0.06)] transition-all duration-300">
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
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default UserProfile
