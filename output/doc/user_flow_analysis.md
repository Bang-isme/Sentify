# Sprint 1 User Flow Analysis

Updated: 2026-03-07

This file summarizes the user-flow thinking behind the Sprint 1 scope.
It is a companion note to `02-flow-diagram.md`, not a separate source of truth.

## 1. Core Product Loop

```text
Register/Login
-> Create or select restaurant
-> Save Google Maps URL
-> Import reviews
-> Generate sentiment + complaint keywords
-> View dashboard and filtered reviews
```

## 2. Main Actor

Sprint 1 is optimized for the restaurant owner.
`MANAGER` permission exists in the data model for future use, but the product loop is still designed around one primary operator who imports and reviews data.

## 3. Why This Flow Matters

### Macro level

- Gives the owner a complete path from zero setup to first insight
- Keeps onboarding short
- Avoids dead-end states caused by missing integrations or queues

### Micro level

- Restaurant must exist before import
- `googleMapUrl` must exist before scraping
- Duplicate reviews must be skipped safely
- Dashboard should refresh after import without manual recalculation by the user

## 4. Flow Dependencies

| Step | Depends on |
|------|------------|
| Register | none |
| Login | existing user |
| Create restaurant | authenticated user |
| Import reviews | restaurant membership + `googleMapUrl` |
| Dashboard view | imported review data or empty state |
| Complaint keywords | negative reviews and recalculation |

## 5. Sprint 1 Decisions

- No organization setup flow
- No CSV upload flow
- No forgot password flow
- No report generation flow
- No invitation/member management flow
- No async batch processing flow

## 6. Reference

Use `02-flow-diagram.md` as the canonical visual version.
