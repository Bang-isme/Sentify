import type { ReactNode } from 'react'

import type {
  ComplaintKeyword,
  RestaurantDetail,
  RestaurantMembership,
  ReviewItem,
  ReviewListResponse,
  ReviewsQuery,
  SentimentBreakdownRow,
  TrendPoint,
} from '../../lib/api'

export type MerchantHubRoute = 'home' | 'reviews' | 'actions' | 'settings'
export type MerchantHubState = 'now' | 'next'
export type MerchantHubPriority = 'high' | 'medium' | 'low'

export interface MerchantHubAccount {
  displayName: string
  email: string
  initials: string
  restaurantCount: number
  roleLabel: string
}

export interface MerchantHubShellContext {
  restaurants: RestaurantMembership[]
  currentRestaurant: RestaurantMembership | null
  currentRestaurantDetail: RestaurantDetail | null
  account: MerchantHubAccount
  roleLabel: string
  subtitle: string
  onSelectRestaurant: (restaurantId: string) => void
  onNavigate: (route: MerchantHubRoute) => void
  onLogout?: () => void
  children: ReactNode
}

export interface MerchantHubKpiCard {
  label: string
  value: string
  hint: string
  tone?: MerchantHubState
}

export interface MerchantHubHomeHighlight {
  title: string
  description: string
  evidence: string
  status: MerchantHubState
  priority?: MerchantHubPriority
}

export interface MerchantHubEvidenceItem
  extends Pick<ReviewItem, 'id' | 'rating' | 'content' | 'sentiment'> {
  authorName: string
  reviewDateLabel: string
}

export interface MerchantHubHomeScreenProps {
  language: string
  restaurant: RestaurantMembership | null
  detail: RestaurantDetail | null
  freshnessLabel: string
  freshnessStatus: MerchantHubState
  kpis: MerchantHubKpiCard[]
  sentiment: SentimentBreakdownRow[]
  complaintKeywords: ComplaintKeyword[]
  trend: TrendPoint[]
  highlight: MerchantHubHomeHighlight | null
  recentEvidence: MerchantHubEvidenceItem[]
  onNavigateToReviews: () => void
  onNavigateToActions: () => void
  onNavigateToSettings: () => void
}

export interface MerchantHubReviewFilterChip {
  label: string
  value: string
  status: MerchantHubState
}

export interface MerchantHubReviewsScreenProps {
  language: string
  restaurant: RestaurantMembership | null
  detail: RestaurantDetail | null
  query: ReviewsQuery
  reviewCount: number
  filters: MerchantHubReviewFilterChip[]
  reviews: ReviewListResponse | null
  searchLabel: string
  searchHint: string
  searchStatus: MerchantHubState
  onNavigateToActions: () => void
  onNavigateToSettings: () => void
}

export interface MerchantHubActionCard {
  title: string
  summary: string
  evidence: string
  nextStep: string
  status: MerchantHubState
  priority: MerchantHubPriority
}

export interface MerchantHubActionsScreenProps {
  language: string
  restaurant: RestaurantMembership | null
  detail: RestaurantDetail | null
  topIssue: string
  actionCards: MerchantHubActionCard[]
  nowSummary: string
  nextSummary: string
  onNavigateToReviews: () => void
  onNavigateToSettings: () => void
}

export interface MerchantHubSettingsBlock {
  title: string
  description: string
  status: MerchantHubState
  items: Array<{
    label: string
    value: string
  }>
}

export interface MerchantHubSettingsScreenProps {
  language: string
  restaurant: RestaurantMembership | null
  detail: RestaurantDetail | null
  pending: boolean
  profileBlock: MerchantHubSettingsBlock
  sourceBlock: MerchantHubSettingsBlock
  accessBlock: MerchantHubSettingsBlock
  nextBlock: MerchantHubSettingsBlock
  restaurantNameLabel: string
  restaurantAddressLabel: string
  googleMapsUrlLabel: string
  googleMapsUrlPlaceholder: string
  saveLabel: string
  savingLabel: string
  validation: {
    restaurantNameRequired: string
    restaurantNameTooLong: string
    restaurantAddressTooLong: string
    googleMapsUrlInvalid: string
    googleMapsUrlMustBeGoogle: string
  }
  onSaveProfile: (input: { name: string; address: string | null }) => Promise<void>
  onSaveSource: (input: { googleMapUrl: string | null }) => Promise<void>
  onNavigateToReviews: () => void
  onNavigateToActions: () => void
}
