export interface MerchantHubCopy {
  brand: string
  productLabel: string
  nowLabel: string
  nextLabel: string
  home: {
    title: string
    description: string
    freshnessLabel: string
    highlightTitle: string
    emptyHighlight: string
    trendTitle: string
    evidenceTitle: string
  }
  reviews: {
    title: string
    description: string
    searchLabel: string
    searchHint: string
  }
  actions: {
    title: string
    description: string
    nowSummary: string
    nextSummary: string
  }
  settings: {
    title: string
    description: string
  }
  nav: {
    home: string
    reviews: string
    actions: string
    settings: string
  }
  states: {
    freshnessNow: string
    freshnessNext: string
    reviewNow: string
    searchNext: string
  }
}

const merchantHubCopyVi: MerchantHubCopy = {
  brand: 'Sentify',
  productLabel: 'Không gian nhà hàng',
  nowLabel: 'Đang dùng',
  nextLabel: 'Sắp có',
  home: {
    title: 'Tổng quan nhà hàng',
    description: 'Nhìn nhanh tình hình quán, phản hồi mới và việc nên xử lý trước trong hôm nay.',
    freshnessLabel: 'Tình trạng dữ liệu',
    highlightTitle: 'Vấn đề nổi bật',
    emptyHighlight: 'Chưa có vấn đề nào lặp lại đủ mạnh. Hãy tiếp tục cập nhật đánh giá để nhìn ra tín hiệu rõ hơn.',
    trendTitle: 'Xu hướng phản hồi',
    evidenceTitle: 'Phản hồi mới',
  },
  reviews: {
    title: 'Đánh giá khách',
    description: 'Đọc phản hồi đã công bố, lọc nhanh theo điểm số và kiểm tra khách đang nói gì về quán.',
    searchLabel: 'Tra cứu đánh giá',
    searchHint: 'Ô tìm kiếm chi tiết sẽ được bổ sung sau. Hiện tại, bạn có thể lọc theo điểm và thời gian.',
  },
  actions: {
    title: 'Việc cần làm',
    description: 'Biến phản hồi của khách thành danh sách việc nên xử lý trước, kèm bằng chứng và gợi ý bước tiếp theo.',
    nowSummary: 'Đây là các việc nên ưu tiên xử lý ngay dựa trên phản hồi hiện có.',
    nextSummary: 'Giao việc, nhắc việc và theo dõi tiến độ sẽ nằm ở lớp vận hành tiếp theo.',
  },
  settings: {
    title: 'Thiết lập nhà hàng',
    description: 'Cập nhật thông tin quán và nguồn Google Maps để màn hình tổng quan luôn bám đúng dữ liệu thực tế.',
  },
  nav: {
    home: 'Tổng quan',
    reviews: 'Đánh giá',
    actions: 'Việc cần làm',
    settings: 'Thiết lập',
  },
  states: {
    freshnessNow: 'Dữ liệu đã sẵn sàng',
    freshnessNext: 'Cần bổ sung dữ liệu',
    reviewNow: 'Đã có phản hồi để xem',
    searchNext: 'Tra cứu nâng cao sẽ có sau',
  },
}

const merchantHubCopyEn: MerchantHubCopy = {
  brand: 'Sentify',
  productLabel: 'Merchant app',
  nowLabel: 'Now',
  nextLabel: 'Next',
  home: {
    title: 'Restaurant overview',
    description: 'See what changed, what guests are saying, and what should be handled first today.',
    freshnessLabel: 'Data freshness',
    highlightTitle: 'Priority issue',
    emptyHighlight: 'No issue is dominant yet. Keep publishing reviews to build a stronger signal.',
    trendTitle: 'Feedback trend',
    evidenceTitle: 'Recent feedback',
  },
  reviews: {
    title: 'Guest reviews',
    description: 'Inspect published reviews, filter quickly, and stay close to the original guest feedback.',
    searchLabel: 'Review lookup',
    searchHint: 'Deep search will come later. For now, use rating and date filters.',
  },
  actions: {
    title: 'Action list',
    description: 'Turn guest feedback into a short list of what to fix first, with evidence and a next step.',
    nowSummary: 'These are the priorities worth acting on right now.',
    nextSummary: 'Assignments, reminders, and follow-up sit in the next execution layer.',
  },
  settings: {
    title: 'Restaurant settings',
    description: 'Keep the restaurant profile and Google Maps source accurate so the product stays trustworthy.',
  },
  nav: {
    home: 'Home',
    reviews: 'Reviews',
    actions: 'Actions',
    settings: 'Settings',
  },
  states: {
    freshnessNow: 'Data is ready',
    freshnessNext: 'More data needed',
    reviewNow: 'Reviews available',
    searchNext: 'Advanced search later',
  },
}

export function getMerchantHubCopy(language: string): MerchantHubCopy {
  return language.startsWith('vi') ? merchantHubCopyVi : merchantHubCopyEn
}

