# Review Crawler Scale Validation

Updated: 2026-03-25

This document exists to make scale claims about the crawler concrete instead of vague.

## What We Can Prove Today

The backend can already prove:

- queue-based deep crawl runs outside the request path
- page-by-page persistence avoids holding whole crawls in memory
- checkpoint and auto-resume logic can continue backfills across multiple legs
- repeated live-source benchmarks converge to stable extracted-review ceilings on the same place

## What We Still Cannot Prove

The backend still cannot prove:

- exact completeness on a live source with around `20,000` public reviews
- multi-source SMB concurrency under real Redis worker pressure
- that preview metadata totals always equal the public review surface

## Validation Checklist

Use the scale-validation harness before making larger-scale claims:

1. Run repeated direct full crawls on the same live source.
2. Run at least one queued backfill on the same live source.
3. Confirm direct and queued extracted counts converge to the same ceiling.
4. Record `reportedTotal`, `extractedCount`, `pagesFetched`, and duration.
5. Estimate target pages and backfill legs for the target source size.
6. Treat any `reportedTotal > extractedCount` mismatch as an operator-facing warning.

## Harness

Use:

```bash
npm run validate:review-crawl-scale -- --url="https://maps.app.goo.gl/..." --target-reviews=20000 --output="./crawls/scale-validation.json"
```

The harness will:

- run repeated direct full crawls with `delayMs=0`
- run queued backfill validation using the smoke harness
- summarize throughput
- estimate runtime and backfill-leg count for the requested target review count
- state clearly that target-scale completeness is still unproven unless a comparable live source is tested

## Interpretation Rules

- If direct and queued runs converge to the same extracted count, treat that as a strong signal of the current public review ceiling for that source.
- If `reportedTotal` is higher than the converged extracted count, do not label the result as a missing-data bug without further evidence.
- If estimated backfill legs stay within the configured auto-resume budget, the runtime can likely handle the source operationally.
- If completeness at the target source size matters, benchmark a comparable live source instead of extrapolating from a much smaller one.

## Current Position

Today the crawler is runtime-capable enough to estimate whether a `20K review` source fits the current backfill leg budget.

It is not yet honest to say "20K completeness is proven" until we benchmark a comparable live source and observe the same public review surface behavior there.

## Current Validation Snapshots

Reports:

- [scale-validation-quan-pho-hong.json](D:/Project%203/backend-sentify/crawls/scale-validation-quan-pho-hong.json)
- [scale-validation-kaFYtSNsriybyw6w7.json](D:/Project%203/backend-sentify/crawls/scale-validation-kaFYtSNsriybyw6w7.json)
- [scale-validation-Uv2s78xsAD6DUsrL8.json](D:/Project%203/backend-sentify/crawls/scale-validation-Uv2s78xsAD6DUsrL8.json)

### Quan Pho Hong

- direct runs converged at `4527`
- queued runs converged at `4527`
- direct throughput: about `134.58 reviews/s`
- queued throughput: about `86.84 reviews/s`
- estimated `20K` runtime:
  - direct: about `148.6s`
  - queued: about `230.3s`
- estimated backfill legs for `20K`: `5`

### Cong Ca Phe

- preview metadata reported `15098`
- direct and queued runs both converged at `9744`
- the public Google Maps place card shown by the user also showed `9744`
- direct throughput: about `153.05 reviews/s`
- queued throughput: about `104.84 reviews/s`
- estimated `20K` runtime:
  - direct: about `130.7s`
  - queued: about `190.8s`
- estimated backfill legs for `20K` with `1000 pages/run`: `2`

### Pizza 4P's Hoang Van Thu

- preview metadata reported `17646`
- direct and queued runs both converged at `14599`
- direct throughput: about `122.54 reviews/s`
- queued throughput: about `100.17 reviews/s`
- estimated `20K` runtime:
  - direct: about `163.2s`
  - queued: about `199.7s`
- estimated backfill legs for `20K` with `1000 pages/run`: `2`

## What We Learned

The `Cong Ca Phe` case is especially important because it shows a practical distinction between:

- preview metadata totals
- the public review surface the crawler can actually exhaust

For operator policy, the crawler should be considered correct when it repeatedly converges to the public review surface, even if preview metadata still reports a larger number.

The `Pizza 4P's Hoang Van Thu` benchmark strengthens that policy again:

- it is a larger source than `Cong Ca Phe`
- direct and queued modes still converged to the same extracted-review ceiling
- runtime for a `20K`-scale source still fits the current `1000 pages/run` budget in about `2` backfill legs
