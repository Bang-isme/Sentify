import { memo } from 'react'

const reviewCards = [
  {
    platform: 'Google Maps',
    rating: '4.6',
    text: 'Queue time improved after the weekend staffing change.',
    tone: 'positive',
    badge: 'GM',
    reviewer: 'Mia Chen',
    avatar: 'MC',
    avatarColor: '#f5d38a',
    logoColor: '#34a853',
  },
  {
    platform: 'GrabFood',
    rating: '4.3',
    text: 'Packaging is finally secure, no spills this week.',
    tone: 'positive',
    badge: 'GF',
    reviewer: 'Linh Tran',
    avatar: 'LT',
    avatarColor: '#f1c3d1',
    logoColor: '#00b14f',
  },
  {
    platform: 'Facebook',
    rating: '3.9',
    text: 'Lunch service still feels slow on peak days.',
    tone: 'neutral',
    badge: 'FB',
    reviewer: 'Quang Do',
    avatar: 'QD',
    avatarColor: '#b7d4ff',
    logoColor: '#1877f2',
  },
  {
    platform: 'Tripadvisor',
    rating: '4.1',
    text: 'Staff tone is better, but waiting times repeat.',
    tone: 'neutral',
    badge: 'TA',
    reviewer: 'Sora Kim',
    avatar: 'SK',
    avatarColor: '#c6f0d5',
    logoColor: '#00af87',
  },
  {
    platform: 'ShopeeFood',
    rating: '4.4',
    text: 'Delivery handoff is smoother and faster now.',
    tone: 'positive',
    badge: 'SF',
    reviewer: 'Anh Vu',
    avatar: 'AV',
    avatarColor: '#ffd7b5',
    logoColor: '#fb5533',
  },
  {
    platform: 'Yelp',
    rating: '3.7',
    text: 'Guests still mention seating delays at night.',
    tone: 'negative',
    badge: 'YP',
    reviewer: 'Nora Lee',
    avatar: 'NL',
    avatarColor: '#f6c5c1',
    logoColor: '#d32323',
  },
  {
    platform: 'Google Maps',
    rating: '4.2',
    text: 'Menu refresh helped, ratings are trending up.',
    tone: 'positive',
    badge: 'GM',
    reviewer: 'Aria Patel',
    avatar: 'AP',
    avatarColor: '#f2e0b5',
    logoColor: '#34a853',
  },
  {
    platform: 'TikTok',
    rating: '4.0',
    text: 'Short clips praise the plating, but noise persists.',
    tone: 'neutral',
    badge: 'TT',
    reviewer: 'Duy Pham',
    avatar: 'DP',
    avatarColor: '#d7d9ff',
    logoColor: '#111111',
  },
  {
    platform: 'Zalo',
    rating: '4.1',
    text: 'Takeaway accuracy is stronger than last month.',
    tone: 'positive',
    badge: 'ZL',
    reviewer: 'Mai Ho',
    avatar: 'MH',
    avatarColor: '#cde7ff',
    logoColor: '#0068ff',
  },
]

export const AsciiGlobe = memo(function AsciiGlobe() {
  return (
    <div className="hero-globe-pane review-feed-shell" aria-hidden>
      <div className="hero-globe-viewport">
        <div className="review-mosaic">
          <div className="review-mosaic-surface">
            <div className="review-mosaic-header">
              <div className="review-mosaic-pill">Unified review feed</div>
              <div className="review-mosaic-meta">6 sources / 1 view</div>
            </div>
            <div className="review-mosaic-grid">
              {reviewCards.map((card) => (
                <ReviewCard key={`${card.platform}-${card.text}`} {...card} />
              ))}
            </div>
            <div className="review-mosaic-footer">
              <span>Google Maps</span>
              <span>Facebook</span>
              <span>GrabFood</span>
              <span>Yelp</span>
              <span>Tripadvisor</span>
              <span>ShopeeFood</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

function ReviewCard({
  platform,
  rating,
  text,
  tone,
  badge,
  reviewer,
  avatar,
  avatarColor,
  logoColor,
}: {
  platform: string
  rating: string
  text: string
  tone: 'positive' | 'neutral' | 'negative'
  badge: string
  reviewer: string
  avatar: string
  avatarColor: string
  logoColor: string
}) {
  return (
    <div className={`review-card review-card-${tone}`}>
      <div className="review-card-header">
        <div className="review-card-identity">
          <div className="review-avatar" style={{ backgroundColor: avatarColor }}>
            {avatar}
          </div>
          <div className="reviewer-name">{reviewer}</div>
        </div>
        <div className="review-rating">
          <span className="material-symbols-outlined">star</span>
          <span>{rating}</span>
        </div>
      </div>
      <div className="review-platform-row">
        <span className="review-platform-logo" style={{ backgroundColor: logoColor }}>
          {badge}
        </span>
        <span className="review-source-name">{platform}</span>
      </div>
      <p className="review-card-text">{text}</p>
      <div className="review-card-chip">
        {tone === 'positive'
          ? 'Positive shift'
          : tone === 'negative'
            ? 'Recurring issue'
            : 'Watchlist'}
      </div>
    </div>
  )
}

