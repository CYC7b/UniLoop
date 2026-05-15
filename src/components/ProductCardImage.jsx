import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const ProductCardImage = ({ images, alt }) => {
  const [activeIdx, setActiveIdx] = useState(0)
  const multi = images.length > 1

  const goPrev = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveIdx(i => (i - 1 + images.length) % images.length)
  }

  const goNext = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveIdx(i => (i + 1) % images.length)
  }

  return (
    <div className="aspect-square w-full overflow-hidden bg-slate-100 relative">
      <img
        src={images[activeIdx]}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-500"
      />
      {multi && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity active:scale-90 z-10"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goNext}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity active:scale-90 z-10"
          >
            <ChevronRight size={16} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 pointer-events-none">
            {images.map((_, idx) => (
              <div
                key={idx}
                className={`w-1.5 h-1.5 rounded-full shadow-sm transition-all ${idx === activeIdx ? 'bg-white scale-125' : 'bg-black/30'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default ProductCardImage
