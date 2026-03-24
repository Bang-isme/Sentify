import type { Language } from './landingContent'
import { getLocaleWithFallback } from './localeFallback'

export interface ProductUiCopy {
  header: {
    marketingLinks: Array<{ label: string; sectionId: string }>
    login: string
    signup: string
    dashboard: string
    reviews: string
    settings: string
    landing: string
    logout: string
    accountMenuLabel: string
    signedInAs: string
    protectedAccess: string
    restaurantSingular: string
    restaurantPlural: string
    accountFallback: string
  }
  landing: {
    heroPrimary: string
    heroSecondary: string
    heroPrimaryAuthenticated: string
    heroSecondaryAuthenticated: string
    ctaPrimary: string
    ctaSecondary: string
    ctaPrimaryAuthenticated: string
    ctaSecondaryAuthenticated: string
  }
  auth: {
    eyebrow: string
    loginTitle: string
    signupTitle: string
    loginDescription: string
    signupDescription: string
    fullNameLabel: string
    emailLabel: string
    passwordLabel: string
    submitLogin: string
    submitSignup: string
    loginAltPrompt: string
    signupAltPrompt: string
    loginAltAction: string
    signupAltAction: string
    trustPoints: string[]
    validation: {
      fullNameRequired: string
      fullNameTooLong: string
      emailRequired: string
      emailInvalid: string
      passwordRequired: string
      passwordTooShort: string
    }
  }
  app: {
    shellTitle: string
    shellDescription: string
    currentRestaurant: string
    connectionHealth: string
    restaurantSwitcherLabel: string
    restaurantSwitcherHint: string
    restaurantSwitcherReadonly: string
    onboardingEyebrow: string
    onboardingTitle: string
    onboardingDescription: string
    onboardingSteps: string[]
    setupTitle: string
    setupDescription: string
    createRestaurant: string
    createAnotherRestaurant: string
    restaurantNameLabel: string
    restaurantAddressLabel: string
    googleMapsUrlLabel: string
    googleMapsUrlPlaceholder: string
    navDashboard: string
    navReviews: string
    navSettings: string
    dashboardTitle: string
    dashboardDescription: string
    dashboardPrimaryCta: string
    dashboardSecondaryCta: string
    reviewsTitle: string
    reviewsDescription: string
    settingsTitle: string
    settingsDescription: string
    settingsRestaurantTitle: string
    settingsRestaurantDescription: string
    settingsSourceTitle: string
    settingsSourceDescription: string
    addRestaurantTitle: string
    addRestaurantDescription: string
    importReviews: string
    importing: string
    saveChanges: string
    saving: string
    totalReviews: string
    averageRating: string
    negativeShare: string
    sentimentSplit: string
    complaintKeywords: string
    ratingTrend: string
    reviewEvidence: string
    sourceReadiness: string
    sourceReady: string
    sourceMissing: string
    importReady: string
    importBlocked: string
    sourceStatusConnected: string
    sourceStatusNeedsConfiguration: string
    syncStatusTitle: string
    syncStatusDescription: string
    syncStatusEmpty: string
    syncStatusLastSync: string
    syncStatusNewReviews: string
    syncStatusCompletedWithChanges: string
    syncStatusCompletedNoChanges: string
    syncStatusRunning: string
    syncStatusQueued: string
    syncStatusFailed: string
    importHistoryTitle: string
    importHistoryDescription: string
    importHistoryToggleOpen: string
    importHistoryToggleClose: string
    importHistoryEmpty: string
    importHistoryActive: string
    importHistoryLatestBadge: string
    importHistoryImported: string
    importHistorySkipped: string
    importHistoryCollected: string
    importHistoryCoverage: string
    importHistoryStartedAt: string
    importHistoryUpdatedAt: string
    importHistoryCompletedAt: string
    importHistoryFailedAt: string
    importHistoryUnavailable: string
    loadingImportHistory: string
    importRunStatusLabels: Record<'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED', string>
    importRunPhaseLabels: Record<
      'QUEUED' | 'SCRAPING' | 'ANALYZING' | 'PERSISTING' | 'REBUILDING' | 'COMPLETED' | 'FAILED',
      string
    >
    noRestaurants: string
    noReviews: string
    noComplaints: string
    noTrend: string
    noGoogleMapUrl: string
    reviewFilters: string
    filterRating: string
    filterFrom: string
    filterTo: string
    applyFilters: string
    clearFilters: string
    allRatings: string
    datePickerPreviousMonth: string
    datePickerNextMonth: string
    sentimentLabels: Record<'POSITIVE' | 'NEUTRAL' | 'NEGATIVE', string>
    periodWeek: string
    periodMonth: string
    paginationPrevious: string
    paginationNext: string
    paginationItems: string
    operationalPrompt: string
    protectedAccess: string
    restaurantScoped: string
    loadingDashboard: string
    loadingReviews: string
    loadingRestaurant: string
    anonymousGuest: string
    noReviewContent: string
    noSourceDate: string
    validation: {
      restaurantNameRequired: string
      restaurantNameTooLong: string
      restaurantAddressTooLong: string
      googleMapsUrlInvalid: string
      googleMapsUrlMustBeGoogle: string
      filterDateRangeInvalid: string
    }
  }
  feedback: {
    sessionExpired: string
    loadingSession: string
    saved: string
    imported: string
    errors: {
      refreshSession: string
      loadRestaurant: string
      loadDashboard: string
      loadReviews: string
      login: string
      signup: string
      createRestaurant: string
      saveRestaurant: string
      importReviews: string
    }
  }
}

