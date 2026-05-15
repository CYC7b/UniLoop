import React from 'react'

const Bone = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg ${className}`}
    style={{ background: 'rgba(200,120,80,0.13)' }} />
)

export const SkeletonCard = () => (
  <div className="rounded-2xl p-3 h-full flex flex-col"
    style={{ background: 'rgba(254,251,244,0.7)', border: '1px solid rgba(200,120,80,0.15)' }}>
    <Bone className="aspect-square w-full rounded-xl mb-3" />
    <div className="space-y-2 flex-1 px-0.5">
      <Bone className="h-3 w-3/4" />
      <Bone className="h-4 w-1/2" />
    </div>
  </div>
)

export const SkeletonDetail = () => (
  <div className="min-h-screen pb-20" style={{ background: '#FAF9F7' }}>
    <div className="mx-auto max-w-6xl md:p-8">
      <div className="md:grid md:grid-cols-2 md:gap-12">
        <div>
          <Bone className="w-full aspect-square md:rounded-3xl rounded-none" />
          <div className="flex gap-3 mt-4 px-4 md:px-0">
            {[1, 2, 3].map(i => <Bone key={i} className="w-14 h-14 rounded-xl" />)}
          </div>
        </div>
        <div className="p-6 md:p-0 space-y-6">
          <div className="space-y-3">
            <Bone className="h-8 w-3/4" />
            <Bone className="h-8 w-24" />
            <Bone className="h-6 w-40 rounded-full" />
          </div>
          <div className="space-y-2 pt-4">
            <Bone className="h-3 w-20" />
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-5/6" />
            <Bone className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  </div>
)

export const SkeletonInbox = () => (
  <div className="space-y-0">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="flex items-center gap-4 p-4"
        style={{ borderBottom: '1px solid rgba(200,120,80,0.1)' }}>
        <Bone className="w-14 h-14 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <Bone className="h-4 w-24" />
            <Bone className="h-3 w-10" />
          </div>
          <Bone className="h-3 w-32" />
          <Bone className="h-3 w-48" />
        </div>
      </div>
    ))}
  </div>
)

export default Bone
