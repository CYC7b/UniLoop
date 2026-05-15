import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChat } from '../context/ChatContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { MessageSquare, ChevronRight, ArrowLeft, Trash2 } from 'lucide-react'
import { SkeletonInbox } from '../components/Skeleton.jsx'

const Inbox = () => {
  const { conversations, conversationLoading, deleteConversation } = useChat()
  const { language, translations } = useUI()
  const t = translations[language]
  const navigate = useNavigate()
  const [deletingId, setDeletingId] = useState(null)

  const handleDelete = async (e, convId) => {
    e.stopPropagation() // Prevent navigating to the chat room
    if (deletingId) return // Prevent double-clicks
    const confirmMsg = language === 'zh' ? '确定要删除这个会话吗？所有聊天记录都将被清除。' : 'Delete this conversation? All messages will be permanently removed.'
    if (!window.confirm(confirmMsg)) return
    setDeletingId(convId)
    await deleteConversation(convId)
    setDeletingId(null)
  }

  return (
    <div className="mx-auto max-w-2xl min-h-screen pb-20 relative">
      <div className="px-4 pt-6 pb-2 sticky top-0 z-10">
        <div className="bg-white/90 backdrop-blur-xl px-5 py-4 rounded-[2rem] shadow-[0_8px_20px_rgba(0,0,0,0.04)] border border-white/60 flex items-center gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:text-uniloop-600 hover:bg-uniloop-50 transition-colors shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">{t.inbox}</h1>
        </div>
      </div>

      <div className="mt-4 px-4">
        {conversationLoading ? (
          <SkeletonInbox />
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 bg-white/60 rounded-[2rem] shadow-sm flex items-center justify-center text-slate-400 mb-4 border border-white/50">
              <MessageSquare size={36} />
            </div>
            <p className="text-sm font-bold text-slate-500">{t.noMessages}</p>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-3 shadow-[0_8px_20px_rgba(0,0,0,0.03)] border border-white/60 flex flex-col gap-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className="relative group"
              >
                <button
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className="w-full flex items-center gap-4 p-3 bg-white/40 hover:bg-white rounded-3xl transition-all active:scale-95 text-left border border-white/30 shadow-sm"
                >
                  <div className="w-16 h-16 rounded-[1.2rem] overflow-hidden bg-slate-50 shrink-0 border border-slate-100 shadow-sm">
                    <img src={conv.productImage} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-black text-slate-800 text-[15px] truncate">{conv.sellerName}</span>
                      <span className="text-[11px] font-bold text-slate-400">
                        {new Date(conv.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[13px] text-uniloop-600 font-bold truncate">{conv.productTitle}</span>
                      {conv.productStatus && conv.productStatus !== 'active' && (
                        <span className="shrink-0 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {language === 'zh' ? '已下架' : 'Delisted'}
                        </span>
                      )}
                    </div>
                    <div className={`text-[13px] truncate ${conv.unreadCount > 0 ? 'font-bold text-slate-800' : 'font-medium text-slate-500'}`}>
                      {conv.lastMessage || t.tapToChat}
                    </div>
                  </div>
                  {conv.unreadCount > 0 ? (
                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shrink-0 shadow-sm shadow-red-200">
                      <span className="text-white text-[10px] font-bold">{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</span>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  )}
                </button>
                {/* Delete button — appears on hover (desktop) or always visible on mobile */}
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  disabled={deletingId === conv.id}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-50 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 md:opacity-0 active:scale-90 z-10"
                  title={language === 'zh' ? '删除会话' : 'Delete conversation'}
                >
                  {deletingId === conv.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Inbox
