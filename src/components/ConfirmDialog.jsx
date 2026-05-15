import React from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * 自定义确认弹窗，替代 window.confirm
 * 用法：
 *   setConfirmDialog({ message: '...', onConfirm: () => {}, onCancel: () => {} })
 *   {confirmDialog && <ConfirmDialog {...confirmDialog} confirmText={t.confirm} cancelText={t.cancel} />}
 */
const ConfirmDialog = ({
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    danger = true
}) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
                <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4 ${danger ? 'bg-rose-50 text-rose-500' : 'bg-uniloop-50 text-uniloop-500'}`}>
                    <AlertTriangle size={24} />
                </div>
                <p className="text-[15px] font-bold text-slate-700 leading-relaxed">{message}</p>
            </div>
            <div className="flex border-t border-slate-100">
                <button
                    onClick={onCancel}
                    className="flex-1 py-4 text-slate-500 font-bold text-[14px] hover:bg-slate-50 transition-colors"
                >
                    {cancelText}
                </button>
                <div className="w-px bg-slate-100" />
                <button
                    onClick={onConfirm}
                    className={`flex-1 py-4 font-bold text-[14px] transition-colors ${danger ? 'text-rose-500 hover:bg-rose-50' : 'text-uniloop-600 hover:bg-uniloop-50'}`}
                >
                    {confirmText}
                </button>
            </div>
        </div>
    </div>
)

export default ConfirmDialog
