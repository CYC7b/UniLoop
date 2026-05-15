import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getToken } from '../lib/api'
import * as conversationService from '../services/conversationService'
import { mapConversation, mapMessage } from '../services/conversationService'
import { createReport } from '../services/reportService'
import { openMessageSocket } from '../services/wsService'
import { useAuth } from './AuthContext'
import { useUI } from './UIContext'

const ChatContext = createContext(null)

export const ChatProvider = ({ children }) => {
  const { session, authLoading } = useAuth()
  const { language, showToast } = useUI()
  const [conversations, setConversations] = useState([])
  const [conversationLoading, setConversationLoading] = useState(false)
  const markingReadRef = useRef(new Set())
  const wsRef = useRef(null)
  const wsReconnectTimer = useRef(null)

  const disconnectWS = useCallback(() => {
    if (wsReconnectTimer.current) {
      clearTimeout(wsReconnectTimer.current)
      wsReconnectTimer.current = null
    }
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const handleSocketEvent = useCallback((event) => {
    if (event.type === 'new_message') {
      const data = event.data
      setConversations(prev => prev.map(conversation => {
        if (conversation.id !== data.conversation_id) return conversation
        if (conversation.messages.some(message => message.id === data.message_id)) return conversation
        return {
          ...conversation,
          messages: [...conversation.messages, {
            id: data.message_id,
            text: data.content,
            sender: 'other',
            timestamp: new Date(data.created_at).getTime()
          }],
          lastMessage: data.content,
          lastTimestamp: new Date(data.created_at).getTime(),
          unreadCount: markingReadRef.current.has(data.conversation_id) ? 0 : (conversation.unreadCount || 0) + 1
        }
      }))
      return
    }

    if (event.type === 'conversation_update') {
      const data = event.data
      setConversations(prev => prev.map(conversation => {
        if (conversation.id !== data.conversation_id) return conversation
        return { ...conversation, lastMessage: data.last_message, lastTimestamp: new Date(data.updated_at).getTime() }
      }))
    }
  }, [])

  const connectWS = useCallback((token) => {
    disconnectWS()
    const socket = openMessageSocket(token, handleSocketEvent)
    wsRef.current = socket
    socket.onclose = () => {
      wsRef.current = null
      wsReconnectTimer.current = setTimeout(() => {
        const nextToken = getToken()
        if (nextToken) connectWS(nextToken)
      }, 3000)
    }
  }, [disconnectWS, handleSocketEvent])

  const fetchConversations = useCallback(async () => {
    if (!session?.user) {
      setConversations([])
      setConversationLoading(false)
      return
    }
    setConversationLoading(true)
    try {
      const res = await conversationService.listConversations()
      const mapped = (res.data || []).map(conversation => {
        const unread = markingReadRef.current.has(conversation.id) ? 0 : undefined
        return mapConversation(conversation, session.user.id, unread)
      })
      setConversations(mapped)
    } catch (err) {
      console.error('Error fetching conversations:', err)
    } finally {
      setConversationLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    if (authLoading) return
    if (!session?.user) {
      disconnectWS()
      setConversations([])
      setConversationLoading(false)
      return
    }
    fetchConversations()
    const token = getToken()
    if (token) connectWS(token)
    return () => disconnectWS()
  }, [authLoading, connectWS, disconnectWS, fetchConversations, session?.user])

  const fetchConversationDetail = useCallback(async (conversationId) => {
    if (!session?.user) return null
    try {
      const conversation = await conversationService.getConversation(conversationId)
      const mapped = mapConversation(conversation, session.user.id)
      setConversations(prev => {
        const exists = prev.find(item => item.id === conversationId)
        if (exists) return prev.map(item => item.id === conversationId ? mapped : item)
        return [mapped, ...prev]
      })
      return mapped
    } catch {
      return null
    }
  }, [session?.user])

  const markConversationRead = useCallback(async (conversationId) => {
    if (!session?.user) return
    try {
      markingReadRef.current.add(conversationId)
      setConversations(prev => prev.map(conversation =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
      ))
      await conversationService.markConversationRead(conversationId)
    } catch (err) {
      console.error('Error marking conversation read:', err)
    } finally {
      markingReadRef.current.delete(conversationId)
    }
  }, [session])

  const sendMessage = useCallback(async (conversationId, text) => {
    if (!session?.user) return
    try {
      const message = await conversationService.sendConversationMessage(conversationId, text)
      const mappedMessage = mapMessage(message, session.user.id)
      setConversations(prev => prev.map(conversation => {
        if (conversation.id !== conversationId) return conversation
        return {
          ...conversation,
          messages: [...conversation.messages, mappedMessage],
          lastMessage: text,
          lastTimestamp: Date.now()
        }
      }))
    } catch (err) {
      console.error('Error sending message:', err)
      showToast('error', language === 'zh' ? '消息发送失败' : 'Failed to send message')
    }
  }, [language, session, showToast])

  const findConversation = useCallback(async (productId) => {
    if (!session?.user) return null
    const existing = conversations.find(conversation => conversation.productId === productId)
    if (existing) return existing.id
    try {
      const res = await conversationService.listConversations()
      const found = (res.data || []).find(conversation => conversation.product_id === productId)
      return found?.id || null
    } catch {
      return null
    }
  }, [conversations, session])

  const createConversationWithMessage = useCallback(async (product, messageText) => {
    if (!session?.user) return null
    if (product.owner_id === session.user.id) {
      showToast('warning', language === 'zh' ? '不能给自己的商品发消息' : 'Cannot message your own product')
      return null
    }
    try {
      const conversation = await conversationService.createConversation(product.id, messageText)
      const mapped = {
        ...mapConversation(conversation, session.user.id),
        sellerName: conversation.other_name || 'Seller',
        lastMessage: conversation.last_message || messageText,
        lastTimestamp: Date.now(),
        unreadCount: 0
      }
      setConversations(prev => [mapped, ...prev.filter(item => item.id !== conversation.id)])
      return conversation.id
    } catch (err) {
      console.error('Error creating conversation:', err)
      showToast('error', language === 'zh' ? '发送失败' : 'Failed to send')
      return null
    }
  }, [language, session, showToast])

  const addIncomingMessage = useCallback((conversationId, rawMessage) => {
    const newMessage = {
      id: rawMessage.id,
      text: rawMessage.content,
      sender: 'other',
      timestamp: new Date(rawMessage.created_at).getTime()
    }
    setConversations(prev => prev.map(conversation => {
      if (conversation.id !== conversationId) return conversation
      return {
        ...conversation,
        messages: [...conversation.messages, newMessage],
        lastMessage: rawMessage.content,
        lastTimestamp: new Date(rawMessage.created_at).getTime(),
        unreadCount: markingReadRef.current.has(conversationId) ? 0 : (conversation.unreadCount || 0) + 1
      }
    }))
  }, [])

  const deleteConversation = useCallback(async (conversationId) => {
    if (!session?.user) return
    try {
      await conversationService.deleteConversation(conversationId)
      setConversations(prev => prev.filter(conversation => conversation.id !== conversationId))
      showToast('success', language === 'zh' ? '会话已删除' : 'Conversation deleted')
    } catch (err) {
      console.error('Error deleting conversation:', err)
      showToast('error', language === 'zh' ? '删除失败' : 'Failed to delete')
    }
  }, [language, session, showToast])

  const reportContent = useCallback(async (type, targetId, reason) => {
    if (!session?.user) {
      showToast('error', language === 'zh' ? '请先登录' : 'Please login first')
      return
    }
    await createReport(type, targetId, reason)
  }, [language, session, showToast])

  const unreadCount = useMemo(() => {
    return conversations.reduce((total, conversation) => total + (conversation.unreadCount || 0), 0)
  }, [conversations])

  const value = useMemo(() => ({
    conversations,
    conversationLoading,
    fetchConversations,
    fetchConversationDetail,
    markConversationRead,
    sendMessage,
    findConversation,
    createConversationWithMessage,
    addIncomingMessage,
    deleteConversation,
    reportContent,
    unreadCount,
    disconnectWS
  }), [conversations, conversationLoading, fetchConversations, fetchConversationDetail, markConversationRead, sendMessage,
    findConversation, createConversationWithMessage, addIncomingMessage, deleteConversation,
    reportContent, unreadCount, disconnectWS])

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export const useChat = () => useContext(ChatContext)
