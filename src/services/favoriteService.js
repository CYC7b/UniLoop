import { api } from '../lib/api'

export const listFavoriteProducts = () => api.get('/api/favorites')
export const listFavoriteIds = () => api.get('/api/favorites/ids')
export const addFavorite = (productId) => api.post('/api/favorites', { product_id: productId })
export const removeFavorite = (productId) => api.del(`/api/favorites/${productId}`)
