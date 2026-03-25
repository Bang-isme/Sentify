import type { Language } from './landingContent'

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
    saveChanges: string
    saving: string
    totalReviews: string
    averageRating: string
    negativeShare: string
    sentimentSplit: string
    complaintKeywords: string
    ratingTrend: string
    reviewEvidence: string
    topIssueTitle: string
    topIssueDescription: string
    topIssueEmpty: string
    topIssueLabel: string
    topIssueActionLabel: string
    topIssueActionTemplate: string
    topIssueActionFallback: string
    topIssueCta: string
    sourceReadiness: string
    sourceReady: string
    sourceMissing: string
    intakeReady: string
    intakeBlocked: string
    sourceStatusConnected: string
    sourceStatusNeedsConfiguration: string
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
    errors: {
      refreshSession: string
      loadRestaurant: string
      loadDashboard: string
      loadReviews: string
      login: string
      signup: string
      createRestaurant: string
      saveRestaurant: string
    }
  }
}

export const productUiCopy = {
  en: {
    header: {
      marketingLinks: [
        { label: 'How it works', sectionId: 'workflow' },
        { label: 'Security', sectionId: 'trust' },
        { label: 'Sprint 1', sectionId: 'sprint-1' },
      ],
      login: 'Login',
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
      heroSecondary: 'Login',
      heroPrimaryAuthenticated: 'Go to dashboard',
      heroSecondaryAuthenticated: 'Review workflow',
      ctaPrimary: 'Start free',
      ctaSecondary: 'See how it works',
      ctaPrimaryAuthenticated: 'Go to dashboard',
      ctaSecondaryAuthenticated: 'Review workflow',
    },
    auth: {
      eyebrow: 'MVP SaaS entry',
      loginTitle: 'Return to the operating view.',
      signupTitle: 'Start with one restaurant and one source.',
      loginDescription:
        'Login should take a returning user straight back into the triage loop: choose a restaurant, curate reviews, inspect complaints, decide what to fix first.',
      signupDescription:
        'Create an account, connect one restaurant, save one Google Maps URL, and move directly into the dashboard loop.',
      fullNameLabel: 'Full name',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      submitLogin: 'Login',
      submitSignup: 'Create account',
      loginAltPrompt: 'Need an account?',
      signupAltPrompt: 'Already have an account?',
      loginAltAction: 'Start free',
      signupAltAction: 'Login',
      trustPoints: [
        'Protected account access with JWT auth',
        'Restaurant-scoped data boundaries',
        'Intake, insight, and review evidence in one loop',
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
      shellDescription: 'One source in. One priority out.',
      currentRestaurant: 'Current restaurant',
      connectionHealth: 'Connection health',
      restaurantSwitcherLabel: 'Restaurant',
      restaurantSwitcherHint: 'Switch context without leaving the current view.',
      restaurantSwitcherReadonly: 'Only one restaurant is connected right now.',
      onboardingEyebrow: 'Get into the loop',
      onboardingTitle: 'Connect your first restaurant',
      onboardingDescription:
        'Sprint 1 stays intentionally narrow: one restaurant, one Google Maps source, one dashboard, and one decision question.',
      onboardingSteps: [
        'Create the first restaurant workspace.',
        'Save the Google Maps source URL.',
        'Publish the first curated reviews and inspect the signal.',
      ],
      setupTitle: 'Restaurant setup',
      setupDescription:
        'Create the first restaurant and save a Google Maps URL so the product can load real operating evidence.',
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
      dashboardPrimaryCta: 'Review workflow readiness',
      dashboardSecondaryCta: 'Open settings',
      reviewsTitle: 'Review evidence',
      reviewsDescription:
        'Use reviews only as proof behind the current priority. Filter by rating and date when the signal needs confirmation.',
      settingsTitle: 'Restaurant settings',
      settingsDescription:
        'This screen exists to keep one source trustworthy, so the next triage decision is based on current data.',
      settingsRestaurantTitle: 'Restaurant profile',
      settingsRestaurantDescription:
        'Update the name and address used across the current workspace.',
      settingsSourceTitle: 'Review source',
      settingsSourceDescription:
        'This is the one input that powers the dashboard. Keep the Google Maps URL current so intake stays reliable.',
      addRestaurantTitle: 'Add another restaurant',
      addRestaurantDescription:
        'Secondary action only. Add another restaurant after the first workspace is stable and trustworthy.',
      saveChanges: 'Save changes',
      saving: 'Saving...',
      totalReviews: 'Total reviews',
      averageRating: 'Average rating',
      negativeShare: 'Negative share',
      sentimentSplit: 'Sentiment split',
      complaintKeywords: 'Complaint keywords',
      ratingTrend: 'Rating trend',
      reviewEvidence: 'Review evidence',
      topIssueTitle: 'Top issue and next action',
      topIssueDescription:
        'This highlights the most frequent complaint in the curated dataset and the next move to confirm it.',
      topIssueEmpty:
        'No dominant complaint signal yet. Publish more reviews to surface the top issue.',
      topIssueLabel: 'Top issue',
      topIssueActionLabel: 'Next action',
      topIssueActionTemplate:
        'Review {count} reviews mentioning “{keyword}” and decide the first fix.',
      topIssueActionFallback: 'Review the latest evidence and decide the first fix.',
      topIssueCta: 'Open review evidence',
      sourceReadiness: 'Source readiness',
      sourceReady: 'Google Maps URL is configured.',
      sourceMissing: 'Google Maps URL is missing.',
      intakeReady: 'Ready for intake.',
      intakeBlocked: 'Add a source URL before intake.',
      sourceStatusConnected: 'Source ready',
      sourceStatusNeedsConfiguration: 'Source missing',
      noRestaurants: 'No restaurant yet. Create one to enter the product loop.',
      noReviews: 'No reviews are published yet. Coordinate with an admin to curate and publish the first batch.',
      noComplaints: 'No recurring complaint keywords yet. Publish more reviews to build the signal.',
      noTrend: 'Trend will appear after reviews are published.',
      noGoogleMapUrl: 'A Google Maps URL is required before intake can start.',
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
      operationalPrompt: 'One source. One decision.',
      protectedAccess: 'Protected account access',
      restaurantScoped: 'One dashboard per restaurant',
      loadingDashboard: 'Loading dashboard...',
      loadingReviews: 'Loading reviews...',
      loadingRestaurant: 'Loading restaurant...',
      anonymousGuest: 'Anonymous guest',
      noReviewContent: 'No review content available.',
      noSourceDate: 'No source date',
      validation: {
        restaurantNameRequired: 'Enter a restaurant name.',
        restaurantNameTooLong: 'Restaurant name must be 120 characters or fewer.',
        restaurantAddressTooLong: 'Address must be 255 characters or fewer.',
        googleMapsUrlInvalid: 'Enter a valid URL.',
        googleMapsUrlMustBeGoogle: 'Use a Google Maps URL.',
        filterDateRangeInvalid: '`From` must be before or equal to `To`.',
      },
    },
    feedback: {
      sessionExpired: 'Your session expired. Please login again.',
      loadingSession: 'Checking your secure session...',
      saved: 'Changes saved.',
      errors: {
        refreshSession: 'Unable to refresh session state.',
        loadRestaurant: 'Unable to load restaurant.',
        loadDashboard: 'Unable to load dashboard.',
        loadReviews: 'Unable to load reviews.',
        login: 'Unable to login.',
        signup: 'Unable to create account.',
        createRestaurant: 'Unable to create restaurant.',
        saveRestaurant: 'Unable to save restaurant settings.',
      },
    },
  },
  vi: {
    header: {
      marketingLinks: [
        { label: 'Cách hoạt động', sectionId: 'workflow' },
        { label: 'Bảo mật', sectionId: 'trust' },
        { label: 'Sprint 1', sectionId: 'sprint-1' },
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
        'Người dùng quay lại phải vào đúng vòng lặp vận hành càng nhanh càng tốt: chọn nhà hàng, nhập liệu review, xem phàn nàn, quyết định nên sửa gì trước.',
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
        'Sprint 1 cố tình giữ phạm vi hẹp: một nhà hàng, một nguồn Google Maps, một dashboard và một câu hỏi hành động.',
      onboardingSteps: [
        'Tạo workspace cho nhà hàng đầu tiên.',
        'Lưu URL Google Maps làm nguồn đánh giá.',
        'Publish các review đã được curate và xem tín hiệu.',
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
      dashboardPrimaryCta: 'Kiểm tra trạng thái review',
      dashboardSecondaryCta: 'Mở thiết lập',
      reviewsTitle: 'Bằng chứng đánh giá',
      reviewsDescription:
        'Dùng các đánh giá gốc như bằng chứng, không biến chúng thành một bức tường chữ. Lọc theo điểm và ngày khi cần xác minh tín hiệu.',
      settingsTitle: 'Thiết lập nhà hàng',
      settingsDescription:
        'Giữ thông tin nhà hàng và URL nguồn luôn chính xác để dữ liệu ổn định.',
      settingsRestaurantTitle: 'Hồ sơ nhà hàng',
      settingsRestaurantDescription:
        'Cập nhật tên và địa chỉ đang dùng trong workspace hiện tại.',
      settingsSourceTitle: 'Nguồn đánh giá',
      settingsSourceDescription:
        'Giữ URL Google Maps luôn mới để dữ liệu được cập nhật ổn định hơn.',
      addRestaurantTitle: 'Thêm nhà hàng khác',
      addRestaurantDescription:
        'Tạo thêm một nhà hàng trong cùng tài khoản mà không phải rời khỏi workspace hiện tại.',
      saveChanges: 'Lưu thay đổi',
      saving: 'Đang lưu...',
      totalReviews: 'Tổng đánh giá',
      averageRating: 'Điểm trung bình',
      negativeShare: 'Tỷ lệ tiêu cực',
      sentimentSplit: 'Phân bố cảm xúc',
      complaintKeywords: 'Từ khóa phàn nàn',
      ratingTrend: 'Xu hướng điểm đánh giá',
      reviewEvidence: 'Bằng chứng đánh giá',
      topIssueTitle: 'Vấn đề nổi bật và bước tiếp theo',
      topIssueDescription:
        'Tập trung vào từ khóa phàn nàn xuất hiện nhiều nhất trong dataset đã được duyệt.',
      topIssueEmpty:
        'Chưa có tín hiệu phàn nàn nổi bật. Hãy publish thêm review để lộ ra vấn đề chính.',
      topIssueLabel: 'Vấn đề nổi bật',
      topIssueActionLabel: 'Bước tiếp theo',
      topIssueActionTemplate:
        'Xem {count} review nhắc đến “{keyword}” rồi quyết định việc cần sửa trước.',
      topIssueActionFallback: 'Xem bằng chứng gần nhất rồi quyết định việc cần sửa trước.',
      topIssueCta: 'Mở bằng chứng đánh giá',
      sourceReadiness: 'Trạng thái nguồn',
      sourceReady: 'Đã cấu hình URL Google Maps.',
      sourceMissing: 'Chưa có URL Google Maps.',
      intakeReady: 'Sẵn sàng nhập liệu.',
      intakeBlocked: 'Hãy thêm URL nguồn trước khi nhập liệu.',
      sourceStatusConnected: 'Nguồn đã sẵn sàng',
      sourceStatusNeedsConfiguration: 'Thiếu URL nguồn',
      noRestaurants: 'Chưa có nhà hàng nào. Hãy tạo một nhà hàng để đi vào vòng lặp sản phẩm.',
      noReviews: 'Chưa có review nào được publish. Cần admin curate và publish batch đầu tiên.',
      noComplaints: 'Chưa có từ khóa phàn nàn lặp lại. Hãy publish thêm review để tạo tín hiệu.',
      noTrend: 'Xu hướng sẽ xuất hiện sau khi review được publish.',
      noGoogleMapUrl: 'Cần có URL Google Maps trước khi nhập liệu.',
      reviewFilters: 'Bộ lọc',
      filterRating: 'Điểm số',
      filterFrom: 'Từ ngày',
      filterTo: 'Đến ngày',
      applyFilters: 'Áp dụng bộ lọc',
      clearFilters: 'Xóa',
      allRatings: 'Tất cả mức điểm',
      datePickerPreviousMonth: 'Th?ng tr??c',
      datePickerNextMonth: 'Th?ng sau',
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
      errors: {
        refreshSession: 'Không thể làm mới trạng thái phiên đăng nhập.',
        loadRestaurant: 'Không thể tải dữ liệu nhà hàng.',
        loadDashboard: 'Không thể tải bảng điều hành.',
        loadReviews: 'Không thể tải dữ liệu đánh giá.',
        login: 'Không thể đăng nhập.',
        signup: 'Không thể tạo tài khoản.',
        createRestaurant: 'Không thể tạo nhà hàng.',
        saveRestaurant: 'Không thể lưu thiết lập nhà hàng.',
      },
    },
  },
  ja: {
    header: {
      marketingLinks: [
        { label: '仕組み', sectionId: 'workflow' },
        { label: 'セキュリティ', sectionId: 'trust' },
        { label: 'Sprint 1', sectionId: 'sprint-1' },
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
      eyebrow: 'MVP SaaS の入口',
      loginTitle: '運営画面に戻る。',
      signupTitle: '1店舗、1ソースから始める。',
      loginDescription:
        '再訪ユーザーは、店舗を選び、レビューを管理入力し、不満を確認し、何を最初に直すべきかをすぐ判断できる必要があります。',
      signupDescription:
        'アカウントを作成し、1店舗を接続し、Google Maps URL を保存して、そのままダッシュボードに入ります。',
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
        '取込・インサイト・レビュー根拠が一つのループに集約',
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
      shellDescription: '取り込んだレビューから、次に取るべき運営アクションを一つに絞り込みます。',
      currentRestaurant: '現在の店舗',
      connectionHealth: '接続状態',
      restaurantSwitcherLabel: '店舗',
      restaurantSwitcherHint: '今の画面を離れずに対象店舗を切り替えます。',
      restaurantSwitcherReadonly: '現在は 1 店舗のみ接続されています。',
      onboardingEyebrow: '最初のループに入る',
      onboardingTitle: '最初の店舗を接続する',
      onboardingDescription:
        'Sprint 1 は意図的に絞っています。1店舗、1つの Google Maps ソース、1つのダッシュボード、そして 1 つの判断軸です。',
      onboardingSteps: [
        '最初の店舗ワークスペースを作成する。',
        'Google Maps の URL をレビューソースとして保存する。',
        '最初のレビューを公開してシグナルを確認する。',
      ],
      setupTitle: '店舗セットアップ',
      setupDescription:
        '最初の店舗を作成し、Google Maps URL を保存して、実際の運営データを用意します。',
      createRestaurant: '店舗を作成',
      createAnotherRestaurant: '別の店舗を追加',
      restaurantNameLabel: '店舗名',
      restaurantAddressLabel: '住所',
      googleMapsUrlLabel: 'Google Maps URL',
      googleMapsUrlPlaceholder: 'https://maps.google.com/...',
      navDashboard: 'ダッシュボード',
      navReviews: 'レビュー',
      navSettings: '設定',
      dashboardTitle: '運営優先度ダッシュボード',
      dashboardDescription:
        'この画面は「まず何を直すべきか」をすばやく答えられる必要があります。',
      dashboardPrimaryCta: 'レビュー運用状況を確認する',
      dashboardSecondaryCta: '設定を開く',
      reviewsTitle: 'レビュー根拠',
      reviewsDescription:
        '元レビューを根拠として扱い、必要なときだけ評価や日付で絞り込みます。',
      settingsTitle: '店舗設定',
      settingsDescription:
        '店舗プロフィールとソース URL を最新に保ち、データ品質を安定させます。',
      settingsRestaurantTitle: '店舗プロフィール',
      settingsRestaurantDescription:
        '現在のワークスペースで使う店舗名と住所を更新します。',
      settingsSourceTitle: 'レビューソース',
      settingsSourceDescription:
        'Google Maps URL を最新に保ち、入力の再現性を確保します。',
      addRestaurantTitle: '別の店舗を追加',
      addRestaurantDescription:
        '現在のアカウントのまま 2 店舗目を作成できます。',
      saveChanges: '変更を保存',
      saving: '保存中...',
      totalReviews: 'レビュー総数',
      averageRating: '平均評価',
      negativeShare: 'ネガティブ比率',
      sentimentSplit: '感情分布',
      complaintKeywords: '不満キーワード',
      ratingTrend: '評価トレンド',
      reviewEvidence: 'レビュー根拠',
      topIssueTitle: '最重要課題と次の行動',
      topIssueDescription:
        '承認済みデータの中で最も多い不満キーワードと、確認すべき次の一手を示します。',
      topIssueEmpty:
        'まだ主要な不満シグナルがありません。レビューを増やして課題を可視化してください。',
      topIssueLabel: '最重要課題',
      topIssueActionLabel: '次の行動',
      topIssueActionTemplate:
        '「{keyword}」に言及するレビュー{count}件を確認し、最初の改善点を決めましょう。',
      topIssueActionFallback: '直近の証拠を確認し、最初の改善点を決めましょう。',
      topIssueCta: 'レビュー根拠を開く',
      sourceReadiness: 'ソース状態',
      sourceReady: 'Google Maps URL は設定済みです。',
      sourceMissing: 'Google Maps URL が未設定です。',
      intakeReady: '入力の準備ができています。',
      intakeBlocked: '入力前にソース URL を追加してください。',
      sourceStatusConnected: 'ソース準備完了',
      sourceStatusNeedsConfiguration: 'ソース未設定',
      noRestaurants: 'まだ店舗がありません。最初の店舗を作成して製品ループに入ってください。',
      noReviews: 'まだレビューは公開されていません。最初のバッチは管理側でキュレーションと公開が必要です。',
      noComplaints: '繰り返し現れる不満キーワードはまだありません。レビューを増やしてシグナルを作ってください。',
      noTrend: 'レビューが公開されるとトレンドが表示されます。',
      noGoogleMapUrl: '入力前に Google Maps URL が必要です。',
      reviewFilters: 'フィルター',
      filterRating: '評価',
      filterFrom: '開始日',
      filterTo: '終了日',
      applyFilters: '適用',
      clearFilters: 'クリア',
      allRatings: 'すべての評価',
      datePickerPreviousMonth: '???',
      datePickerNextMonth: '???',
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
      operationalPrompt: '店舗単位の運営シグナル',
      protectedAccess: '保護されたアカウントアクセス',
      restaurantScoped: '店舗ごとに 1 つのダッシュボード',
      loadingDashboard: 'ダッシュボードを読み込み中...',
      loadingReviews: 'レビューを読み込み中...',
      loadingRestaurant: '店舗情報を読み込み中...',
      anonymousGuest: '匿名ユーザー',
      noReviewContent: 'レビュー本文がありません。',
      noSourceDate: '日付情報なし',
      validation: {
        restaurantNameRequired: '店舗名を入力してください。',
        restaurantNameTooLong: '店舗名は120文字以内で入力してください。',
        restaurantAddressTooLong: '住所は255文字以内で入力してください。',
        googleMapsUrlInvalid: '有効なURLを入力してください。',
        googleMapsUrlMustBeGoogle: 'Google Maps のURLを入力してください。',
        filterDateRangeInvalid: '開始日は終了日以前である必要があります。',
      },
    },
    feedback: {
      sessionExpired: 'セッションの有効期限が切れました。再度ログインしてください。',
      loadingSession: '安全なセッションを確認しています...',
      saved: '変更を保存しました。',
      errors: {
        refreshSession: 'セッション状態を更新できませんでした。',
        loadRestaurant: '店舗データを読み込めませんでした。',
        loadDashboard: 'ダッシュボードを読み込めませんでした。',
        loadReviews: 'レビューを読み込めませんでした。',
        login: 'ログインできませんでした。',
        signup: 'アカウントを作成できませんでした。',
        createRestaurant: '店舗を作成できませんでした。',
        saveRestaurant: '店舗設定を保存できませんでした。',
      },
    },
  },
} as Record<Language, ProductUiCopy>

export function getProductUiCopy(language: Language) {
  return productUiCopy[language]
}
