export interface AdminOpsLabels {
  shellEyebrow: string
  shellDescription: string
  navOverview: string
  navIntake: string
  navReviewOps: string
  navReviewCrawl: string
  overviewTitle: string
  overviewDescription: string
  reviewOpsTitle: string
  reviewOpsDescription: string
  syncCardTitle: string
  syncCardDescription: string
  syncUrlLabel: string
  syncStrategyLabel: string
  syncPriorityLabel: string
  syncMaxPagesLabel: string
  syncMaxReviewsLabel: string
  syncAction: string
  sourcesTitle: string
  sourcesDescription: string
  noSources: string
  latestRunLabel: string
  openDraftLabel: string
  overdueLabel: string
  queueHealthTitle: string
  runsTitle: string
  runsDescription: string
  noRuns: string
  runDetailTitle: string
  runDetailDescription: string
  noRunDetail: string
  enableAction: string
  disableAction: string
  approveAction: string
  publishAction: string
  readinessTitle: string
  readinessDescription: string
  blockingReasonsTitle: string
  diagnosticsTitle: string
  syncSuccess: string
  sourceEnabled: string
  sourceDisabled: string
  approveSuccess: string
  publishSuccess: string
  reviewCrawlTitle: string
  reviewCrawlDescription: string
  previewTitle: string
  previewDescription: string
  previewAction: string
  previewWarningsTitle: string
  sourceConfigTitle: string
  sourceConfigDescription: string
  sourceLanguageLabel: string
  sourceRegionLabel: string
  sourceSyncEnabledLabel: string
  sourceSyncIntervalLabel: string
  upsertSourceAction: string
  runControlTitle: string
  runControlDescription: string
  selectedSourceLabel: string
  runStrategyLabel: string
  runPriorityLabel: string
  runPageSizeLabel: string
  runDelayLabel: string
  createRunAction: string
  materializeAction: string
  cancelAction: string
  resumeAction: string
  refreshRunAction: string
  materializeSuccess: string
  previewSuccess: string
  sourceUpsertSuccess: string
  runCreateSuccess: string
  statuses: Record<string, string>
  priorities: Record<'HIGH' | 'NORMAL' | 'LOW', string>
  strategies: Record<'INCREMENTAL' | 'BACKFILL', string>
}

const englishLabels: AdminOpsLabels = {
  shellEyebrow: 'Admin control plane',
  shellDescription:
    'Operate review intake as three linked backend modules: curate canonical data, orchestrate syncs, and inspect crawl runtime.',
  navOverview: 'Restaurants',
  navIntake: 'Intake',
  navReviewOps: 'Review ops',
  navReviewCrawl: 'Crawl runtime',
  overviewTitle: 'Restaurants overview',
  overviewDescription:
    'Inspect each restaurant as an admin-owned operational context before opening intake, review ops, or crawl runtime.',
  reviewOpsTitle: 'Review operations',
  reviewOpsDescription:
    'Drive the production workflow from Google Maps URL to draft batch, then approve and publish with crawl diagnostics in view.',
  syncCardTitle: 'Sync Google Maps to draft',
  syncCardDescription:
    'This is the operator entrypoint. It upserts the crawl source, queues the run, and materializes or appends to a draft batch under manual publish policy.',
  syncUrlLabel: 'Google Maps URL',
  syncStrategyLabel: 'Sync strategy',
  syncPriorityLabel: 'Queue priority',
  syncMaxPagesLabel: 'Max pages',
  syncMaxReviewsLabel: 'Max reviews',
  syncAction: 'Sync to draft',
  sourcesTitle: 'Managed sources',
  sourcesDescription:
    'These are the backend-owned review crawl sources for the current restaurant. Select one to inspect scheduling and recent runs.',
  noSources: 'No review crawl source has been registered for this restaurant yet.',
  latestRunLabel: 'Latest run',
  openDraftLabel: 'Open draft',
  overdueLabel: 'Overdue',
  queueHealthTitle: 'Queue and worker health',
  runsTitle: 'Source runs',
  runsDescription:
    'Review recent runs to see whether the queue is healthy, resumable, or ready to materialize into intake.',
  noRuns: 'No runs have been recorded for the selected source yet.',
  runDetailTitle: 'Run detail',
  runDetailDescription:
    'Run detail combines crawl status, queue job state, coverage diagnostics, and the draft batch reference for the selected run.',
  noRunDetail: 'Select a run to inspect its crawl detail and draft readiness.',
  enableAction: 'Enable source',
  disableAction: 'Disable source',
  approveAction: 'Approve valid items',
  publishAction: 'Publish draft batch',
  readinessTitle: 'Draft batch readiness',
  readinessDescription:
    'Use this card to see whether the current draft batch can publish and which validation issues are still blocking it.',
  blockingReasonsTitle: 'Blocking reasons',
  diagnosticsTitle: 'Crawl diagnostics',
  syncSuccess: 'Sync request accepted and draft orchestration refreshed.',
  sourceEnabled: 'Source enabled.',
  sourceDisabled: 'Source disabled.',
  approveSuccess: 'Valid draft items approved.',
  publishSuccess: 'Draft batch published into canonical reviews.',
  reviewCrawlTitle: 'Crawl runtime controls',
  reviewCrawlDescription:
    'Use the low-level crawl endpoints to preview extraction, configure a source, enqueue runs, and materialize a run into draft intake.',
  previewTitle: 'Preview extraction',
  previewDescription:
    'Preview runs the Google Maps crawler without creating a persisted run so you can inspect extraction quality before queueing.',
  previewAction: 'Preview crawl',
  previewWarningsTitle: 'Preview warnings',
  sourceConfigTitle: 'Source configuration',
  sourceConfigDescription:
    'Persist the crawl source for this restaurant, including locale and sync scheduling policy.',
  sourceLanguageLabel: 'Language',
  sourceRegionLabel: 'Region',
  sourceSyncEnabledLabel: 'Enable scheduled sync',
  sourceSyncIntervalLabel: 'Sync interval (minutes)',
  upsertSourceAction: 'Save crawl source',
  runControlTitle: 'Run controls',
  runControlDescription:
    'Queue a new run for the selected source, then inspect, cancel, resume, or materialize the selected run.',
  selectedSourceLabel: 'Selected source',
  runStrategyLabel: 'Run strategy',
  runPriorityLabel: 'Run priority',
  runPageSizeLabel: 'Page size',
  runDelayLabel: 'Delay (ms)',
  createRunAction: 'Create crawl run',
  materializeAction: 'Materialize to draft',
  cancelAction: 'Cancel run',
  resumeAction: 'Resume run',
  refreshRunAction: 'Refresh run',
  materializeSuccess: 'Run materialized into a draft intake batch.',
  previewSuccess: 'Preview completed. Inspect the warnings and extracted review sample below.',
  sourceUpsertSuccess: 'Crawl source saved.',
  runCreateSuccess: 'Crawl run queued.',
  statuses: {
    ACTIVE: 'Active',
    DISABLED: 'Disabled',
    QUEUED: 'Queued',
    RUNNING: 'Running',
    PARTIAL: 'Partial',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
    DRAFT: 'Draft',
    IN_REVIEW: 'In review',
    READY_TO_PUBLISH: 'Ready to publish',
    PUBLISHED: 'Published',
    ARCHIVED: 'Archived',
  },
  priorities: {
    HIGH: 'High',
    NORMAL: 'Normal',
    LOW: 'Low',
  },
  strategies: {
    INCREMENTAL: 'Incremental',
    BACKFILL: 'Backfill',
  },
}

export function getAdminOpsLabels(_language: string): AdminOpsLabels {
  return englishLabels
}
