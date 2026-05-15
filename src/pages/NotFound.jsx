import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

const NotFound = () => {
    const navigate = useNavigate()
    const isZh = navigator.language?.startsWith('zh')

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
            <div className="text-8xl mb-6">🔍</div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">
                {isZh ? '页面未找到' : 'Page Not Found'}
            </h1>
            <p className="text-sm text-gray-500 mb-8 max-w-xs">
                {isZh
                    ? '你访问的页面不存在，可能已被移除或链接有误。'
                    : "The page you're looking for doesn't exist or may have been moved."}
            </p>
            <div className="flex gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 rounded-full font-bold text-sm hover:bg-gray-200 transition-colors active:scale-95"
                >
                    <ArrowLeft size={16} />
                    {isZh ? '返回' : 'Go Back'}
                </button>
                <button
                    onClick={() => navigate('/home')}
                    className="flex items-center gap-2 px-5 py-3 bg-uniloop-500 text-white rounded-full font-bold text-sm hover:bg-uniloop-600 shadow-lg shadow-uniloop-200 transition-all active:scale-95"
                >
                    <Home size={16} />
                    {isZh ? '回首页' : 'Home'}
                </button>
            </div>
        </div>
    )
}

export default NotFound
