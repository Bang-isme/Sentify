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

const vietnameseLabels: AdminOpsLabels = {
  shellEyebrow: 'Điều hành quản trị',
  shellDescription:
    'Điều hành luồng đánh giá theo ba mô-đun backend liên kết: nhập liệu chuẩn, đồng bộ nguồn, và theo dõi thu thập.',
  navOverview: 'Nhà hàng',
  navIntake: 'Nhập liệu',
  navReviewOps: 'Đồng bộ đánh giá',
  navReviewCrawl: 'Thu thập đánh giá',
  overviewTitle: 'Tổng quan nhà hàng',
  overviewDescription:
    'Tìm nhà hàng, xem mức sẵn sàng, rồi đi vào màn vận hành phù hợp cho từng nhà hàng.',
  reviewOpsTitle: 'Đồng bộ đánh giá',
  reviewOpsDescription:
    'Đi từ URL Google Maps đến draft, duyệt mục hợp lệ và công bố khi đã đủ điều kiện.',
  syncCardTitle: 'Đồng bộ Google Maps vào draft',
  syncCardDescription:
    'Đây là điểm vào chính của người vận hành: cập nhật source, xếp hàng run và đưa kết quả vào draft để duyệt.',
  syncUrlLabel: 'URL Google Maps',
  syncStrategyLabel: 'Chiến lược đồng bộ',
  syncPriorityLabel: 'Độ ưu tiên hàng đợi',
  syncMaxPagesLabel: 'Số trang tối đa',
  syncMaxReviewsLabel: 'Số đánh giá tối đa',
  syncAction: 'Đồng bộ vào draft',
  sourcesTitle: 'Nguồn đang quản lý',
  sourcesDescription:
    'Danh sách nguồn crawl do backend quản lý cho nhà hàng đang chọn. Chọn một nguồn để xem lịch và các lần chạy gần đây.',
  noSources: 'Nhà hàng này chưa có nguồn crawl nào được đăng ký.',
  latestRunLabel: 'Lần chạy gần nhất',
  openDraftLabel: 'Draft đang mở',
  overdueLabel: 'Quá hạn đồng bộ',
  queueHealthTitle: 'Tình trạng hàng đợi và worker',
  runsTitle: 'Các lần chạy của nguồn',
  runsDescription:
    'Xem các lần chạy gần đây để biết hàng đợi có khỏe không, có thể tiếp tục không, và đã sẵn sàng đổ vào intake chưa.',
  noRuns: 'Nguồn đang chọn chưa có lần chạy nào.',
  runDetailTitle: 'Chi tiết lần chạy',
  runDetailDescription:
    'Chi tiết run gồm trạng thái crawl, trạng thái job trong queue, chuẩn đoán coverage và liên kết đến draft batch.',
  noRunDetail: 'Chọn một lần chạy để xem chi tiết và mức sẵn sàng của draft.',
  enableAction: 'Bật nguồn',
  disableAction: 'Tắt nguồn',
  approveAction: 'Duyệt mục hợp lệ',
  publishAction: 'Công bố batch draft',
  readinessTitle: 'Mức sẵn sàng để công bố',
  readinessDescription:
    'Thẻ này cho biết batch draft hiện tại đã công bố được chưa và còn bị chặn bởi lỗi kiểm tra nào.',
  blockingReasonsTitle: 'Lý do đang bị chặn',
  diagnosticsTitle: 'Chuẩn đoán crawl',
  syncSuccess: 'Đã nhận yêu cầu đồng bộ và làm mới luồng draft.',
  sourceEnabled: 'Đã bật nguồn.',
  sourceDisabled: 'Đã tắt nguồn.',
  approveSuccess: 'Đã duyệt các mục hợp lệ trong draft.',
  publishSuccess: 'Đã công bố batch draft vào tập đánh giá chuẩn.',
  reviewCrawlTitle: 'Điều khiển thu thập đánh giá',
  reviewCrawlDescription:
    'Dùng các endpoint crawl mức thấp để xem trước dữ liệu, cấu hình source, xếp run và đổ kết quả vào draft intake.',
  previewTitle: 'Xem trước kết quả thu thập',
  previewDescription:
    'Chạy crawler Google Maps mà không tạo run lưu trữ để kiểm tra nhanh chất lượng trích xuất trước khi xếp hàng thật.',
  previewAction: 'Xem trước crawl',
  previewWarningsTitle: 'Cảnh báo từ bản xem trước',
  sourceConfigTitle: 'Cấu hình nguồn',
  sourceConfigDescription:
    'Lưu source crawl cho nhà hàng này, bao gồm locale và chính sách đồng bộ định kỳ.',
  sourceLanguageLabel: 'Ngôn ngữ',
  sourceRegionLabel: 'Khu vực',
  sourceSyncEnabledLabel: 'Bật đồng bộ định kỳ',
  sourceSyncIntervalLabel: 'Chu kỳ đồng bộ (phút)',
  upsertSourceAction: 'Lưu nguồn crawl',
  runControlTitle: 'Điều khiển lần chạy',
  runControlDescription:
    'Xếp một lần chạy mới cho nguồn đang chọn, sau đó xem, hủy, tiếp tục hoặc đổ kết quả vào draft.',
  selectedSourceLabel: 'Nguồn đang chọn',
  runStrategyLabel: 'Chiến lược chạy',
  runPriorityLabel: 'Độ ưu tiên',
  runPageSizeLabel: 'Kích thước trang',
  runDelayLabel: 'Độ trễ (ms)',
  createRunAction: 'Tạo lần chạy',
  materializeAction: 'Đưa vào draft',
  cancelAction: 'Hủy chạy',
  resumeAction: 'Tiếp tục chạy',
  refreshRunAction: 'Làm mới run',
  materializeSuccess: 'Đã đưa lần chạy vào draft intake.',
  previewSuccess: 'Đã chạy bản xem trước. Kiểm tra cảnh báo và mẫu đánh giá trích xuất bên dưới.',
  sourceUpsertSuccess: 'Đã lưu nguồn crawl.',
  runCreateSuccess: 'Đã xếp hàng lần chạy crawl.',
  statuses: {
    ACTIVE: 'Đang hoạt động',
    DISABLED: 'Đã tắt',
    QUEUED: 'Đang chờ',
    RUNNING: 'Đang chạy',
    PARTIAL: 'Chưa hoàn tất',
    COMPLETED: 'Hoàn tất',
    FAILED: 'Thất bại',
    CANCELLED: 'Đã hủy',
    DRAFT: 'Bản nháp',
    IN_REVIEW: 'Đang duyệt',
    READY_TO_PUBLISH: 'Sẵn sàng công bố',
    PUBLISHED: 'Đã công bố',
    ARCHIVED: 'Lưu trữ',
  },
  priorities: {
    HIGH: 'Cao',
    NORMAL: 'Bình thường',
    LOW: 'Thấp',
  },
  strategies: {
    INCREMENTAL: 'Tăng dần',
    BACKFILL: 'Bù lịch sử',
  },
}

export function getAdminOpsLabels(language: string): AdminOpsLabels {
  return language.startsWith('vi') ? vietnameseLabels : englishLabels
}
