import React, { useState } from 'react'
import { useChat } from '../context/ChatContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { X, Flag, AlertTriangle } from 'lucide-react'
import { LoadingButton } from './LoadingSpinner.jsx'

const REPORT_REASONS = {
    en: [
        'Fake or misleading information',
        'Prohibited items',
        'Harassment or abuse',
        'Spam or scam',
        'Inappropriate content',
        'Other'
    ],
    zh: [
        '虚假或误导信息',
        '违禁物品',
        '骚扰或辱骂',
        '垃圾信息 / 诈骗',
        '不当内容',
        '其他'
    ]
}

/**
 * 举报弹窗组件
 * @param {string} type - 'product' | 'user' | 'message'
 * @param {string} targetId - 被举报的 ID
 * @param {function} onClose - 关闭回调
 */
const ReportModal = ({ type, targetId, onClose }) => {
    const { reportContent } = useChat()
    const { language, showToast } = useUI()
    const [reason, setReason] = useState('')
    const [details, setDetails] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const reasons = REPORT_REASONS[language] || REPORT_REASONS.en

    const handleSubmit = async () => {
        if (!reason) {
            showToast('warning', language === 'zh' ? '请选择举报原因' : 'Please select a reason')
            return
        }

        setSubmitting(true)
        try {
            await reportContent(type, targetId, reason, details)
            showToast('success', language === 'zh' ? '举报已提交，感谢你的反馈' : 'Report submitted. Thank you.')
            onClose()
        } catch (err) {
            console.error('Report error:', err)
            showToast('error', language === 'zh' ? '提交失败，请重试' : 'Failed to submit. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <div className="bg-white w-full sm:max-w-sm sm:rounded-[32px] rounded-t-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
                {/* Header */}
                <div className="p-6 pb-4 flex justify-between items-center border-b border-gray-50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center">
                            <Flag size={16} className="text-red-500" />
                        </div>
                        <h3 className="text-lg font-black text-gray-900">
                            {language === 'zh' ? '举报' : 'Report'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    <p className="text-xs text-gray-500 font-medium">
                        {language === 'zh' ? '请选择举报原因：' : 'Select a reason:'}
                    </p>

                    <div className="space-y-2">
                        {reasons.map((r, i) => (
                            <button
                                key={i}
                                onClick={() => setReason(r)}
                                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border ${reason === r
                                        ? 'bg-red-50 border-red-200 text-red-700'
                                        : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            {language === 'zh' ? '补充说明（可选）' : 'Additional details (optional)'}
                        </label>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            rows={3}
                            placeholder={language === 'zh' ? '请描述具体情况...' : 'Describe the issue...'}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
                        />
                    </div>

                    <div className="bg-amber-50 p-3 rounded-xl flex items-start gap-2">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                            {language === 'zh'
                                ? '恶意举报可能导致账号受限。请确保举报内容真实有效。'
                                : 'False reports may result in account restrictions. Please ensure your report is accurate.'}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 pt-0">
                    <LoadingButton
                        loading={submitting}
                        onClick={handleSubmit}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-100 active:scale-95 transition-all text-sm"
                    >
                        {language === 'zh' ? '提交举报' : 'Submit Report'}
                    </LoadingButton>
                </div>
            </div>
        </div>
    )
}

export default ReportModal
