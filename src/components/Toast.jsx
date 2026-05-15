import React, { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

const ICONS = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info
}

const STYLES = {
    success: 'bg-uniloop-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-gray-800 text-white'
}

/**
 * Toast 通知组件
 * 由 UIContext 中的 showToast 驱动
 */
const Toast = ({ toast, onClose }) => {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (!toast) { setVisible(false); return }

        // 入场动画
        requestAnimationFrame(() => setVisible(true))

        // 自动关闭
        const timer = setTimeout(() => {
            setVisible(false)
            setTimeout(onClose, 300) // 等退场动画完成
        }, toast.duration || 3000)

        return () => clearTimeout(timer)
    }, [toast, onClose])

    if (!toast) return null

    const Icon = ICONS[toast.type] || ICONS.info
    const style = STYLES[toast.type] || STYLES.info

    return (
        <div className="fixed top-0 left-0 right-0 z-[300] flex justify-center pointer-events-none px-4 pt-4">
            <div
                className={`
          ${style} rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3
          max-w-sm w-full pointer-events-auto
          transition-all duration-300 ease-out
          ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
        `}
            >
                <Icon size={18} className="shrink-0" />
                <span className="text-sm font-medium flex-1 leading-snug">{toast.message}</span>
                <button
                    onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
                    className="shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    )
}

export default Toast
