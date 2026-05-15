import React from 'react'

/**
 * 加载动画组件
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {string} color - Tailwind 颜色类，默认 uniloop
 * @param {string} text - 可选的加载文字
 */
const LoadingSpinner = ({ size = 'md', color = 'uniloop', text = '' }) => {
    const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
    const borderMap = { sm: 'border-2', md: 'border-2', lg: 'border-3' }

    return (
        <div className="flex flex-col items-center justify-center gap-2">
            <div
                className={`${sizeMap[size]} ${borderMap[size]} border-gray-200 border-t-${color}-500 rounded-full animate-spin`}
                style={{ borderTopColor: color === 'white' ? '#fff' : undefined }}
            />
            {text && <span className="text-xs text-gray-400 font-medium">{text}</span>}
        </div>
    )
}

/**
 * 全屏加载覆盖层
 */
export const FullScreenLoading = ({ text = '' }) => (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[200] flex items-center justify-center">
        <LoadingSpinner size="lg" text={text} />
    </div>
)

/**
 * 按钮内嵌加载状态
 * @param {boolean} loading - 是否在加载
 * @param {string} children - 按钮文字
 * @param {string} className - 额外样式
 */
export const LoadingButton = ({ loading, children, className = '', disabled, ...props }) => (
    <button
        disabled={loading || disabled}
        className={`relative ${className} ${loading ? 'pointer-events-none' : ''}`}
        {...props}
    >
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-inherit rounded-inherit">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
        )}
        <span className={loading ? 'opacity-0' : ''}>{children}</span>
    </button>
)

export default LoadingSpinner
