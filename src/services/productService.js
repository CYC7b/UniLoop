import { api } from '../lib/api'

export const CATEGORY_DEF = [
  { key: 'All', en: 'All', zh: '全部' },
  { key: 'BroadbandTransfer', en: 'Broadband Transfer', zh: '宽带转户' },
  { key: 'Digital', en: 'Digital', zh: '数码电子' },
  { key: 'Fashion', en: 'Fashion', zh: '时尚美妆' },
  { key: 'Home', en: 'Home', zh: '生活家居' },
  { key: 'Learning', en: 'Learning', zh: '学习资源' },
  { key: 'Hobbies', en: 'Hobbies', zh: '兴趣娱乐' },
  { key: 'Rentals', en: 'Rentals', zh: '租房/转租' },
  { key: 'Others', en: 'Others', zh: '其他' }
]

export const mapDBProduct = (p, currentUserId) => ({
  id: p.id,
  title: p.title,
  price: p.price,
  imageUrl: p.images?.[0] || '',
  imageUrls: p.images || [],
  thumbnailUrl: p.thumbnails?.[0] || p.images?.[0] || '',
  thumbnails: p.thumbnails || [],
  description: p.description,
  createdAt: new Date(p.created_at).getTime(),
  contact: p.contact_info?.whatsapp || '',
  whatsapp: p.contact_info?.whatsapp || '',
  wechat: p.contact_info?.wechat || '',
  instagram: p.contact_info?.instagram || '',
  locationName: p.location_name,
  lat: p.lat,
  lng: p.lng,
  category: p.category,
  tags: p.tags || [],
  currency: p.currency || 'MYR',
  owner: currentUserId && currentUserId === p.owner_id ? 'me' : 'others',
  owner_id: p.owner_id
})

export async function listProducts({
  page = 1,
  limit = 20,
  searchTerm = '',
  categoryFilter = 'All',
  excludeCategories = [],
  locationFilter = 'All Locations',
  userLat = null,
  userLng = null,
  maxDistanceKm = null
} = {}) {
  const params = new URLSearchParams()
  params.set('page', page)
  params.set('limit', limit)
  if (searchTerm) params.set('search', searchTerm)
  if (categoryFilter && categoryFilter !== 'All') params.set('category', categoryFilter)
  if (excludeCategories.length > 0) params.set('exclude_categories', excludeCategories.join(','))
  if (locationFilter && locationFilter !== 'All Locations') params.set('location', locationFilter)
  if (userLat != null) params.set('lat', userLat)
  if (userLng != null) params.set('lng', userLng)
  if (maxDistanceKm && maxDistanceKm !== 'Any') params.set('max_dist', maxDistanceKm)
  return api.get(`/api/products?${params.toString()}`)
}

export const getProduct = (id) => api.get(`/api/products/${id}`)
export function listLocations({
  categoryFilter = 'All',
  excludeCategories = []
} = {}) {
  const params = new URLSearchParams()
  if (categoryFilter && categoryFilter !== 'All') params.set('category', categoryFilter)
  if (excludeCategories.length > 0) params.set('exclude_categories', excludeCategories.join(','))
  const query = params.toString()
  return api.get(`/api/products/locations${query ? `?${query}` : ''}`)
}
export const deleteProduct = (id) => api.del(`/api/products/${id}`)

export function uploadProductImages(images, thumbnails = []) {
  const formData = new FormData()
  for (const file of images) formData.append('images', file)
  for (const file of thumbnails) formData.append('thumbnails', file)
  return api.upload('/api/uploads/images', formData)
}

export function createProduct(data) {
  return api.post('/api/products', productPayload(data))
}

export function updateProduct(id, data) {
  return api.put(`/api/products/${id}`, productPayload(data))
}

function productPayload({
  title,
  price,
  currency = 'MYR',
  description,
  images,
  thumbnails,
  whatsapp,
  wechat,
  instagram,
  locationName,
  lat,
  lng,
  category,
  tags = []
}) {
  const payload = {
    title,
    price: Number(price),
    currency,
    description,
    category,
    tags,
    location_name: locationName,
    lat,
    lng,
    contact_info: { whatsapp, wechat, instagram }
  }
  if (images) payload.images = images
  if (thumbnails) payload.thumbnails = thumbnails
  return payload
}
