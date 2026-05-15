import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo)
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null })
    }

    // 从 navigator.language 判断是否为中文用户
    get isZh() {
        try {
            return navigator.language?.startsWith('zh')
        } catch {
            return false
        }
    }

    render() {
        if (this.state.hasError) {
            const zh = this.isZh
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 max-w-sm w-full text-center">
                        <div className="w-16 h-16 mx-auto bg-red-50 rounded-full flex items-center justify-center mb-6">
                            <AlertTriangle size={32} className="text-red-500" />
                        </div>
                        <h2 className="text-xl font-black text-gray-900 mb-2">
                            {zh ? '出错了' : 'Something Went Wrong'}
                        </h2>
                        <p className="text-sm text-gray-500 mb-6">
                            {zh
                                ? '页面遇到了意外错误，请刷新重试。'
                                : 'An unexpected error occurred. Please try again.'}
                        </p>
                        <button
                            onClick={this.handleRetry}
                            className="inline-flex items-center gap-2 bg-uniloop-500 hover:bg-uniloop-600 text-white font-bold px-6 py-3 rounded-full shadow-lg shadow-uniloop-200 active:scale-95 transition-all"
                        >
                            <RefreshCw size={16} />
                            {zh ? '重新加载' : 'Retry'}
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary

