import React from 'react'

const Logo = ({ className = '', size = 'md' }) => {
  const textSize = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-lg' : 'text-2xl'
  return (
    <div className={`flex flex-col items-start select-none ${className}`}>
      <span className={`font-serif font-bold tracking-tight leading-none text-uniloop-800 ${textSize}`}>
        Uni<span className="text-uniloop-500">Loop</span>
      </span>
    </div>
  )
}

export default Logo
