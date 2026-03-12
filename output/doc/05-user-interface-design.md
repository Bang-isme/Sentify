# 5. User Interface Design - Sprint 1

Date: 2026-03-02  
Updated: 2026-03-07 (Sprint 1 scope sync)

## 5.1 Design Direction

Sprint 1 UI should feel practical, not overloaded.
The product is for restaurant owners who want answers fast, so the interface should prioritize clarity over feature density.

Visual direction:

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#0F766E` | Main actions, active states |
| Accent | `#F59E0B` | Import CTA, warnings |
| Positive | `#10B981` | Positive sentiment |
| Neutral | `#64748B` | Neutral sentiment |
| Negative | `#DC2626` | Negative sentiment |
| Background | `#F5F5F4` | App background |
| Surface | `#FFFFFF` | Cards and panels |
| Text | `#1E293B` | Primary text |

Typography:

- Font: `Inter`
- KPI numbers: bold and large
- Body text: 14px to 16px range

## 5.2 Information Architecture

Primary navigation:

| Tab | Purpose |
|-----|---------|
| Dashboard | KPI cards, sentiment, trend, complaint keywords |
| Reviews | Review list and filters |
| Insights | Complaint keywords + sentiment detail |
| Settings | Restaurant profile and Google Maps URL |

Global controls:

| Control | Why it exists |
|---------|---------------|
| Restaurant switcher | User can belong to multiple restaurants |
| Import button | Trigger Google review import quickly |
| Date filter | Re-scope dashboard and review list |
| Account menu | Logout and profile |

## 5.3 Screen Inventory

### Screen A: Auth

Components:
- Email input
- Password input
- Full name input on register
- Error feedback for invalid credentials
- Link between Login and Register

### Screen B: Restaurant Setup / Picker

Components:
- Create restaurant form
- Restaurant list for existing memberships
- `googleMapUrl` input
- Continue to dashboard CTA

### Screen C: Dashboard

Components:

| Component | Description |
|-----------|-------------|
| KPI cards | Total reviews, average rating, positive %, negative % |
| Sentiment chart | Positive / neutral / negative breakdown |
| Trend chart | Rating trend by week or month |
| Complaint keyword list | Keyword + count + percentage |
| Quick action | Import reviews |

### Screen D: Reviews

Components:

| Component | Description |
|-----------|-------------|
| Review table | Rating, author, date, content, sentiment |
| Rating filter | 1 to 5 stars or all |
| Date filter | From / to date |
| Empty state | No reviews imported yet |

### Screen E: Settings

Components:
- Restaurant name
- Address
- Google Maps URL
- Save changes button

## 5.4 UI States

### Empty states

| Screen | Message |
|--------|---------|
| Dashboard | No reviews imported yet. Import reviews to generate insights. |
| Reviews | No reviews found for this restaurant. |
| Insights | Complaint keywords appear after negative reviews are imported. |

### Loading states

- Skeleton KPI cards
- Skeleton chart area
- Skeleton table rows

### Error states

| Scenario | Treatment |
|----------|-----------|
| Invalid login | Inline message + keep form values |
| Import failed | Toast or alert with retry hint |
| Missing `googleMapUrl` | Inline warning in Settings or import modal |
| Forbidden | Redirect or show access denied message |

### Success states

| Action | Feedback |
|--------|----------|
| Login success | Redirect to restaurant picker or dashboard |
| Restaurant created | Toast + navigate to dashboard |
| Import success | Show imported/skipped counts |
| Settings saved | Toast confirmation |

## 5.5 Interaction Rules

- Import button should be visible on dashboard and reviews screen
- Dashboard should read cached summary data, not recompute in UI
- Filters should update list state without navigating away
- Restaurant switch should reset page data to the selected restaurant context
- Logout should clear client token and return to login page

## 5.6 Mobile Notes

- KPI cards stack vertically
- Charts collapse into single-column layout
- Review table becomes card list on small screens
- Top navigation can collapse into menu or segmented control