export const productUiCopy = {
  en: {
    header: {
      marketingLinks: [
        { label: 'How it works', sectionId: 'workflow' },
        { label: 'Security', sectionId: 'trust' },
      ],
      login: 'Log in',
      signup: 'Start free',
      dashboard: 'Dashboard',
      reviews: 'Reviews',
      settings: 'Settings',
      landing: 'Landing page',
      logout: 'Logout',
      accountMenuLabel: 'Open account menu',
      signedInAs: 'Signed in as',
      protectedAccess: 'Protected access',
      restaurantSingular: 'restaurant',
      restaurantPlural: 'restaurants',
      accountFallback: 'Sentify user',
    },
    landing: {
      heroPrimary: 'Create account',
      heroSecondary: 'Log in',
      heroPrimaryAuthenticated: 'Go to dashboard',
      heroSecondaryAuthenticated: 'See workflow',
      ctaPrimary: 'Start free',
      ctaSecondary: 'See how it works',
      ctaPrimaryAuthenticated: 'Go to dashboard',
      ctaSecondaryAuthenticated: 'See workflow',
    },
    auth: {
      eyebrow: 'Get started',
      loginTitle: 'Return to your workspace.',
      signupTitle: 'Start with one restaurant and one source.',
      loginDescription:
        'Logging in should take a returning user straight back into the triage loop: choose a restaurant, import reviews, inspect complaints, and decide what to fix first.',
      signupDescription:
        'Create an account, connect one restaurant, save one Google Maps URL, and move straight into the dashboard loop.',
      fullNameLabel: 'Full name',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      submitLogin: 'Log in',
      submitSignup: 'Create account',
      loginAltPrompt: 'Need an account?',
      signupAltPrompt: 'Already have an account?',
      loginAltAction: 'Start free',
      signupAltAction: 'Log in',
      trustPoints: [
        'Protected account access with JWT auth',
        'Restaurant-scoped data boundaries',
        'Imports, insights, and original reviews in one loop',
      ],
      validation: {
        fullNameRequired: 'Enter your full name.',
        fullNameTooLong: 'Full name must be 100 characters or fewer.',
        emailRequired: 'Enter your email address.',
        emailInvalid: 'Enter a valid email address.',
        passwordRequired: 'Enter your password.',
        passwordTooShort: 'Password must be at least 8 characters.',
      },
    },
    app: {
      shellTitle: 'Sentify workspace',
      shellDescription: 'One source in. One next priority out.',
      currentRestaurant: 'Current restaurant',
      connectionHealth: 'Connection health',
      restaurantSwitcherLabel: 'Restaurant',
      restaurantSwitcherHint: 'Switch context without leaving the current view.',
      restaurantSwitcherReadonly: 'Only one restaurant is connected right now.',
      onboardingEyebrow: 'Get started',
      onboardingTitle: 'Connect your first restaurant',
      onboardingDescription:
        'This release stays intentionally narrow: one restaurant, one Google Maps source, one dashboard, and one decision question.',
      onboardingSteps: [
        'Create the first restaurant workspace.',
        'Save the Google Maps source URL.',
        'Run the first import and inspect the signal.',
      ],
      setupTitle: 'Restaurant setup',
      setupDescription:
        'Create the first restaurant and save a Google Maps URL so the product can pull in real operating evidence.',
      createRestaurant: 'Create restaurant',
      createAnotherRestaurant: 'Add another restaurant',
      restaurantNameLabel: 'Restaurant name',
      restaurantAddressLabel: 'Address',
      googleMapsUrlLabel: 'Google Maps URL',
      googleMapsUrlPlaceholder: 'https://maps.google.com/...',
      navDashboard: 'Dashboard',
      navReviews: 'Reviews',
      navSettings: 'Settings',
      dashboardTitle: 'Operational triage dashboard',
      dashboardDescription:
        'This screen should answer one question quickly: what should the owner fix first?',
      dashboardPrimaryCta: 'Import reviews',
      dashboardSecondaryCta: 'Open settings',
      reviewsTitle: 'Original reviews',
      reviewsDescription:
        'Use original reviews as evidence behind the current priority. Filter by rating and date when the signal needs confirmation.',
      settingsTitle: 'Restaurant settings',
      settingsDescription:
        'This screen exists to keep one source trustworthy, so the next triage decision is based on current data.',
      settingsRestaurantTitle: 'Restaurant profile',
      settingsRestaurantDescription:
        'Update the name and address used across the current workspace.',
      settingsSourceTitle: 'Review source',
      settingsSourceDescription:
        'This is the one input that powers the dashboard. Keep the Google Maps URL current so imports remain reliable.',
      addRestaurantTitle: 'Add another restaurant',
      addRestaurantDescription:
        'Secondary action only. Add another restaurant after the first workspace is stable and trustworthy.',
      importReviews: 'Import reviews',
      importing: 'Importing...',
      saveChanges: 'Save changes',
      saving: 'Saving...',
      totalReviews: 'Total reviews',
      averageRating: 'Average rating',
      negativeShare: 'Negative share',
      sentimentSplit: 'Sentiment split',
      complaintKeywords: 'Complaint keywords',
      ratingTrend: 'Rating trend',
      reviewEvidence: 'Original reviews',
      sourceReadiness: 'Source status',
      sourceReady: 'Google Maps URL is set.',
      sourceMissing: 'Google Maps URL is missing.',
      importReady: 'Import can run now.',
      importBlocked: 'Add a source URL before running import.',
      sourceStatusConnected: 'Source ready',
      sourceStatusNeedsConfiguration: 'Source missing',
      syncStatusTitle: 'Sync status',
      syncStatusDescription:
        'Keep this short and practical: has Sentify synced recently, did new reviews come in, and do you need to fix the source?',
      syncStatusEmpty: 'No sync has run yet. Start the first import after saving the source URL.',
      syncStatusLastSync: 'Last sync',
      syncStatusNewReviews: 'New reviews',
      syncStatusCompletedWithChanges: 'Latest sync completed and added new reviews.',
      syncStatusCompletedNoChanges: 'Latest sync completed. No new reviews were found.',
      syncStatusRunning: 'Sentify is syncing reviews right now.',
      syncStatusQueued: 'A sync is queued and will start shortly.',
      syncStatusFailed: 'The latest sync failed. Check the source settings before retrying.',
      importHistoryTitle: 'Import history',
      importHistoryDescription:
        'Use this only when you need to inspect recent syncs or troubleshoot the review source.',
      importHistoryToggleOpen: 'View sync details',
      importHistoryToggleClose: 'Hide sync details',
      importHistoryEmpty: 'No import runs yet. Start the first sync to build an operational trail.',
      importHistoryActive: 'Import in progress',
      importHistoryLatestBadge: 'Latest run',
      importHistoryImported: 'Imported',
      importHistorySkipped: 'Skipped',
      importHistoryCollected: 'Collected',
      importHistoryCoverage: 'Coverage',
      importHistoryStartedAt: 'Started',
      importHistoryUpdatedAt: 'Updated',
      importHistoryCompletedAt: 'Completed',
      importHistoryFailedAt: 'Failed',
      importHistoryUnavailable: 'N/A',
      loadingImportHistory: 'Loading import history...',
      importRunStatusLabels: {
        QUEUED: 'Queued',
        RUNNING: 'Running',
        COMPLETED: 'Completed',
        FAILED: 'Failed',
      },
      importRunPhaseLabels: {
        QUEUED: 'Queued and waiting for the worker.',
        SCRAPING: 'Collecting reviews from Google Maps.',
        ANALYZING: 'Checking duplicates and analyzing sentiment.',
        PERSISTING: 'Saving new reviews.',
        REBUILDING: 'Refreshing dashboard insights.',
        COMPLETED: 'Import completed.',
        FAILED: 'Import failed.',
      },
      noRestaurants: 'No restaurant yet. Create one to enter the product loop.',
      noReviews: 'No reviews imported yet. Save the source URL and run the first import.',
      noComplaints: 'No recurring complaint keywords yet. Import more reviews to build the signal.',
      noTrend: 'Trend will appear after reviews are imported.',
      noGoogleMapUrl: 'A Google Maps URL is required before import can run.',
      reviewFilters: 'Filters',
      filterRating: 'Rating',
      filterFrom: 'From',
      filterTo: 'To',
      applyFilters: 'Apply filters',
      clearFilters: 'Clear',
      allRatings: 'All ratings',
      datePickerPreviousMonth: 'Previous month',
      datePickerNextMonth: 'Next month',
      sentimentLabels: {
        POSITIVE: 'Positive',
        NEUTRAL: 'Neutral',
        NEGATIVE: 'Negative',
      },
      periodWeek: 'Weekly',
      periodMonth: 'Monthly',
      paginationPrevious: 'Previous',
      paginationNext: 'Next',
      paginationItems: 'items',
      operationalPrompt: 'One source. One next action.',
      protectedAccess: 'Protected account access',
      restaurantScoped: 'One dashboard per restaurant',
      loadingDashboard: 'Loading dashboard...',
      loadingReviews: 'Loading reviews...',
      loadingRestaurant: 'Loading restaurant...',
      anonymousGuest: 'Anonymous guest',
      noReviewContent: 'No review content available.',
      noSourceDate: 'No published date',
      validation: {
        restaurantNameRequired: 'Enter a restaurant name.',
        restaurantNameTooLong: 'Restaurant name must be 120 characters or fewer.',
        restaurantAddressTooLong: 'Address must be 255 characters or fewer.',
        googleMapsUrlInvalid: 'Enter a valid URL.',
        googleMapsUrlMustBeGoogle: 'Use a Google Maps URL.',
        filterDateRangeInvalid: 'The start date must be on or before the end date.',
      },
    },
    feedback: {
      sessionExpired: 'Your session expired. Please log in again.',
      loadingSession: 'Checking your secure session...',
      saved: 'Changes saved.',
      imported: 'Review import completed.',
      errors: {
        refreshSession: 'Unable to refresh session state.',
        loadRestaurant: 'Unable to load restaurant.',
        loadDashboard: 'Unable to load dashboard.',
        loadReviews: 'Unable to load reviews.',
        login: 'Unable to log in.',
        signup: 'Unable to create an account.',
        createRestaurant: 'Unable to create restaurant.',
        saveRestaurant: 'Unable to save restaurant settings.',
        importReviews: 'Unable to import reviews.',
      },
    },
  },
  vi: {
    header: {
      marketingLinks: [
        { label: 'Cách hoạt động', sectionId: 'workflow' },
        { label: 'Bảo mật', sectionId: 'trust' },
      ],
      login: 'Đăng nhập',
      signup: 'Bắt đầu miễn phí',
      dashboard: 'Bảng điều hành',
      reviews: 'Đánh giá',
      settings: 'Thiết lập',
      landing: 'Trang giới thiệu',
      logout: 'Đăng xuất',
      accountMenuLabel: 'Mở menu tài khoản',
      signedInAs: 'Đang đăng nhập bằng',
      protectedAccess: 'Truy cập được bảo vệ',
      restaurantSingular: 'nhà hàng',
      restaurantPlural: 'nhà hàng',
      accountFallback: 'Người dùng Sentify',
    },
    landing: {
      heroPrimary: 'Tạo tài khoản',
      heroSecondary: 'Đăng nhập',
      heroPrimaryAuthenticated: 'Vào bảng điều hành',
      heroSecondaryAuthenticated: 'Xem quy trình',
      ctaPrimary: 'Bắt đầu miễn phí',
      ctaSecondary: 'Xem cách hoạt động',
      ctaPrimaryAuthenticated: 'Vào bảng điều hành',
      ctaSecondaryAuthenticated: 'Xem quy trình',
    },
    auth: {
      eyebrow: 'Lối vào MVP SaaS',
      loginTitle: 'Quay lại màn hình vận hành.',
      signupTitle: 'Bắt đầu với một nhà hàng và một nguồn review.',
      loginDescription:
        'Người dùng quay lại phải vào đúng vòng lặp vận hành càng nhanh càng tốt: chọn nhà hàng, nhập đánh giá, xem phàn nàn, quyết định nên sửa gì trước.',
      signupDescription:
        'Tạo tài khoản, kết nối một nhà hàng, lưu một URL Google Maps, rồi đi thẳng vào bảng điều hành.',
      fullNameLabel: 'Họ và tên',
      emailLabel: 'Email',
      passwordLabel: 'Mật khẩu',
      submitLogin: 'Đăng nhập',
      submitSignup: 'Tạo tài khoản',
      loginAltPrompt: 'Chưa có tài khoản?',
      signupAltPrompt: 'Đã có tài khoản?',
      loginAltAction: 'Bắt đầu miễn phí',
      signupAltAction: 'Đăng nhập',
      trustPoints: [
        'Truy cập tài khoản được bảo vệ bằng JWT',
        'Dữ liệu được khóa theo từng nhà hàng',
        'Nhập liệu, insight và bằng chứng đánh giá nằm trong một vòng lặp',
      ],
      validation: {
        fullNameRequired: 'Hãy nhập họ và tên.',
        fullNameTooLong: 'Họ và tên không được vượt quá 100 ký tự.',
        emailRequired: 'Hãy nhập địa chỉ email.',
        emailInvalid: 'Email không hợp lệ.',
        passwordRequired: 'Hãy nhập mật khẩu.',
        passwordTooShort: 'Mật khẩu phải có ít nhất 8 ký tự.',
      },
    },
    app: {
      shellTitle: 'Workspace Sentify',
      shellDescription: 'Từ review đã nhập đến một ưu tiên vận hành rõ ràng.',
      currentRestaurant: 'Nhà hàng hiện tại',
      connectionHealth: 'Tình trạng kết nối',
      restaurantSwitcherLabel: 'Nhà hàng',
      restaurantSwitcherHint: 'Chuyển ngữ cảnh mà không rời khỏi màn hình hiện tại.',
      restaurantSwitcherReadonly: 'Hiện tại chỉ có một nhà hàng được kết nối.',
      onboardingEyebrow: 'Vào vòng lặp sản phẩm',
      onboardingTitle: 'Kết nối nhà hàng đầu tiên',
      onboardingDescription:
        'Phiên bản này cố tình giữ phạm vi hẹp: một nhà hàng, một nguồn Google Maps, một dashboard và một câu hỏi hành động.',
      onboardingSteps: [
        'Tạo workspace cho nhà hàng đầu tiên.',
        'Lưu URL Google Maps làm nguồn đánh giá.',
        'Chạy lần nhập đầu tiên và xem tín hiệu.',
      ],
      setupTitle: 'Thiết lập nhà hàng',
      setupDescription:
        'Tạo nhà hàng đầu tiên và lưu URL Google Maps để sản phẩm có dữ liệu vận hành thật.',
      createRestaurant: 'Tạo nhà hàng',
      createAnotherRestaurant: 'Thêm nhà hàng',
      restaurantNameLabel: 'Tên nhà hàng',
      restaurantAddressLabel: 'Địa chỉ',
      googleMapsUrlLabel: 'URL Google Maps',
      googleMapsUrlPlaceholder: 'https://maps.google.com/...',
      navDashboard: 'Bảng điều hành',
      navReviews: 'Đánh giá',
      navSettings: 'Thiết lập',
      dashboardTitle: 'Bảng điều hành ưu tiên vận hành',
      dashboardDescription:
        'Màn hình này phải trả lời thật nhanh một câu hỏi: chủ quán nên sửa gì trước?',
      dashboardPrimaryCta: 'Nhập đánh giá',
      dashboardSecondaryCta: 'Mở thiết lập',
      reviewsTitle: 'Bằng chứng đánh giá',
      reviewsDescription:
        'Dùng các đánh giá gốc như bằng chứng, không biến chúng thành một bức tường chữ. Lọc theo điểm và ngày khi cần xác minh tín hiệu.',
      settingsTitle: 'Thiết lập nhà hàng',
      settingsDescription:
        'Giữ thông tin nhà hàng và URL nguồn luôn chính xác để quá trình nhập ổn định.',
      settingsRestaurantTitle: 'Hồ sơ nhà hàng',
      settingsRestaurantDescription:
        'Cập nhật tên và địa chỉ đang dùng trong workspace hiện tại.',
      settingsSourceTitle: 'Nguồn đánh giá',
      settingsSourceDescription:
        'Giữ URL Google Maps luôn mới để các lần nhập tiếp theo ổn định hơn.',
      addRestaurantTitle: 'Thêm nhà hàng khác',
      addRestaurantDescription:
        'Tạo thêm một nhà hàng trong cùng tài khoản mà không phải rời khỏi workspace hiện tại.',
      importReviews: 'Nhập đánh giá',
      importing: 'Đang nhập...',
      saveChanges: 'Lưu thay đổi',
      saving: 'Đang lưu...',
      totalReviews: 'Tổng đánh giá',
      averageRating: 'Điểm trung bình',
      negativeShare: 'Tỷ lệ tiêu cực',
      sentimentSplit: 'Phân bố cảm xúc',
      complaintKeywords: 'Từ khóa phàn nàn',
      ratingTrend: 'Xu hướng điểm đánh giá',
      reviewEvidence: 'Bằng chứng đánh giá',
      sourceReadiness: 'Trạng thái nguồn',
      sourceReady: 'Đã cấu hình URL Google Maps.',
      sourceMissing: 'Chưa có URL Google Maps.',
      importReady: 'Có thể chạy nhập ngay.',
      importBlocked: 'Hãy thêm URL nguồn trước khi chạy nhập.',
      sourceStatusConnected: 'Nguồn đã sẵn sàng',
      sourceStatusNeedsConfiguration: 'Thiếu URL nguồn',
      syncStatusTitle: 'Trạng thái đồng bộ',
      syncStatusDescription:
        'Chỉ giữ lại điều chủ quán thật sự cần biết: lần đồng bộ gần nhất, có đánh giá mới hay không, và có cần kiểm tra lại nguồn hay không.',
      syncStatusEmpty: 'Chưa có lần đồng bộ nào. Hãy chạy lần nhập đầu tiên sau khi lưu URL nguồn.',
      syncStatusLastSync: 'Lần đồng bộ gần nhất',
      syncStatusNewReviews: 'Đánh giá mới',
      syncStatusCompletedWithChanges: 'Lần đồng bộ gần nhất đã hoàn tất và có thêm đánh giá mới.',
      syncStatusCompletedNoChanges: 'Lần đồng bộ gần nhất đã hoàn tất. Không có đánh giá mới.',
      syncStatusRunning: 'Sentify đang đồng bộ đánh giá.',
      syncStatusQueued: 'Lần đồng bộ đã vào hàng đợi và sẽ bắt đầu ngay sau đó.',
      syncStatusFailed: 'Lần đồng bộ gần nhất bị lỗi. Hãy kiểm tra lại nguồn trước khi chạy lại.',
      importHistoryTitle: 'Lịch sử nhập dữ liệu',
      importHistoryDescription:
        'Chỉ mở phần này khi cần kiểm tra các lần đồng bộ gần đây hoặc tìm nguyên nhân lỗi của nguồn đánh giá.',
      importHistoryToggleOpen: 'Xem chi tiết đồng bộ',
      importHistoryToggleClose: 'Ẩn chi tiết đồng bộ',
      importHistoryEmpty: 'Chưa có lần nhập nào. Hãy chạy lần đồng bộ đầu tiên để tạo lịch sử vận hành.',
      importHistoryActive: 'Đang nhập dữ liệu',
      importHistoryLatestBadge: 'Lần chạy mới nhất',
      importHistoryImported: 'Mới nhập',
      importHistorySkipped: 'Bỏ qua',
      importHistoryCollected: 'Đã thu thập',
      importHistoryCoverage: 'Độ phủ',
      importHistoryStartedAt: 'Bắt đầu',
      importHistoryUpdatedAt: 'Cập nhật',
      importHistoryCompletedAt: 'Hoàn tất',
      importHistoryFailedAt: 'Thất bại',
      importHistoryUnavailable: 'Chưa có',
      loadingImportHistory: 'Đang tải lịch sử nhập dữ liệu...',
      importRunStatusLabels: {
        QUEUED: 'Đang xếp hàng',
        RUNNING: 'Đang chạy',
        COMPLETED: 'Hoàn tất',
        FAILED: 'Thất bại',
      },
      importRunPhaseLabels: {
        QUEUED: 'Đã vào hàng đợi và chờ worker bắt đầu.',
        SCRAPING: 'Đang thu thập đánh giá từ Google Maps.',
        ANALYZING: 'Đang kiểm tra trùng lặp và phân tích cảm xúc.',
        PERSISTING: 'Đang lưu các đánh giá mới.',
        REBUILDING: 'Đang làm mới insight trên dashboard.',
        COMPLETED: 'Đã hoàn tất nhập dữ liệu.',
        FAILED: 'Lần nhập bị lỗi.',
      },
      noRestaurants: 'Chưa có nhà hàng nào. Hãy tạo một nhà hàng để đi vào vòng lặp sản phẩm.',
      noReviews: 'Chưa có đánh giá nào được nhập. Hãy lưu URL nguồn và chạy lần nhập đầu tiên.',
      noComplaints: 'Chưa có từ khóa phàn nàn lặp lại. Hãy nhập thêm đánh giá để tạo tín hiệu.',
      noTrend: 'Xu hướng sẽ xuất hiện sau khi có dữ liệu đánh giá.',
      noGoogleMapUrl: 'Cần có URL Google Maps trước khi chạy nhập.',
      reviewFilters: 'Bộ lọc',
      filterRating: 'Điểm số',
      filterFrom: 'Từ ngày',
      filterTo: 'Đến ngày',
      applyFilters: 'Áp dụng bộ lọc',
      clearFilters: 'Xóa',
      allRatings: 'Tất cả mức điểm',
      datePickerPreviousMonth: 'Tháng trước',
      datePickerNextMonth: 'Tháng sau',
      sentimentLabels: {
        POSITIVE: 'Tích cực',
        NEUTRAL: 'Trung lập',
        NEGATIVE: 'Tiêu cực',
      },
      periodWeek: 'Theo tuần',
      periodMonth: 'Theo tháng',
      paginationPrevious: 'Trước',
      paginationNext: 'Sau',
      paginationItems: 'mục',
      operationalPrompt: 'Tín hiệu vận hành theo từng nhà hàng',
      protectedAccess: 'Truy cập tài khoản được bảo vệ',
      restaurantScoped: 'Mỗi nhà hàng có một bảng điều hành riêng',
      loadingDashboard: 'Đang tải bảng điều hành...',
      loadingReviews: 'Đang tải đánh giá...',
      loadingRestaurant: 'Đang tải nhà hàng...',
      anonymousGuest: 'Khách ẩn danh',
      noReviewContent: 'Không có nội dung đánh giá.',
      noSourceDate: 'Không có ngày đánh giá',
      validation: {
        restaurantNameRequired: 'Hãy nhập tên nhà hàng.',
        restaurantNameTooLong: 'Tên nhà hàng không được vượt quá 120 ký tự.',
        restaurantAddressTooLong: 'Địa chỉ không được vượt quá 255 ký tự.',
        googleMapsUrlInvalid: 'URL không hợp lệ.',
        googleMapsUrlMustBeGoogle: 'Hãy dùng URL Google Maps.',
        filterDateRangeInvalid: 'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.',
      },
    },
    feedback: {
      sessionExpired: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
      loadingSession: 'Đang kiểm tra phiên đăng nhập an toàn...',
      saved: 'Đã lưu thay đổi.',
      imported: 'Đã hoàn tất nhập đánh giá.',
      errors: {
        refreshSession: 'Không thể làm mới trạng thái phiên đăng nhập.',
        loadRestaurant: 'Không thể tải dữ liệu nhà hàng.',
        loadDashboard: 'Không thể tải bảng điều hành.',
        loadReviews: 'Không thể tải dữ liệu đánh giá.',
        login: 'Không thể đăng nhập.',
        signup: 'Không thể tạo tài khoản.',
        createRestaurant: 'Không thể tạo nhà hàng.',
        saveRestaurant: 'Không thể lưu thiết lập nhà hàng.',
        importReviews: 'Không thể nhập đánh giá.',
      },
    },
  },
  ja: {
    header: {
      marketingLinks: [
        { label: '仕組み', sectionId: 'workflow' },
        { label: 'セキュリティ', sectionId: 'trust' },
      ],
      login: 'ログイン',
      signup: '無料で始める',
      dashboard: 'ダッシュボード',
      reviews: 'レビュー',
      settings: '設定',
      landing: '紹介ページ',
      logout: 'ログアウト',
      accountMenuLabel: 'アカウントメニューを開く',
      signedInAs: 'ログイン中',
      protectedAccess: '保護されたアクセス',
      restaurantSingular: '店舗',
      restaurantPlural: '店舗',
      accountFallback: 'Sentifyユーザー',
    },
    landing: {
      heroPrimary: 'アカウントを作成',
      heroSecondary: 'ログイン',
      heroPrimaryAuthenticated: 'ダッシュボードへ',
      heroSecondaryAuthenticated: 'ワークフローを見る',
      ctaPrimary: '無料で始める',
      ctaSecondary: '仕組みを見る',
      ctaPrimaryAuthenticated: 'ダッシュボードへ',
      ctaSecondaryAuthenticated: 'ワークフローを見る',
    },
    auth: {
      eyebrow: '利用開始',
      loginTitle: '運営画面に戻る。',
      signupTitle: '1店舗、1ソースから始める。',
      loginDescription:
        '再訪ユーザーは、対象の店舗を選び、レビューを取り込み、不満を確認し、最初に直すべきことをすぐ判断できる必要があります。',
      signupDescription:
        'アカウントを作成し、1店舗を接続してGoogle MapsのURLを保存すれば、そのままダッシュボードに進めます。',
      fullNameLabel: '氏名',
      emailLabel: 'メールアドレス',
      passwordLabel: 'パスワード',
      submitLogin: 'ログイン',
      submitSignup: 'アカウントを作成',
      loginAltPrompt: 'アカウントをお持ちでないですか？',
      signupAltPrompt: 'すでにアカウントをお持ちですか？',
      loginAltAction: '無料で始める',
      signupAltAction: 'ログイン',
      trustPoints: [
        'JWT による保護されたアカウントアクセス',
        '店舗単位で区切られたデータ境界',
        '取り込み、インサイト、元レビュー確認が1つのループにつながる',
      ],
      validation: {
        fullNameRequired: '氏名を入力してください。',
        fullNameTooLong: '氏名は100文字以内で入力してください。',
        emailRequired: 'メールアドレスを入力してください。',
        emailInvalid: '有効なメールアドレスを入力してください。',
        passwordRequired: 'パスワードを入力してください。',
        passwordTooShort: 'パスワードは8文字以上で入力してください。',
      },
    },
    app: {
      shellTitle: 'Sentify ワークスペース',
      shellDescription: '取り込んだレビューから、次に取るべき運営アクションを1つに絞り込みます。',
      currentRestaurant: '現在の店舗',
      connectionHealth: '接続状態',
      restaurantSwitcherLabel: '店舗',
      restaurantSwitcherHint: '今の画面を離れずに対象店舗を切り替えます。',
      restaurantSwitcherReadonly: '現在は1店舗のみ接続されています。',
      onboardingEyebrow: '最初の設定',
      onboardingTitle: '最初の店舗を接続する',
      onboardingDescription:
        'このMVPはあえて範囲を絞っています。1店舗、1つのGoogle Mapsソース、1つのダッシュボード、そして1つの判断に集中します。',
      onboardingSteps: [
        '最初の店舗ワークスペースを作成する。',
        'Google MapsのURLをレビューソースとして保存する。',
        '最初の取り込みを実行してシグナルを確認する。',
      ],
      setupTitle: '店舗セットアップ',
      setupDescription:
        '最初の店舗を作成し、Google MapsのURLを保存して、実際の運営データを取り込みます。',
      createRestaurant: '店舗を作成',
      createAnotherRestaurant: '別の店舗を追加',
      restaurantNameLabel: '店舗名',
      restaurantAddressLabel: '住所',
      googleMapsUrlLabel: 'Google MapsのURL',
      googleMapsUrlPlaceholder: 'https://maps.google.com/...',
      navDashboard: 'ダッシュボード',
      navReviews: 'レビュー',
      navSettings: '設定',
      dashboardTitle: '運営優先度ダッシュボード',
      dashboardDescription:
        'この画面は「まず何を直すべきか」にすばやく答えられる必要があります。',
      dashboardPrimaryCta: 'レビューを取り込む',
      dashboardSecondaryCta: '設定を開く',
      reviewsTitle: '元レビュー',
      reviewsDescription:
        '元レビューは根拠として扱い、必要なときだけ評価や日付で絞り込みます。',
      settingsTitle: '店舗設定',
      settingsDescription:
        '店舗プロフィールとソースURLを最新に保ち、取り込みを安定させます。',
      settingsRestaurantTitle: '店舗プロフィール',
      settingsRestaurantDescription:
        '現在のワークスペースで使う店舗名と住所を更新します。',
      settingsSourceTitle: 'レビューソース',
      settingsSourceDescription:
        'Google MapsのURLを最新に保ち、取り込みの再現性を確保します。',
      addRestaurantTitle: '別の店舗を追加',
      addRestaurantDescription:
        '現在のアカウントのまま2店舗目を追加できます。',
      importReviews: 'レビューを取り込む',
      importing: '取り込み中...',
      saveChanges: '変更を保存',
      saving: '保存中...',
      totalReviews: 'レビュー総数',
      averageRating: '平均評価',
      negativeShare: 'ネガティブ比率',
      sentimentSplit: '感情分布',
      complaintKeywords: '不満キーワード',
      ratingTrend: '評価トレンド',
      reviewEvidence: '元レビュー',
      sourceReadiness: 'ソース状態',
      sourceReady: 'Google MapsのURLは設定済みです。',
      sourceMissing: 'Google MapsのURLが未設定です。',
      importReady: '今すぐ取り込みを実行できます。',
      importBlocked: '取り込み前にソースURLを追加してください。',
      sourceStatusConnected: 'ソース準備完了',
      sourceStatusNeedsConfiguration: 'ソース未設定',
      syncStatusTitle: '同期ステータス',
      syncStatusDescription:
        '店舗側が本当に知りたいことだけを短く示します。最後の同期、新しく増えたレビュー数、そしてソース確認が必要かどうかです。',
      syncStatusEmpty: 'まだ同期がありません。ソースURLを保存して最初の取り込みを実行してください。',
      syncStatusLastSync: '最終同期',
      syncStatusNewReviews: '新規レビュー',
      syncStatusCompletedWithChanges: '最新の同期が完了し、新しいレビューが追加されました。',
      syncStatusCompletedNoChanges: '最新の同期は完了しました。新しいレビューはありませんでした。',
      syncStatusRunning: 'Sentify がレビューを同期しています。',
      syncStatusQueued: '同期はキューに入り、まもなく開始されます。',
      syncStatusFailed: '最新の同期に失敗しました。再実行前にソース設定を確認してください。',
      importHistoryTitle: '取り込み履歴',
      importHistoryDescription:
        '最近の同期結果やソースエラーの確認が必要なときだけ、この詳細を開いてください。',
      importHistoryToggleOpen: '同期詳細を表示',
      importHistoryToggleClose: '同期詳細を隠す',
      importHistoryEmpty: 'まだ取り込み履歴がありません。最初の同期を実行して運用ログを作成してください。',
      importHistoryActive: '取り込み実行中',
      importHistoryLatestBadge: '最新実行',
      importHistoryImported: '新規取り込み',
      importHistorySkipped: 'スキップ',
      importHistoryCollected: '収集済み',
      importHistoryCoverage: 'カバレッジ',
      importHistoryStartedAt: '開始',
      importHistoryUpdatedAt: '更新',
      importHistoryCompletedAt: '完了',
      importHistoryFailedAt: '失敗',
      importHistoryUnavailable: '未取得',
      loadingImportHistory: '取り込み履歴を読み込み中...',
      importRunStatusLabels: {
        QUEUED: '待機中',
        RUNNING: '実行中',
        COMPLETED: '完了',
        FAILED: '失敗',
      },
      importRunPhaseLabels: {
        QUEUED: 'キューに入り、worker の開始を待っています。',
        SCRAPING: 'Google Maps からレビューを収集中です。',
        ANALYZING: '重複確認と感情分析を実行中です。',
        PERSISTING: '新しいレビューを保存中です。',
        REBUILDING: 'ダッシュボード指標を再構築中です。',
        COMPLETED: '取り込みが完了しました。',
        FAILED: '取り込みに失敗しました。',
      },
      noRestaurants: 'まだ店舗がありません。最初の店舗を作成して製品ループに入ってください。',
      noReviews: 'まだレビューが取り込まれていません。URL を保存して最初の取り込みを実行してください。',
      noComplaints: '繰り返し現れる不満キーワードはまだありません。レビューを増やしてシグナルを作ってください。',
      noTrend: 'レビューが取り込まれるとトレンドが表示されます。',
      noGoogleMapUrl: '取り込み前にGoogle MapsのURLが必要です。',
      reviewFilters: 'フィルター',
      filterRating: '評価',
      filterFrom: '開始日',
      filterTo: '終了日',
      applyFilters: '適用',
      clearFilters: 'クリア',
      allRatings: 'すべての評価',
      datePickerPreviousMonth: '前月',
      datePickerNextMonth: '翌月',
      sentimentLabels: {
        POSITIVE: 'ポジティブ',
        NEUTRAL: 'ニュートラル',
        NEGATIVE: 'ネガティブ',
      },
      periodWeek: '週次',
      periodMonth: '月次',
      paginationPrevious: '前へ',
      paginationNext: '次へ',
      paginationItems: '件',
      operationalPrompt: '店舗ごとの運営シグナル',
      protectedAccess: '保護されたアカウントアクセス',
      restaurantScoped: '店舗ごとに1つのダッシュボード',
      loadingDashboard: 'ダッシュボードを読み込み中...',
      loadingReviews: 'レビューを読み込み中...',
      loadingRestaurant: '店舗情報を読み込み中...',
      anonymousGuest: '匿名ユーザー',
      noReviewContent: 'レビュー本文がありません。',
      noSourceDate: '投稿日情報なし',
      validation: {
        restaurantNameRequired: '店舗名を入力してください。',
        restaurantNameTooLong: '店舗名は120文字以内で入力してください。',
        restaurantAddressTooLong: '住所は255文字以内で入力してください。',
        googleMapsUrlInvalid: '有効なURLを入力してください。',
        googleMapsUrlMustBeGoogle: 'Google MapsのURLを入力してください。',
        filterDateRangeInvalid: '開始日は終了日以前である必要があります。',
      },
    },
    feedback: {
      sessionExpired: 'セッションの有効期限が切れました。再度ログインしてください。',
      loadingSession: '安全なセッションを確認しています...',
      saved: '変更を保存しました。',
      imported: 'レビューの取り込みが完了しました。',
      errors: {
        refreshSession: 'セッション状態を更新できませんでした。',
        loadRestaurant: '店舗データを読み込めませんでした。',
        loadDashboard: 'ダッシュボードを読み込めませんでした。',
        loadReviews: 'レビューを読み込めませんでした。',
        login: 'ログインできませんでした。',
        signup: 'アカウントを作成できませんでした。',
        createRestaurant: '店舗を作成できませんでした。',
        saveRestaurant: '店舗設定を保存できませんでした。',
        importReviews: 'レビューを取り込めませんでした。',
      },
    },
  },
} satisfies Record<Language, ProductUiCopy>

export function getProductUiCopy(language: Language) {
  return getLocaleWithFallback(productUiCopy, language)
}
