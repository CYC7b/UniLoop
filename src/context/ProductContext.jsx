import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as favoriteService from '../services/favoriteService'
import * as profileService from '../services/profileService'
import * as productService from '../services/productService'
import { mapDBProduct } from '../services/productService'
import { useAuth } from './AuthContext'
import { useUI } from './UIContext'

const ProductContext = createContext(null)

export const ProductProvider = ({ children }) => {
  const { session, authLoading } = useAuth()
  const { language, showToast } = useUI()
  const [listings, setListings] = useState([])
  const [favorites, setFavorites] = useState([])
  const [locations, setLocations] = useState(['All Locations'])
  const [loading, setLoading] = useState({ products: true, profile: false })
  const fetchRequestRef = useRef(0)

  const fetchLocations = useCallback(async () => {
    try {
      const res = await productService.listLocations()
      if (res.locations) {
        setLocations(['All Locations', ...res.locations])
      }
    } catch (err) {
      console.warn('fetchLocations failed:', err)
    }
  }, [])

  const fetchProducts = useCallback(async (currentUserId = null, params = {}) => {
    const requestId = fetchRequestRef.current + 1
    fetchRequestRef.current = requestId
    setLoading(prev => ({ ...prev, products: true }))
    try {
      const res = await productService.listProducts(params)
      const items = res.data || []
      const mapped = items.map(product => mapDBProduct(product, currentUserId))
      const page = params.page || 1
      const limit = params.limit || 20
      if (requestId === fetchRequestRef.current) {
        setListings(prev => page === 1 ? mapped : [...prev, ...mapped.filter(n => !prev.some(o => o.id === n.id))])
      }
      return items.length >= limit
    } catch (err) {
      console.error('Error fetching products:', err)
      return false
    } finally {
      if (requestId === fetchRequestRef.current) {
        setLoading(prev => ({ ...prev, products: false }))
      }
    }
  }, [])

  const fetchFavorites = useCallback(async () => {
    if (!session?.user) {
      setFavorites([])
      return
    }
    try {
      const res = await favoriteService.listFavoriteIds()
      setFavorites(res.ids || [])
    } catch (err) {
      console.error('Error fetching favorites:', err)
    }
  }, [session?.user])

  useEffect(() => {
    if (authLoading) return
    fetchLocations()
    fetchProducts(session?.user?.id).finally(() => {})
    fetchFavorites()
  }, [authLoading, fetchFavorites, fetchLocations, fetchProducts, session?.user?.id])

  const getProductById = useCallback(async (id, currentUserId = null) => {
    const local = listings.find(item => item.id === id)
    if (local) return local
    try {
      const product = await productService.getProduct(id)
      return mapDBProduct(product, currentUserId)
    } catch {
      return null
    }
  }, [listings])

  const fetchUserProducts = useCallback(async (userId) => {
    try {
      const res = await profileService.getPublicProfile(userId)
      return (res.listings || []).map(product => mapDBProduct(product, userId))
    } catch {
      return []
    }
  }, [])

  const fetchFavoriteProducts = useCallback(async () => {
    try {
      const res = await favoriteService.listFavoriteProducts()
      const items = res.items || res.data || res.favorites || []
      return items.map(product => mapDBProduct(product, session?.user?.id))
    } catch (err) {
      console.error('Error fetching favorite products:', err)
      return []
    }
  }, [session?.user?.id])

  const addListing = useCallback(async ({ images, thumbnails = [], ...data }) => {
    if (!session?.user) {
      showToast('error', language === 'zh' ? '请先登录' : 'Please login first')
      return null
    }
    try {
      const uploadRes = await productService.uploadProductImages(images, thumbnails)
      const product = await productService.createProduct({
        ...data,
        images: uploadRes.urls || [],
        thumbnails: uploadRes.thumbnails || []
      })
      fetchProducts(session.user.id)
      fetchLocations()
      return product.id
    } catch (err) {
      console.error('Error adding listing:', err)
      showToast('error', language === 'zh' ? '发布失败，请重试' : 'Failed to publish. Please try again.')
      return null
    }
  }, [fetchLocations, fetchProducts, language, session, showToast])

  const deleteListing = useCallback(async (id) => {
    if (!session?.user) return false
    try {
      await productService.deleteProduct(id)
      setListings(prev => prev.filter(item => item.id !== id))
      fetchLocations()
      showToast('success', language === 'zh' ? '商品已删除' : 'Item deleted')
      return true
    } catch (err) {
      console.error('Error deleting:', err)
      showToast('error', language === 'zh' ? '删除失败' : 'Failed to delete')
      return false
    }
  }, [fetchLocations, language, session, showToast])

  const updateListing = useCallback(async (id, {
    newImages = [],
    newThumbs = [],
    retainedImages = [],
    deletedImages = [],
    ...data
  }) => {
    if (!session?.user) return null
    try {
      let newUrls = []
      let newThumbUrls = []
      if (newImages.length > 0) {
        const uploadRes = await productService.uploadProductImages(newImages, newThumbs)
        newUrls = uploadRes.urls || []
        newThumbUrls = uploadRes.thumbnails || newUrls
      }

      const finalImages = [...retainedImages, ...newUrls]
      const finalThumbnails = [...retainedImages, ...newThumbUrls]
      const payload = { ...data }
      if (finalImages.length > 0) {
        payload.images = finalImages
        payload.thumbnails = finalThumbnails
      }

      await productService.updateProduct(id, payload)
      fetchProducts(session.user.id)
      fetchLocations()
      return id
    } catch (err) {
      console.error('Error updating listing:', err)
      return null
    }
  }, [fetchLocations, fetchProducts, session])

  const toggleFavorite = useCallback(async (productId) => {
    if (!session?.user) {
      showToast('warning', language === 'zh' ? '请先登录' : 'Please login first')
      return
    }
    const isFav = favorites.includes(productId)
    try {
      if (isFav) {
        await favoriteService.removeFavorite(productId)
        setFavorites(prev => prev.filter(id => id !== productId))
      } else {
        await favoriteService.addFavorite(productId)
        setFavorites(prev => [...prev, productId])
      }
    } catch (err) {
      console.error('Error toggling favorite:', err)
    }
  }, [favorites, language, session, showToast])

  const value = useMemo(() => ({
    listings,
    favorites,
    locations,
    loading,
    fetchLocations,
    fetchProducts,
    getProductById,
    fetchUserProducts,
    fetchFavoriteProducts,
    addListing,
    updateListing,
    deleteListing,
    deleteProduct: deleteListing,
    toggleFavorite
  }), [listings, favorites, locations, loading, fetchLocations, fetchProducts, getProductById,
    fetchUserProducts, fetchFavoriteProducts, addListing, updateListing, deleteListing, toggleFavorite])

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
}

export const useProducts = () => useContext(ProductContext)
