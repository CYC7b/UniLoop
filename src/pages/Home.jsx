import React, { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useProducts } from '../context/ProductContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { SkeletonCard } from '../components/Skeleton.jsx'
import { LOCATION_ALIASES } from '../lib/locations.js'
import { Search, X, LayoutGrid, MonitorSmartphone, Sparkles, Sofa, BookOpen, Gamepad2, Package, MapPin, Wifi } from 'lucide-react'
import ProductCardImage from '../components/ProductCardImage.jsx'

const fmtDate = (ts, lang) => {
  const d = new Date(ts)
  const now = Date.now()
  const diff = Math.floor((now - ts) / 1000)
  if (diff < 60) return lang === 'zh' ? '刚刚' : 'Just now'
  if (diff < 3600) return lang === 'zh' ? `${Math.floor(diff / 60)} 分钟前` : `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return lang === 'zh' ? `${Math.floor(diff / 3600)} 小时前` : `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

const SEARCH_HISTORY_KEY = 'uniloop_search_history'
const MAX_HISTORY = 8

const Home = () => {
  const { session } = useAuth()
  const { listings, favorites, toggleFavorite, loading, fetchLocations, fetchProducts } = useProducts()
  const { categories, language, translations, setUserLocation, userLocation } = useUI()
  const t = translations[language]
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [activeTab, setActiveTab] = useState('buy') // 'buy' | 'rent'
  const [activeCat, setActiveCat] = useState('All')
  const [activeLocByTab, setActiveLocByTab] = useState({
    buy: 'All Locations',
    rent: 'All Locations'
  })
  const [locationOptionsByTab, setLocationOptionsByTab] = useState({
    buy: ['All Locations'],
    rent: ['All Locations']
  })
  const activeLoc = activeLocByTab[activeTab] || 'All Locations'
  const locationOptions = locationOptionsByTab[activeTab] || ['All Locations']
  const [distance, setDistance] = useState('Any')
  const [toast, setToast] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const setActiveLocForActiveTab = (loc) => {
    setActiveLocByTab(prev => (
      prev[activeTab] === loc ? prev : { ...prev, [activeTab]: loc }
    ))
  }

  const handleTabSwitch = (tab) => {
    setActiveTab(tab)
    setActiveCat(tab === 'rent' ? 'Rentals' : 'All')
    setAppliedTerm('')
    setTerm('')
    setPage(1)
  }

  // Pagination & Backend Fetch States
  const [appliedTerm, setAppliedTerm] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [hasFetched, setHasFetched] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // 搜索历史
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]')
    } catch { return [] }
  })

  const saveSearchTerm = (q) => {
    if (!q.trim()) return
    const updated = [q, ...searchHistory.filter(h => h !== q)].slice(0, MAX_HISTORY)
    setSearchHistory(updated)
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
  }

  const clearHistory = () => {
    setSearchHistory([])
    localStorage.removeItem(SEARCH_HISTORY_KEY)
  }

  useEffect(() => {
    let mounted = true
    const params = activeTab === 'rent'
      ? { categoryFilter: 'Rentals' }
      : { excludeCategories: ['Rentals'] }

    fetchLocations(params).then(nextLocations => {
      if (!mounted) return
      setLocationOptionsByTab(prev => ({
        ...prev,
        [activeTab]: nextLocations
      }))
    })

    return () => { mounted = false }
  }, [activeTab, fetchLocations])

  // 热门标签
  const hotTags = useMemo(() => {
    const tagCount = {}
    listings.forEach(item => {
      (item.tags || []).forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1
      })
    })
    return Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag)
  }, [listings])

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const q = term.trim()

      if (!q) {
        setActiveLocForActiveTab('All Locations')
        setRefreshKey(k => k + 1)
        return
      }

      // 识别 UUID 格式 → 跳转用户主页
      if (UUID_REGEX.test(q)) {
        navigate(`/user/${q}`)
        return
      }

      // 提取符合系统字典的地点（使用 lib/locations.js 统一维护的别名）
      let processedTerm = q;
      let lowerQ = q.toLowerCase();
      let foundOfficialLoc = null;
      let matchedAlias = null;

      // 1. 首先尝试全称匹配（当前 tab 地点列表中的完整名称）
      const exactLoc = locationOptions.find(loc => loc !== 'All Locations' && lowerQ.includes(loc.toLowerCase()));
      if (exactLoc) {
        foundOfficialLoc = exactLoc;
        matchedAlias = exactLoc;
      } else {
        // 2. 使用 LOCATION_ALIASES 硬编码别名
        for (const [alias, officialStr] of Object.entries(LOCATION_ALIASES)) {
          if (lowerQ.includes(alias)) {
            if (locationOptions.includes(officialStr)) {
              foundOfficialLoc = officialStr;
              matchedAlias = alias;
              break;
            }
          }
        }
      }

      // 3. 别名未命中时，对当前 tab 地点列表做 token 模糊匹配（仅匹配 4+ 字符的词）
      if (!foundOfficialLoc) {
        const queryTokens = lowerQ.split(/[\s,&+]+/).filter(t => t.length >= 4);
        for (const loc of locationOptions) {
          if (loc === 'All Locations') continue;
          const locTokens = loc.toLowerCase().split(/[\s,&+]+/).filter(t => t.length >= 4);
          const hit = locTokens.find(lt => queryTokens.some(qt => lt.startsWith(qt) || qt.startsWith(lt)));
          if (hit) {
            const qt = queryTokens.find(qt => hit.startsWith(qt) || qt.startsWith(hit));
            foundOfficialLoc = loc;
            matchedAlias = qt;
            break;
          }
        }
      }

      if (foundOfficialLoc && matchedAlias) {
        const escapeRegExp = string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapeRegExp(matchedAlias), 'i');
        processedTerm = processedTerm.replace(regex, '').trim();
        setActiveLocForActiveTab(foundOfficialLoc);
      }

      saveSearchTerm(q)
      setAppliedTerm(processedTerm)
    }
  }

  // Backend Pagination Fetch Effect
  useEffect(() => {
    let mounted = true
    setHasFetched(false)
    const excludeCategories = activeTab === 'buy' ? ['Rentals'] : []
    const doFetch = async () => {
      const more = await fetchProducts(session?.user?.id, {
        page: 1,
        searchTerm: appliedTerm,
        categoryFilter: activeCat,
        excludeCategories,
        locationFilter: activeLoc,
        userLat: userLocation?.lat,
        userLng: userLocation?.lng,
        maxDistanceKm: distance
      })
      if (mounted) {
        setHasMore(more)
        setPage(1)
        setHasFetched(true)
      }
    }
    doFetch()
    return () => { mounted = false }
  }, [appliedTerm, activeCat, activeLoc, activeTab, distance, userLocation, fetchProducts, session?.user?.id, refreshKey])

  const loadMore = async () => {
    if (!hasMore || loading.products) return
    const nextPage = page + 1
    const excludeCategories = activeTab === 'buy' ? ['Rentals'] : []
    const more = await fetchProducts(session?.user?.id, {
      page: nextPage,
      searchTerm: appliedTerm,
      categoryFilter: activeCat,
      excludeCategories,
      locationFilter: activeLoc,
      userLat: userLocation?.lat,
      userLng: userLocation?.lng,
      maxDistanceKm: distance
    })
    setHasMore(more)
    setPage(nextPage)
  }

  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const handleGeoLocation = () => {
    if (!navigator.geolocation) {
      setToast('Geolocation not supported')
      return
    }

    setToast(language === 'zh' ? '正在获取位置...' : 'Acquiring location...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setToast(language === 'zh' ? '位置已获取' : 'Location Acquired')
        setTimeout(() => setToast(''), 2000)
      },
      (err) => {
        setToast(language === 'zh' ? '获取位置失败' : 'Failed to get location')
        setTimeout(() => setToast(''), 2000)
      }
    )
  }

  const filtered = listings.filter(item => (
    activeTab === 'buy' ? item.category !== 'Rentals' : item.category === 'Rentals'
  ))

  return (
    <div className="min-h-screen pb-24 relative">

      {/* Listing mode tabs */}
      <div className="-mt-1 px-5 pb-1">
        <div className="mx-auto grid w-full max-w-xs grid-cols-2">
          {[
            { key: 'buy', zh: '买闲置', en: 'Second-Hand' },
            { key: 'rent', zh: '租房', en: 'Rentals' },
          ].map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => handleTabSwitch(tab.key)}
                className="relative h-11 text-sm font-bold transition-all active:scale-95 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                style={{ color: isActive ? '#C06642' : '#8A6D5B' }}
              >
                {language === 'zh' ? tab.zh : tab.en}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1/2 h-0.5 w-14 -translate-x-1/2 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #D97757, #C06642)' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Search Bar with Menu toggle */}
      <div className="px-5 pt-2 pb-4 flex items-center gap-2.5 relative z-10">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-uniloop-600/70 active:scale-95 transition-all outline-none"
          style={{ background: 'rgba(254,251,244,0.8)', border: '1px solid rgba(200,120,80,0.25)' }}
        >
          <MapPin size={18} />
        </button>

        <div className="flex-1 rounded-2xl flex items-center px-4 py-3 relative transition-all"
          style={{ background: 'rgba(254,251,244,0.85)', border: '1px solid rgba(200,120,80,0.25)', boxShadow: '0 2px 12px rgba(100,50,25,0.06)' }}
        >
          <Search size={16} className="text-uniloop-400/60 mr-2.5 shrink-0 cursor-pointer" onClick={() => handleSearch({ key: 'Enter' })} />
          <input
            type="text"
            value={term}
            onChange={e => { const val = e.target.value; setTerm(val); if (val.trim() === '') { setAppliedTerm(''); setActiveLocForActiveTab('All Locations') } }}
            onKeyDown={handleSearch}
            placeholder={language === 'zh' ? '搜索商品 / 地点 / 用户' : 'Search items, location or user'}
            className="bg-transparent border-none outline-none text-uniloop-900 placeholder-uniloop-400/40 text-[13px] w-full pr-6 font-medium"
          />
          {term && (
            <button onClick={() => { setTerm(''); setAppliedTerm(''); setActiveLocForActiveTab('All Locations') }} className="absolute right-3 p-1 text-uniloop-400/50 hover:text-uniloop-600 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Categories Drawer Overlay */}
      <div className={`fixed inset-0 z-[100] flex transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        ></div>

        {/* Drawer */}
        <div className={`relative w-72 h-full flex flex-col transform transition-transform duration-300 ease-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ background: 'rgba(249,245,234,0.97)', backdropFilter: 'blur(24px)', borderRight: '1px solid rgba(200,120,80,0.2)', boxShadow: '4px 0 40px rgba(100,50,25,0.12)' }}>
          <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(200,120,80,0.15)' }}>
            <h2 className="text-lg font-serif font-bold text-uniloop-800 tracking-tight">{language === 'zh' ? '选择地点' : 'Select Location'}</h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-2">
              {locationOptions.map((loc) => {
                const isSelected = activeLoc === loc
                return (
                  <button
                    key={loc}
                    onClick={() => {
                      setActiveLocForActiveTab(loc)
                      setIsSidebarOpen(false)
                    }}
                    className={`flex items-center gap-4 w-full p-3 rounded-2xl transition-all active:scale-95 ${isSelected ? 'bg-uniloop-50 text-uniloop-700 shadow-sm border border-uniloop-100/50' : 'hover:bg-slate-50 text-slate-600 border border-transparent'}`}
                  >
                    <div className={`w-10 h-10 shrink-0 rounded-[12px] flex items-center justify-center shadow-sm overflow-hidden ${isSelected ? 'bg-white text-uniloop-600' : 'bg-slate-100 text-slate-500'}`}>
                      {loc === 'All Locations' ? <LayoutGrid size={20} /> : <MapPin size={20} />}
                    </div>
                    <span className="font-bold text-[14px]">
                      {loc === 'All Locations' ? t.allLocations || 'All Locations' : loc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Category selector (buy tab only) */}
      {activeTab === 'buy' && (() => {
        const buyCats = categories.filter(c => c.key !== 'Rentals')
        const iconMap = { All: LayoutGrid, Digital: MonitorSmartphone, Fashion: Sparkles, Home: Sofa, Learning: BookOpen, Hobbies: Gamepad2, BroadbandTransfer: Wifi, Others: Package }
        return (
          <div className="px-5 pb-4 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex gap-2 min-w-max">
              {buyCats.map(cat => {
                const Icon = iconMap[cat.key] || LayoutGrid
                const isActive = activeCat === cat.key
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCat(cat.key)}
                    className="flex shrink-0 items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                    style={{
                      background: isActive ? 'linear-gradient(145deg, #D97757, #C06642)' : 'rgba(253,252,250,0.9)',
                      color: isActive ? '#FAF9F7' : '#6A4E2A',
                      border: isActive ? '1px solid transparent' : '1px solid rgba(200,120,80,0.25)',
                      boxShadow: isActive ? '0 4px 14px rgba(217,119,87,0.3)' : 'none',
                    }}
                  >
                    <Icon size={14} />
                    <span>{language === 'zh' ? cat.zh : cat.en}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Product Grid */}
      <div className="px-5">
        {(loading.products || !hasFetched) ? (
          <div className="grid grid-cols-2 gap-3 pb-24 lg:grid-cols-4 lg:gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="flex flex-col gap-5 pb-24">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              {filtered.map(item => (
                <Link to={`/product/${item.id}`} key={item.id} className="block group">
                  <div className="rounded-2xl overflow-hidden transition-all duration-300 h-full flex flex-col active:scale-95"
                    style={{
                      background: 'rgba(254,251,244,0.88)',
                      border: '1px solid rgba(200,120,80,0.2)',
                      boxShadow: '0 3px 16px rgba(100,50,25,0.07)',
                    }}
                  >
                    <ProductCardImage
                      images={item.thumbnails?.length ? item.thumbnails : item.imageUrls?.length ? item.imageUrls : [item.thumbnailUrl || item.imageUrl]}
                      alt={item.title}
                    />
                    <div className="flex flex-col flex-1 px-2.5 pt-2.5 pb-2.5">
                      <h3 className="text-[13px] font-semibold text-uniloop-900/80 leading-snug line-clamp-2 mb-1">{item.title}</h3>
                      <p className="font-serif font-bold text-[13px] text-uniloop-600 mb-2.5">
                        {item.currency === 'CNY' ? '¥' : 'RM'} {item.price}
                      </p>
                      <div className="mt-auto flex items-center justify-between gap-1.5">
                        <button className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors text-uniloop-600/70 hover:text-uniloop-700"
                          style={{ background: 'rgba(249,245,234,0.8)', border: '1px solid rgba(200,120,80,0.18)' }}>
                          {t.wantIt}
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.id) }}
                          className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg transition-colors ${favorites.includes(item.id) ? 'text-rose-500' : 'text-uniloop-300 hover:text-uniloop-400'}`}
                          style={{ background: 'rgba(249,245,234,0.8)', border: '1px solid rgba(200,120,80,0.18)' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {hasMore ? (
              <button
                onClick={loadMore}
                className="w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 text-uniloop-600 text-[13px] uppercase tracking-widest"
                style={{ background: 'rgba(254,251,244,0.7)', border: '1px solid rgba(200,120,80,0.2)' }}
                disabled={loading.products}
              >
                {loading.products ? (
                  <div className="w-5 h-5 border-2 border-uniloop-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>{language === 'zh' ? '加载更多' : 'Load More'}</span>
                )}
              </button>
            ) : (
              <div className="text-center text-slate-400 text-xs font-bold py-6">
                {language === 'zh' ? "没有更多商品了" : "No more products"}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <p className="text-sm font-medium">{t.noItemsFound}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
