import { api } from '../lib/api'

export const mapMessage = (message, currentUserId) => ({
  id: message.id,
  text: message.content,
  sender: message.sender_id === currentUserId ? 'me' : 'other',
  timestamp: new Date(message.created_at).getTime()
})

export const mapConversation = (conversation, currentUserId, unreadOverride) => ({
  id: conversation.id,
  productId: conversation.product_id,
  productTitle: conversation.product_title,
  productImage: conversation.product_image,
  productStatus: conversation.product_status,
  sellerName: conversation.other_name || 'User',
  otherUserId: conversation.other_user_id,
  messages: (conversation.messages || []).map(message => mapMessage(message, currentUserId)),
  lastMessage: conversation.last_message,
  lastTimestamp: new Date(conversation.updated_at).getTime(),
  unreadCount: unreadOverride ?? (conversation.unread_count || 0)
})

export const listConversations = () => api.get('/api/conversations')
export const getConversation = (conversationId) => api.get(`/api/conversations/${conversationId}`)
export const markConversationRead = (conversationId) => api.put(`/api/conversations/${conversationId}/read`)
export const deleteConversation = (conversationId) => api.del(`/api/conversations/${conversationId}`)
export const sendConversationMessage = (conversationId, content) => {
  return api.post(`/api/conversations/${conversationId}/messages`, { content })
}
export const createConversation = (productId, message) => {
  return api.post('/api/conversations', { product_id: productId, message })
}
