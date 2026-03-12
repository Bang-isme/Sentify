# 1. Proposal Analysis

Date: 2026-03-02  
Updated: 2026-03-07 (Sprint 1 scope sync)

## 1.1 Project Overview

**Sentify** is an AI-assisted review insight tool for F&B SMBs.
The practical value is straightforward: owners already receive reviews on Google Maps, but they do not have time to read hundreds of comments manually, detect recurring complaints, and prioritize what to fix first.

Sentify turns raw reviews into operational signals:

- Which topics customers complain about most
- Whether sentiment is improving or getting worse
- Which restaurant needs attention first
- What action the owner should consider next

## 1.2 Sprint 1 Goal

Sprint 1 is not trying to build the full SaaS vision.
It is building the smallest usable loop:

`Login -> create/select restaurant -> import Google reviews -> save -> compute insights -> view dashboard`

If that loop works end to end, the product already delivers real value.

## 1.3 Sprint 1 Scope

### In scope

| Module | Features |
|--------|----------|
| Auth | Register, Login, Logout |
| Restaurant | Create restaurant, list/select restaurant, update `googleMapUrl` |
| Review Import | Scrape reviews from Google Maps URL, parse JSON, dedup by `externalId` |
| Dashboard | Review list, rating filter, date filter |
| Insights | Sentiment breakdown, complaint keywords, rating trend |

### Out of scope

- CSV upload
- Email verification / forgot password
- Invite member workflow
- Report generation / PDF export
- Embedding / clustering / RAG
- Subscription / payment
- Redis / BullMQ worker
- Organization-based multi-tenant model

## 1.4 Core Business Value

### Macro value

- Reduces manual review reading time
- Makes customer complaints measurable instead of anecdotal
- Gives SMB owners a simple data loop they can actually use
- Creates a foundation for future premium insight features

### Micro value

- Detect duplicate imports safely
- Store sentiment per review
- Show top complaint keywords after each import
- Let users filter reviews by rating and time
- Track whether average rating and sentiment change over time

## 1.5 Data Flow

```text
User saves Google Maps URL
-> Backend scrapes reviews
-> Reviews are normalized to JSON
-> Duplicate reviews are skipped by (restaurantId, externalId)
-> Sentiment is classified
-> Review rows are stored
-> InsightSummary and ComplaintKeyword are recalculated
-> Dashboard reads cached insight + raw reviews
```

## 1.6 Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01 | User can register with email, password, full name |
| FR-02 | User can login and receive JWT access token |
| FR-03 | User can logout by clearing the client session |
| FR-04 | User can create a restaurant and save `googleMapUrl` |
| FR-05 | User can list restaurants they belong to |
| FR-06 | Import skips duplicate reviews by `externalId` per restaurant |
| FR-07 | Each review stores rating, text, author, date, and sentiment |
| FR-08 | Dashboard shows total reviews, average rating, positive/neutral/negative percentages |
| FR-09 | Complaint keywords are recalculated from negative reviews |
| FR-10 | Rating trend can be queried by week or month |

## 1.7 Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Security | JWT access token with short expiry |
| NFR-02 | Security | Password hashing with bcrypt |
| NFR-03 | Security | Rate limit failed login attempts |
| NFR-04 | Data | Import must be idempotent by `(restaurantId, externalId)` |
| NFR-05 | Performance | Dashboard query should stay responsive on small SMB-scale data |
| NFR-06 | Maintainability | Business logic should stay separate from Express routing |

## 1.8 Delivery Risks

| Risk | Why it matters | Sprint 1 decision |
|------|----------------|-------------------|
| Google scraping instability | External source can break unexpectedly | Keep scraper behind service abstraction |
| Scope drift | Too many future features slow delivery | Lock to 6 tables and synchronous flow |
| Weak auth implementation | User data is sensitive | Hash passwords, validate JWT, scope every query by restaurant membership |
| Inconsistent docs | Dev gets lost between files | Use this Sprint 1 pack as source of truth |
