import { memo } from 'react'

const reviewIllustration = {
  src: '/images/review-feed-illustration.png',
  alt: 'Bảng tổng hợp review đa kênh cho nhà hàng',
}

export const AsciiGlobe = memo(function AsciiGlobe() {
  return (
    <div className="hero-globe-pane review-feed-shell" aria-hidden>
      <div className="hero-globe-viewport">
        <div className="review-mosaic">
          <div className="review-mosaic-surface review-mosaic-surface--image">
            <figure className="review-illustration review-illustration--single">
              <img
                src={reviewIllustration.src}
                alt={reviewIllustration.alt}
                loading="lazy"
                decoding="async"
              />
            </figure>
          </div>
        </div>
      </div>
    </div>
  )
})
