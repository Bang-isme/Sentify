export interface AdminIntakeLabels {
  nav: string
  title: string
  description: string
  createBatchTitle: string
  createBatchDescription: string
  batchTitleLabel: string
  batchSourceLabel: string
  batchCreateAction: string
  inboxTitle: string
  inboxDescription: string
  emptyBatches: string
  quickEntryTitle: string
  quickEntryDescription: string
  bulkPasteLabel: string
  bulkPasteHint: string
  authorLabel: string
  ratingLabel: string
  dateLabel: string
  contentLabel: string
  addSingleAction: string
  addBulkAction: string
  reviewQueueTitle: string
  reviewQueueDescription: string
  publishTitle: string
  publishDescription: string
  publishAction: string
  publishSuccess: string
  publishReady: string
  publishBlocked: string
  statuses: Record<'DRAFT' | 'IN_REVIEW' | 'READY_TO_PUBLISH' | 'PUBLISHED' | 'ARCHIVED', string>
  sourceTypes: Record<'MANUAL' | 'BULK_PASTE' | 'CSV', string>
  approvalStatuses: Record<'PENDING' | 'APPROVED' | 'REJECTED', string>
}

const labels = {
  en: {
    nav: 'Admin intake',
    title: 'Admin review intake',
    description:
      'Capture feedback manually, review it with context, and publish only the evidence that should enter the canonical dataset.',
    createBatchTitle: 'Create intake batch',
    createBatchDescription:
      'Start with a small batch so the review and publish loop stays fast and auditable.',
    batchTitleLabel: 'Batch title',
    batchSourceLabel: 'Source type',
    batchCreateAction: 'Create batch',
    inboxTitle: 'Batch inbox',
    inboxDescription: 'Select a batch, review pending items, and move it toward publish.',
    emptyBatches: 'No intake batches yet. Create one to start curating data.',
    quickEntryTitle: 'Add reviews',
    quickEntryDescription:
      'Use single entry for precise capture and bulk paste when admin has already cleaned raw notes.',
    bulkPasteLabel: 'Bulk paste',
    bulkPasteHint:
      'One line per review. Supported formats: `5 | Great service` or `5 | Alex | 2026-03-12 | Great service`.',
    authorLabel: 'Author',
    ratingLabel: 'Rating',
    dateLabel: 'Date',
    contentLabel: 'Content',
    addSingleAction: 'Add review',
    addBulkAction: 'Parse and add lines',
    reviewQueueTitle: 'Review queue',
    reviewQueueDescription:
      'Normalize text, confirm metadata, and approve only what should affect merchant insight.',
    publishTitle: 'Publish batch',
    publishDescription:
      'Publishing writes approved items into canonical reviews and recalculates insight summaries.',
    publishAction: 'Publish approved items',
    publishSuccess: 'Batch published to the canonical dataset.',
    publishReady: 'This batch has approved items and is ready to publish.',
    publishBlocked: 'Approve at least one item before publishing.',
    statuses: {
      DRAFT: 'Draft',
      IN_REVIEW: 'In review',
      READY_TO_PUBLISH: 'Ready to publish',
      PUBLISHED: 'Published',
      ARCHIVED: 'Archived',
    },
    sourceTypes: {
      MANUAL: 'Manual',
      BULK_PASTE: 'Bulk paste',
      CSV: 'CSV',
    },
    approvalStatuses: {
      PENDING: 'Pending',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
    },
  },
  vi: {
    nav: 'Nhập liệu admin',
    title: 'Khu nhập review cho admin',
    description:
      'Nhập feedback thủ công, duyệt lại theo ngữ cảnh, rồi chỉ publish những dữ liệu đủ tin cậy vào dataset chính.',
    createBatchTitle: 'Tạo batch nhập liệu',
    createBatchDescription:
      'Nên bắt đầu bằng batch nhỏ để vòng duyệt và publish nhanh, dễ kiểm soát.',
    batchTitleLabel: 'Tên batch',
    batchSourceLabel: 'Loại nguồn',
    batchCreateAction: 'Tạo batch',
    inboxTitle: 'Hộp batch',
    inboxDescription: 'Chọn batch, duyệt item đang chờ, rồi đẩy nó tới trạng thái publish.',
    emptyBatches: 'Chưa có batch nhập liệu nào. Hãy tạo một batch để bắt đầu curate dữ liệu.',
    quickEntryTitle: 'Thêm review',
    quickEntryDescription:
      'Dùng nhập từng review khi cần chính xác cao. Dùng bulk paste khi admin đã làm sạch ghi chú thô.',
    bulkPasteLabel: 'Bulk paste',
    bulkPasteHint:
      'Mỗi dòng là một review. Hỗ trợ `5 | Quá tốt` hoặc `5 | Alex | 2026-03-12 | Quá tốt`.',
    authorLabel: 'Tác giả',
    ratingLabel: 'Điểm',
    dateLabel: 'Ngày',
    contentLabel: 'Nội dung',
    addSingleAction: 'Thêm review',
    addBulkAction: 'Tách và thêm các dòng',
    reviewQueueTitle: 'Hàng duyệt',
    reviewQueueDescription:
      'Chuẩn hóa text, kiểm tra metadata, và chỉ approve những gì nên đi vào insight của merchant.',
    publishTitle: 'Publish batch',
    publishDescription:
      'Publish sẽ ghi các item được approve vào bảng review chính và tính lại insight summary.',
    publishAction: 'Publish item đã duyệt',
    publishSuccess: 'Batch đã được publish vào dataset chính.',
    publishReady: 'Batch này đã có item được approve và sẵn sàng publish.',
    publishBlocked: 'Cần approve ít nhất một item trước khi publish.',
    statuses: {
      DRAFT: 'Nháp',
      IN_REVIEW: 'Đang duyệt',
      READY_TO_PUBLISH: 'Sẵn sàng publish',
      PUBLISHED: 'Đã publish',
      ARCHIVED: 'Lưu trữ',
    },
    sourceTypes: {
      MANUAL: 'Nhập tay',
      BULK_PASTE: 'Dán nhiều dòng',
      CSV: 'CSV',
    },
    approvalStatuses: {
      PENDING: 'Chờ duyệt',
      APPROVED: 'Đã duyệt',
      REJECTED: 'Loại bỏ',
    },
  },
  ja: {
    nav: '管理入力',
    title: '管理者レビュー入力',
    description:
      'フィードバックを手動で取り込み、文脈付きで確認し、信頼できるデータだけを正規データセットへ公開します。',
    createBatchTitle: '入力バッチを作成',
    createBatchDescription:
      'まずは小さなバッチから始めると、レビューと公開のループを速く保てます。',
    batchTitleLabel: 'バッチ名',
    batchSourceLabel: 'ソース種別',
    batchCreateAction: 'バッチを作成',
    inboxTitle: 'バッチ一覧',
    inboxDescription: 'バッチを選び、保留中の項目を確認し、公開可能な状態へ進めます。',
    emptyBatches: 'まだ入力バッチがありません。新しいバッチを作成してキュレーションを始めてください。',
    quickEntryTitle: 'レビューを追加',
    quickEntryDescription:
      '精度重視なら単体入力、すでに管理側で整理されたメモがあるなら一括貼り付けを使います。',
    bulkPasteLabel: '一括貼り付け',
    bulkPasteHint:
      '1行につき1レビュー。`5 | Great service` または `5 | Alex | 2026-03-12 | Great service` をサポートします。',
    authorLabel: '投稿者',
    ratingLabel: '評価',
    dateLabel: '日付',
    contentLabel: '内容',
    addSingleAction: 'レビューを追加',
    addBulkAction: '行を解析して追加',
    reviewQueueTitle: 'レビュー待ち行列',
    reviewQueueDescription:
      'テキストを正規化し、メタデータを確認し、インサイトへ反映すべきものだけを承認します。',
    publishTitle: 'バッチを公開',
    publishDescription:
      '公開すると承認済み項目が正規レビューへ書き込まれ、インサイト集計が再計算されます。',
    publishAction: '承認済み項目を公開',
    publishSuccess: 'バッチを正規データセットへ公開しました。',
    publishReady: 'このバッチには承認済み項目があり、公開可能です。',
    publishBlocked: '公開前に少なくとも1件を承認してください。',
    statuses: {
      DRAFT: '下書き',
      IN_REVIEW: 'レビュー中',
      READY_TO_PUBLISH: '公開準備完了',
      PUBLISHED: '公開済み',
      ARCHIVED: 'アーカイブ',
    },
    sourceTypes: {
      MANUAL: '手動',
      BULK_PASTE: '一括貼り付け',
      CSV: 'CSV',
    },
    approvalStatuses: {
      PENDING: '保留',
      APPROVED: '承認済み',
      REJECTED: '却下',
    },
  },
} as const

export function getAdminIntakeLabels(language: string): AdminIntakeLabels {
  if (language.startsWith('vi')) {
    return labels.vi
  }

  if (language.startsWith('ja')) {
    return labels.ja
  }

  return labels.en
}
