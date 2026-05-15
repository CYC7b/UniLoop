import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import { Search, MapPin, Loader2 } from 'lucide-react'
import { formatCoordinatesName, resolvePickedLocationName, searchLocations } from '../services/locationService'

/**
 * LocationPicker — 地名搜索 + Leaflet 地图选点
 *
 * Props:
 *   locationName: string
 *   setLocationName: (name) => void
 *   latlng: { lat, lng }
 *   setLatlng: ({ lat, lng }) => void
 *   language: 'zh' | 'en'
 *   locations: string[]  (历史位置建议)
 */

// 内部组件：点击地图选坐标
const ClickPicker = ({ onPick }) => {
    useMapEvents({
        click(e) {
            onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
        }
    })
    return null
}

// 内部组件：修复地图尺寸 + 当坐标变化时让地图飞到新位置
const MapFixer = ({ latlng }) => {
    const map = useMap()
    const prevRef = useRef(latlng)

    // 初始化后刷新地图尺寸，解决容器渲染延迟问题
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize()
        }, 200)
        return () => clearTimeout(timer)
    }, [map])

    useEffect(() => {
        if (latlng.lat !== prevRef.current.lat || latlng.lng !== prevRef.current.lng) {
            map.flyTo([latlng.lat, latlng.lng], 16, { duration: 1.2 })
            prevRef.current = latlng
        }
    }, [latlng, map])

    return null
}

const LocationPicker = ({ locationName, setLocationName, latlng, setLatlng, language, locations = [] }) => {
    const [suggestions, setSuggestions] = useState([])
    const [searching, setSearching] = useState(false)
    const [resolvingLocation, setResolvingLocation] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const debounceRef = useRef(null)
    const reverseLookupRef = useRef(0)
    const wrapperRef = useRef(null)

    // 点击外部关闭建议列表
    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Nominatim 搜索（防抖 500ms）
    const searchNominatim = useCallback(async (query) => {
        if (!query || query.length < 2) {
            setSuggestions([])
            return
        }
        setSearching(true)
        try {
            setSuggestions(await searchLocations(query, language))
            setShowSuggestions(true)
        } catch (err) {
            console.warn('Nominatim search failed:', err)
            setSuggestions([])
        } finally {
            setSearching(false)
        }
    }, [language])

    const handleInputChange = (e) => {
        const val = e.target.value
        reverseLookupRef.current += 1
        setResolvingLocation(false)
        setLocationName(val)

        // 防抖搜索
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            searchNominatim(val)
        }, 500)
    }

    const handleSelectSuggestion = (suggestion) => {
        reverseLookupRef.current += 1
        setResolvingLocation(false)
        setLocationName(suggestion.name)
        setLatlng({ lat: suggestion.lat, lng: suggestion.lng })
        setSuggestions([])
        setShowSuggestions(false)
    }

    const resolvePickedLocation = useCallback(async (coords) => {
        const requestId = reverseLookupRef.current + 1
        reverseLookupRef.current = requestId
        setResolvingLocation(true)
        try {
            const name = await resolvePickedLocationName(coords, language)
            if (reverseLookupRef.current !== requestId) return
            setLocationName(name)
        } catch (err) {
            console.warn('Nominatim reverse lookup failed:', err)
            if (reverseLookupRef.current === requestId) {
                setLocationName(formatCoordinatesName(coords))
            }
        } finally {
            if (reverseLookupRef.current === requestId) {
                setResolvingLocation(false)
            }
        }
    }, [language, setLocationName])

    const handleMapClick = (coords) => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        setLatlng(coords)
        setLocationName(formatCoordinatesName(coords))
        setSuggestions([])
        setShowSuggestions(false)
        resolvePickedLocation(coords)
    }

    const t = {
        placeholder: language === 'zh' ? '输入地名搜索...' : 'Search location...',
        tapHint: language === 'zh' ? '点击地图微调位置' : 'Tap map to fine-tune',
        searching: language === 'zh' ? '搜索中...' : 'Searching...',
        noResults: language === 'zh' ? '未找到结果，试试其他关键词' : 'No results, try other keywords'
    }

    return (
        <div className="space-y-3" ref={wrapperRef}>
            {/* 搜索输入框 */}
            <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                    {searching || resolvingLocation ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </div>
                <input
                    value={locationName}
                    onChange={handleInputChange}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
                    placeholder={t.placeholder}
                    className="w-full bg-white/60 border border-white/50 rounded-2xl pl-11 pr-4 py-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-uniloop-400/20 focus:bg-white transition-all shadow-sm font-medium text-slate-700"
                />

                {/* 搜索建议下拉 */}
                {showSuggestions && (
                    <div className="absolute top-full left-0 right-0 z-[500] mt-1 bg-white rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden max-h-60 overflow-y-auto">
                        {suggestions.length > 0 ? (
                            suggestions.map((item, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectSuggestion(item)}
                                    className="w-full text-left px-4 py-3 hover:bg-uniloop-50 transition-colors flex items-start gap-3 border-b border-slate-50 last:border-0"
                                >
                                    <MapPin size={16} className="text-uniloop-500 mt-0.5 shrink-0" />
                                    <span className="text-sm font-medium text-slate-700 leading-snug">{item.name}</span>
                                </button>
                            ))
                        ) : (
                            !searching && locationName.length >= 2 && (
                                <div className="px-4 py-3 text-xs text-slate-400 text-center">{t.noResults}</div>
                            )
                        )}
                    </div>
                )}
            </div>

            {/* 地图 */}
            <div className="h-48 w-full rounded-[1.5rem] overflow-hidden relative z-0 border border-white/50 shadow-sm bg-slate-50">
                <MapContainer center={[latlng.lat, latlng.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <Marker position={[latlng.lat, latlng.lng]} />
                    <ClickPicker onPick={handleMapClick} />
                    <MapFixer latlng={latlng} />
                </MapContainer>
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-[11px] font-bold text-uniloop-600 shadow-sm z-[400] pointer-events-none border border-white">
                    {t.tapHint}
                </div>
            </div>
        </div>
    )
}

export default LocationPicker
