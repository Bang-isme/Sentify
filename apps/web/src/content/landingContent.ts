export type Language = 'en' | 'vi' | 'ja'

export const landingContent = {
  en: {
    meta: {
      title: 'Sentify | Review Insight For Restaurants',
      description:
        'Sentify helps restaurant owners turn Google Maps reviews into complaint patterns, sentiment signals, and clear operational action.',
    },
    header: {
      brand: 'Sentify',
      nav: [
        { label: 'Overview', href: '#overview' },
        { label: 'Problem', href: '#problem' },
        { label: 'Workflow', href: '#workflow' },
        { label: 'Dashboard', href: '#dashboard' },
        { label: 'Signals', href: '#signals' },
        { label: 'Focus', href: '#sprint-1' },
      ],
      workflowCta: 'How It Works',
      dashboardCta: 'View Dashboard',
      languageLabel: 'Switch language',
      themeLabel: 'Toggle theme',
    },
    hero: {
      badge: 'Sprint 1 MVP',
      titleLine1: 'Reviews in.',
      titleLine2: 'Action out.',
      description:
        'Sentify exists to answer one operating question: what should this restaurant fix first? Connect one review source, detect the complaint pattern, and surface one next action the owner can trust.',
      highlights: [
        'One review source enters the loop',
        'One triage engine turns noise into a priority',
        'One next action leaves the dashboard',
      ],
      primaryCta: 'See How It Works',
      secondaryCta: 'View Dashboard',
    },
    problem: {
      eyebrow: 'The Practical Problem',
      titleLine1: 'Customer feedback exists.',
      titleLine2: 'Insight does not.',
      description:
        'Sentify is built for a narrow but valuable use case: turn restaurant review noise into a short list of operational signals that an owner can act on immediately.',
      points: [
        {
          icon: 'reviews',
          title: 'Reviews arrive faster than owners can read them',
          description:
            'Google Maps keeps collecting feedback every day, but small teams rarely have time to read every review end to end.',
        },
        {
          icon: 'warning',
          title: 'Recurring complaints stay anecdotal',
          description:
            'Without grouping negative feedback, it is hard to tell whether the real issue is waiting time, staff attitude, food quality, or delivery mistakes.',
        },
        {
          icon: 'priority_high',
          title: 'There is no clear next action',
          description:
            'Owners know there is a problem, but they do not know which issue matters most or what to fix first this week.',
        },
      ],
    },
    workflow: {
      eyebrow: 'Product Workflow',
      titleLine1: 'One focused loop.',
      titleLine2: 'One useful outcome.',
      description:
        'Sprint 1 stays deliberately narrow so the product promise stays sharp: one source enters, one decision engine processes, and one action comes out for the owner to execute next.',
      steps: [
        {
          step: '01',
          title: 'Connect one restaurant',
          description:
            'Start with a single restaurant and save the Google Maps page that will act as the review source.',
        },
        {
          step: '02',
          title: 'Bring recent feedback into one place',
          description:
            'Sentify pulls reviews from that source, keeps the dataset tidy, and avoids importing the same review twice.',
        },
        {
          step: '03',
          title: 'Separate praise from recurring complaints',
          description:
            'Positive, neutral, and negative patterns are grouped so the owner can see what guests appreciate and what keeps hurting the experience.',
        },
        {
          step: '04',
          title: 'Review one dashboard and decide next action',
          description:
            'The dashboard turns raw comments into ratings, trends, complaint keywords, and review evidence the team can actually act on.',
        },
      ],
    },
    dashboard: {
      eyebrow: 'Dashboard View',
      titleLine1: 'One screen that explains',
      titleLine2: 'what is really happening',
      description:
        'The point is not to look technical. The point is to help an owner see the pattern, check the evidence, and respond with more confidence.',
      overview: {
        title: 'A dashboard that starts with the signal',
        description:
          'Sentify does not bury the owner in raw text. It opens with the numbers, themes, and review evidence that explain where attention should go next.',
        kpis: [
          ['124', 'Reviews'],
          ['4.2', 'Avg rating'],
          ['31%', 'Negative'],
        ],
        topComplaintsLabel: 'Top complaints',
        complaintRows: [
          ['Wait time', '18 mentions'],
          ['Delivery packaging', '11 mentions'],
          ['Staff attitude', '7 mentions'],
        ],
        recentMovementLabel: 'Recent movement',
      },
      smallCards: [
        {
          icon: 'priority_high',
          tag: 'TOP ISSUES',
          title: 'Complaint keywords',
          description: 'See which negative themes show up most often before they turn into blind spots.',
        },
        {
          icon: 'tune',
          tag: 'QUICK FILTERS',
          title: 'Review evidence',
          description: 'Open the underlying reviews by date and rating instead of trusting a vague summary.',
        },
      ],
      sentiment: {
        badge: 'Sentiment view',
        title: 'Positive, neutral, and negative at a glance',
        description:
          'Owners should not need to read one hundred comments to know the mood has shifted. The breakdown shows direction immediately.',
        rows: [
          { label: 'Positive', value: 54 },
          { label: 'Neutral', value: 15 },
          { label: 'Negative', value: 31 },
        ],
      },
      trend: {
        title: 'Rating trend that reveals whether changes worked',
        description:
          'Weekly or monthly trend lines help the team connect operational changes with guest response instead of relying on gut feeling.',
        pill: 'Weekly and monthly view',
      },
    },
    signals: {
      eyebrow: 'Example Signals',
      description: 'The point is not endless analytics. The point is clearer next steps.',
      cards: [
        {
          badge: { text: 'TOP ISSUE', color: 'red' as const },
          icon: 'schedule',
          title: 'Wait time dominates negative feedback',
          description: 'Late-evening reviews keep repeating the same queue and service delay complaint.',
          metric: '18 mentions',
        },
        {
          badge: { text: 'POSITIVE SHIFT', color: 'green' as const },
          icon: 'mood',
          title: 'Staff friendliness starts recovering',
          description: 'Recent 4-star and 5-star reviews mention better service tone after retraining.',
          metric: '+9 pts',
        },
        {
          badge: { text: 'PATTERN', color: 'blue' as const },
          icon: 'local_shipping',
          title: 'Delivery packaging becomes a repeated theme',
          description: 'Guests are not just unhappy with speed; they are specifically calling out damaged takeaway packaging.',
          metric: '11 mentions',
        },
        {
          badge: null,
          icon: 'trending_up',
          title: 'Trend view shows the menu refresh is helping',
          description: 'Average rating starts climbing again after the menu and plating update, which gives the owner evidence to keep that direction.',
          metric: '4.2 avg',
        },
      ],
    },
    sprint: {
      eyebrow: 'Sprint 1 Focus',
      titleLine1: 'Focused enough to ship.',
      titleLine2: 'Narrow enough to stay honest.',
      inScopeTitle: 'What This Version Already Solves',
      outOfScopeTitle: 'What It Does Not Pretend To Do',
      whyTitle: 'Why This Scope Works',
      inScopeItems: [
        'Connect one restaurant and keep one review source clear',
        'Import Google Maps reviews without duplicate clutter',
        'Read complaint keywords, sentiment split, and rating movement',
        'Filter the original reviews by date and rating when evidence is needed',
        'Give owners one practical view of what to fix first',
      ],
      outOfScopeItems: [
        'No multi-platform import beyond Google Maps in this first cut',
        'No invite flow, billing layer, or expanded team management in this version',
        'No report export, PDF generation, or oversized admin surface',
        'No attempt to solve every analytics problem at once',
      ],
      reasons: [
        'One clear input keeps the user journey easy to understand.',
        'A narrow MVP is easier to trust than a wide but shallow platform promise.',
        'Every section of the product points back to the same goal: clearer action from customer feedback.',
      ],
    },
    trust: {
      eyebrow: 'Trust Signals',
      titleLine1: 'Built to handle feedback',
      titleLine2: 'with discipline.',
      description:
        'Sentify is not trying to sell itself as a giant platform, but it still needs to feel responsible. Restaurant feedback may be small-scale data, yet it still deserves clear boundaries, protected access, and sane guardrails.',
      pillars: [
        {
          icon: 'admin_panel_settings',
          title: 'Restaurant data stays tied to the right account',
          description: 'Even in Sprint 1, the product is built around the idea that one restaurant should not casually see another restaurant’s feedback.',
        },
        {
          icon: 'verified_user',
          title: 'Access is protected instead of left loose',
          description: 'The landing page does not need to expose implementation detail, but the product should still communicate that access is protected and handled responsibly.',
        },
        {
          icon: 'shield_with_heart',
          title: 'Guardrails exist before the dashboard does',
          description: 'Input checks and request limits help keep the product stable instead of treating safety as a feature for later.',
        },
      ],
    },
    cta: {
      titleLine1: 'A smaller promise.',
      titleLine2: 'A more useful product.',
      description:
        'Sentify should feel singular, not broad: one source of guest feedback, one triage loop, and one decision the team can act on with confidence.',
      primaryCta: 'Review The Flow',
      secondaryCta: 'Back To Top',
      chips: ['One source in', 'One priority out', 'One dashboard per restaurant'],
    },
    footer: {
      description:
        'A focused product introduction for turning restaurant reviews into complaint patterns, sentiment signals, and clearer next actions.',
      columns: [
        {
          title: 'Explore',
          links: [
            ['Overview', '#overview'],
            ['Problem', '#problem'],
            ['Workflow', '#workflow'],
            ['Dashboard', '#dashboard'],
          ],
        },
        {
          title: 'Signals',
          links: [
            ['Complaint keywords', '#signals'],
            ['Sentiment view', '#dashboard'],
            ['Rating trend', '#dashboard'],
            ['Sprint focus', '#sprint-1'],
          ],
        },
        {
          title: 'Project',
          links: [
            ['Trust', '#trust'],
            ['Workflow loop', '#workflow'],
            ['Dashboard summary', '#dashboard'],
            ['Back to top', '#overview'],
          ],
        },
      ],
      bottomLeft:
        'Sentify project landing page. Sprint 1 is about review import, insight extraction, and one clear dashboard.',
      bottomRight: 'Built to answer one operating question well.',
    },
    ticker: [
      'Import Google Maps reviews',
      'Skip duplicate review records',
      'Rank recurring complaint keywords',
      'Track positive, neutral, and negative movement',
      'Filter review evidence by date and rating',
      'Follow rating trend by week or month',
    ],
    globe: {
      insights: [
        {
          id: 1,
          avatar: 'US',
          name: 'Mia Chen',
          location: 'New York, US',
          text: '"Wait time keeps showing up in negative dinner reviews."',
          metric: '18x',
          metricLabel: 'Mentions',
        },
        {
          id: 2,
          avatar: 'GB',
          name: 'Luca Wright',
          location: 'London, UK',
          text: '"Service friendliness is climbing back into positive reviews."',
          metric: '+9',
          metricLabel: 'Trend',
        },
        {
          id: 3,
          avatar: 'JP',
          name: 'Yuki Tanaka',
          location: 'Tokyo, JP',
          text: '"Lunch-hour reviews dip when queue time crosses twenty minutes."',
          metric: 'Noon',
          metricLabel: 'Window',
        },
        {
          id: 4,
          avatar: 'BR',
          name: 'Ana Silva',
          location: 'Sao Paulo, BR',
          text: '"Delivery packaging is now one of the main complaint keywords."',
          metric: '11x',
          metricLabel: 'Pattern',
        },
        {
          id: 5,
          avatar: 'IN',
          name: 'Raj Patel',
          location: 'Mumbai, IN',
          text: '"Average rating is recovering after the menu refresh."',
          metric: '4.2',
          metricLabel: 'Rating',
        },
      ],
    },
  },
  vi: {
    meta: {
      title: 'Sentify | Phân tích review cho nhà hàng',
      description:
        'Sentify giúp chủ nhà hàng biến review từ Google Maps thành nhóm phàn nàn lặp lại, tín hiệu cảm xúc và hướng xử lý rõ ràng.',
    },
    header: {
      brand: 'Sentify',
      nav: [
        { label: 'Tổng quan', href: '#overview' },
        { label: 'Vấn đề', href: '#problem' },
        { label: 'Quy trình', href: '#workflow' },
        { label: 'Dashboard', href: '#dashboard' },
        { label: 'Tín hiệu', href: '#signals' },
        { label: 'Phạm vi', href: '#sprint-1' },
      ],
      workflowCta: 'Cách hoạt động',
      dashboardCta: 'Xem dashboard',
      languageLabel: 'Đổi ngôn ngữ',
      themeLabel: 'Đổi giao diện',
    },
    hero: {
      badge: 'Sprint 1 MVP',
      titleLine1: 'Review đổ về.',
      titleLine2: 'Việc cần làm hiện ra.',
      description:
        'Sentify giúp chủ nhà hàng biến những đoạn review rời rạc thành một danh sách việc cần xử lý rõ ràng. Chỉ cần lấy review từ Google Maps, nhận diện các phàn nàn lặp lại, rồi mở một dashboard duy nhất để biết điều gì cần ưu tiên.',
      highlights: [
        'Import review từ Google Maps',
        'Nhìn ra phàn nàn lặp lại nhanh hơn',
        'Theo dõi biến động rating và sentiment',
      ],
      primaryCta: 'Xem cách hoạt động',
      secondaryCta: 'Xem dashboard',
    },
    problem: {
      eyebrow: 'Bài toán thực tế',
      titleLine1: 'Review thì có sẵn.',
      titleLine2: 'Insight thì chưa.',
      description:
        'Sentify chỉ giải một việc hẹp nhưng có giá trị: biến dòng review ồn ào thành một danh sách tín hiệu vận hành mà chủ quán có thể dùng ngay.',
      points: [
        {
          icon: 'reviews',
          title: 'Review đến nhanh hơn tốc độ chủ quán có thể đọc',
          description:
            'Google Maps tiếp tục thu thập phản hồi mỗi ngày, nhưng các đội nhỏ hiếm khi có thời gian đọc từng review từ đầu đến cuối.',
        },
        {
          icon: 'warning',
          title: 'Những lời phàn nàn lặp lại vẫn chỉ dừng ở mức cảm giác',
          description:
            'Nếu không nhóm các review tiêu cực lại, rất khó biết vấn đề thật sự nằm ở thời gian chờ, thái độ phục vụ, chất lượng món hay giao hàng.',
        },
        {
          icon: 'priority_high',
          title: 'Không rõ nên xử lý việc gì trước',
          description:
            'Chủ quán biết là có vấn đề, nhưng không rõ điều gì đang ảnh hưởng lớn nhất và tuần này nên sửa cái nào trước.',
        },
      ],
    },
    workflow: {
      eyebrow: 'Quy trình sản phẩm',
      titleLine1: 'Một vòng lặp tập trung.',
      titleLine2: 'Một kết quả hữu ích.',
      description:
        'Sprint 1 của Sentify cố ý giữ phạm vi hẹp: một nguồn review, một luồng nhà hàng, một dashboard, và một câu hỏi duy nhất: việc gì nên được ưu tiên xử lý trước?',
      steps: [
        {
          step: '01',
          title: 'Kết nối một nhà hàng',
          description:
            'Bắt đầu với một nhà hàng cụ thể và lưu trang Google Maps sẽ được dùng làm nguồn review.',
        },
        {
          step: '02',
          title: 'Kéo review về một chỗ',
          description:
            'Sentify lấy review từ nguồn đó, làm gọn dữ liệu, và không nhập lại những review đã tồn tại.',
        },
        {
          step: '03',
          title: 'Tách lời khen khỏi phàn nàn lặp lại',
          description:
            'Review được nhóm thành tích cực, trung lập và tiêu cực để chủ quán thấy rõ khách đang đánh giá tốt điều gì và đang không hài lòng ở đâu.',
        },
        {
          step: '04',
          title: 'Mở dashboard và chốt việc ưu tiên',
          description:
            'Dashboard biến comment thuần thành rating, xu hướng, từ khóa phàn nàn và bằng chứng review để đội ngũ có thể ra quyết định.',
        },
      ],
    },
    dashboard: {
      eyebrow: 'Góc nhìn dashboard',
      titleLine1: 'Một màn hình đủ để hiểu',
      titleLine2: 'chuyện gì đang diễn ra',
      description:
        'Mục tiêu không phải là trông thật kỹ thuật. Mục tiêu là giúp chủ quán thấy mẫu vấn đề, kiểm chứng bằng review gốc, và tự tin hơn khi hành động.',
      overview: {
        title: 'Dashboard bắt đầu từ tín hiệu quan trọng',
        description:
          'Sentify không ném chủ quán vào một dòng text dài. Màn hình mở đầu bằng số liệu, chủ đề và review gốc để giải thích xem điều gì cần được ưu tiên.',
        kpis: [
          ['124', 'Review'],
          ['4.2', 'Điểm TB'],
          ['31%', 'Tiêu cực'],
        ],
        topComplaintsLabel: 'Phàn nàn nổi bật',
        complaintRows: [
          ['Chờ lâu', '18 lần nhắc'],
          ['Đóng gói giao hàng', '11 lần nhắc'],
          ['Thái độ phục vụ', '7 lần nhắc'],
        ],
        recentMovementLabel: 'Biến động gần đây',
      },
      smallCards: [
        {
          icon: 'priority_high',
          tag: 'VẤN ĐỀ CHÍNH',
          title: 'Từ khóa phàn nàn',
          description: 'Thấy những chủ đề tiêu cực lặp lại nhiều nhất trước khi đội ngũ bỏ sót chúng.',
        },
        {
          icon: 'tune',
          tag: 'LỌC NHANH',
          title: 'Review gốc',
          description: 'Mở lại đúng review theo ngày và rating thay vì chỉ nhìn một bản tổng hợp mơ hồ.',
        },
      ],
      sentiment: {
        badge: 'Bức tranh sentiment',
        title: 'Tích cực, trung lập, tiêu cực trong một cái nhìn',
        description:
          'Chủ quán không cần đọc hàng trăm review mới biết tâm lý khách hàng đang dịch chuyển. Tỷ lệ tổng hợp đã cho thấy hướng biến động.',
        rows: [
          { label: 'Tích cực', value: 54 },
          { label: 'Trung lập', value: 15 },
          { label: 'Tiêu cực', value: 31 },
        ],
      },
      trend: {
        title: 'Xu hướng rating để biết thay đổi có hiệu quả hay không',
        description:
          'Biểu đồ theo tuần hoặc tháng giúp đội ngũ liên kết thay đổi vận hành với phản ứng của khách, thay vì chỉ đoán bằng cảm giác.',
        pill: 'Xem theo tuần hoặc tháng',
      },
    },
    signals: {
      eyebrow: 'Ví dụ tín hiệu',
      description: 'Mục tiêu không phải là thêm analytics vô tận. Mục tiêu là làm rõ bước tiếp theo cần xử lý.',
      cards: [
        {
          badge: { text: 'VẤN ĐỀ CHÍNH', color: 'red' as const },
          icon: 'schedule',
          title: 'Thời gian chờ đang chiếm phần lớn review tiêu cực',
          description: 'Các review buổi tối lặp đi lặp lại cùng một vấn đề: xếp hàng và phục vụ chậm.',
          metric: '18 lần nhắc',
        },
        {
          badge: { text: 'ĐANG TỐT LÊN', color: 'green' as const },
          icon: 'mood',
          title: 'Thái độ phục vụ bắt đầu hồi phục',
          description: 'Review 4 sao và 5 sao gần đây nhắc đến trải nghiệm phục vụ tích cực hơn sau khi đội ngũ được nhắc lại cách giao tiếp.',
          metric: '+9 điểm',
        },
        {
          badge: { text: 'MẪU LẶP LẠI', color: 'blue' as const },
          icon: 'local_shipping',
          title: 'Đóng gói giao hàng trở thành chủ đề lặp lại',
          description: 'Khách không chỉ than phiền về tốc độ. Họ đang nhắc rõ đến bao bì takeaway bị vỡ, bẹp hoặc kém chắc chắn.',
          metric: '11 lần nhắc',
        },
        {
          badge: null,
          icon: 'trending_up',
          title: 'Xu hướng cho thấy việc đổi menu đang có tác dụng',
          description: 'Điểm trung bình bắt đầu quay lại sau khi menu và cách trình bày được điều chỉnh, giúp chủ quán có cơ sở để tiếp tục hướng này.',
          metric: '4.2 điểm',
        },
      ],
    },
    sprint: {
      eyebrow: 'Trọng tâm Sprint 1',
      titleLine1: 'Gọn để có thể ship.',
      titleLine2: 'Hẹp để vẫn trung thực.',
      inScopeTitle: 'Phiên bản này đã giải được gì',
      outOfScopeTitle: 'Phiên bản này không cố gắng ôm tất cả',
      whyTitle: 'Vì sao phạm vi này hợp lý',
      inScopeItems: [
        'Gắn một nhà hàng với một nguồn review rõ ràng',
        'Import review Google Maps mà không bị lặp dữ liệu',
        'Đọc từ khóa phàn nàn, sentiment và xu hướng rating',
        'Mở review gốc theo bộ lọc ngày và rating khi cần kiểm chứng',
        'Giúp chủ quán có một màn hình để biết việc gì nên làm trước',
      ],
      outOfScopeItems: [
        'Chưa mở rộng sang các nền tảng khác ngoài Google Maps',
        'Chưa làm luồng mời thành viên, billing hay quản lý đội ngũ mở rộng',
        'Chưa có xuất báo cáo, PDF hay bộ admin quá to',
        'Không cố gắng biến Sprint 1 thành một bộ analytics tổng hợp cho mọi bài toán',
      ],
      reasons: [
        'Một đầu vào rõ ràng giúp user flow dễ hiểu và dễ dùng.',
        'MVP hẹp thường dễ tin hơn một lời hứa rộng nhưng mỏng.',
        'Mọi section đều quay về cùng một mục tiêu: biến review thành hướng xử lý rõ ràng.',
      ],
    },
    trust: {
      eyebrow: 'Tín hiệu tin cậy',
      titleLine1: 'Dữ liệu review vẫn cần được xử lý',
      titleLine2: 'một cách kỷ luật.',
      description:
        'Sentify không tự nhận là một siêu nền tảng, nhưng sản phẩm vẫn phải tạo cảm giác đáng tin. Review của nhà hàng có thể nhỏ về quy mô, nhưng vẫn cần ranh giới rõ, truy cập được bảo vệ và guardrail hợp lý.',
      pillars: [
        {
          icon: 'admin_panel_settings',
          title: 'Dữ liệu của từng nhà hàng phải nằm đúng chỗ',
          description: 'Ngay cả trong Sprint 1, sản phẩm đã được nghĩ theo hướng một nhà hàng không thể vô tình thấy review của nhà hàng khác.',
        },
        {
          icon: 'verified_user',
          title: 'Truy cập được bảo vệ, không thả nổi',
          description: 'Landing page không cần khoe chi tiết kỹ thuật, nhưng sản phẩm vẫn nên truyền tải rõ rằng việc truy cập được xử lý nghiêm túc.',
        },
        {
          icon: 'shield_with_heart',
          title: 'Guardrail có trước khi dashboard hoàn thiện',
          description: 'Kiểm tra input và giới hạn request giúp hệ thống ổn định hơn, thay vì để an toàn thành việc để sau.',
        },
      ],
    },
    cta: {
      titleLine1: 'Lời hứa nhỏ hơn.',
      titleLine2: 'Giá trị hữu ích hơn.',
      description:
        'Trong Sprint 1, Sentify chỉ tập trung vào một việc: giúp chủ nhà hàng biết khách đang khen điều gì, đang phàn nàn điều gì, và điều nào nên được ưu tiên xử lý trước.',
      primaryCta: 'Xem luồng sản phẩm',
      secondaryCta: 'Lên đầu trang',
      chips: ['Import review Google Maps', 'Insight ưu tiên từ phàn nàn', 'Một dashboard cho từng nhà hàng'],
    },
    footer: {
      description:
        'Trang giới thiệu tập trung vào việc biến review nhà hàng thành nhóm phàn nàn, tín hiệu sentiment và bước xử lý rõ ràng hơn.',
      columns: [
        {
          title: 'Khám phá',
          links: [
            ['Tổng quan', '#overview'],
            ['Vấn đề', '#problem'],
            ['Quy trình', '#workflow'],
            ['Dashboard', '#dashboard'],
          ],
        },
        {
          title: 'Tín hiệu',
          links: [
            ['Từ khóa phàn nàn', '#signals'],
            ['Sentiment', '#dashboard'],
            ['Xu hướng rating', '#dashboard'],
            ['Phạm vi Sprint 1', '#sprint-1'],
          ],
        },
        {
          title: 'Dự án',
          links: [
            ['Tin cậy', '#trust'],
            ['Quy trình sản phẩm', '#workflow'],
            ['Tổng quan dashboard', '#dashboard'],
            ['Lên đầu trang', '#overview'],
          ],
        },
      ],
      bottomLeft:
        'Trang giới thiệu Sentify. Sprint 1 tập trung vào import review, rút insight và một dashboard để ra quyết định nhanh hơn.',
      bottomRight: 'Ưu tiên sự rõ ràng, không dựng một nền tảng quá đà.',
    },
    ticker: [
      'Import review từ Google Maps',
      'Bỏ qua review trùng lặp một cách tự động',
      'Xếp hạng từ khóa phàn nàn lặp lại',
      'Theo dõi tỷ lệ tích cực, trung lập, tiêu cực',
      'Lọc review gốc theo ngày và rating',
      'Xem xu hướng rating theo tuần hoặc tháng',
    ],
    globe: {
      insights: [
        {
          id: 1,
          avatar: 'US',
          name: 'Mia Chen',
          location: 'New York, Mỹ',
          text: '"Phàn nàn về chờ lâu lặp lại trong review buổi tối."',
          metric: '18x',
          metricLabel: 'Lần nhắc',
        },
        {
          id: 2,
          avatar: 'GB',
          name: 'Luca Wright',
          location: 'London, Anh',
          text: '"Thái độ phục vụ đang quay lại nhóm review tích cực."',
          metric: '+9',
          metricLabel: 'Xu hướng',
        },
        {
          id: 3,
          avatar: 'JP',
          name: 'Yuki Tanaka',
          location: 'Tokyo, Nhật',
          text: '"Review bữa trưa giảm khi thời gian xếp hàng vượt quá hai mươi phút."',
          metric: 'Trưa',
          metricLabel: 'Khung giờ',
        },
        {
          id: 4,
          avatar: 'BR',
          name: 'Ana Silva',
          location: 'Sao Paulo, Brazil',
          text: '"Đóng gói giao hàng đã thành một từ khóa phàn nàn lặp lại."',
          metric: '11x',
          metricLabel: 'Mẫu lặp',
        },
        {
          id: 5,
          avatar: 'IN',
          name: 'Raj Patel',
          location: 'Mumbai, Ấn Độ',
          text: '"Điểm trung bình đang hồi phục sau khi cập nhật menu."',
          metric: '4.2',
          metricLabel: 'Rating',
        },
      ],
    },
  },

  ja: {
    meta: {
      title: 'Sentify | レストランレビューを次の行動へ',
      description:
        'Sentify は Google Maps レビューを、繰り返し発生する不満、感情の傾向、優先度の高い改善アクションへ整理します。',
    },
    header: {
      brand: 'Sentify',
      nav: [
        { label: '概要', href: '#overview' },
        { label: '課題', href: '#problem' },
        { label: '流れ', href: '#workflow' },
        { label: 'ダッシュボード', href: '#dashboard' },
        { label: 'シグナル', href: '#signals' },
        { label: '範囲', href: '#sprint-1' },
      ],
      workflowCta: '流れを見る',
      dashboardCta: 'ダッシュボードを見る',
      languageLabel: '表示言語を切り替える',
      themeLabel: 'テーマを切り替える',
    },
    hero: {
      badge: 'Sprint 1 MVP',
      titleLine1: 'レビューが集まる。',
      titleLine2: '次の一手が見える。',
      description:
        'Sentify はレストラン向けの AI Customer Insight Engine です。Google Maps の URL を登録し、レビューを取り込み、繰り返し出る不満を見つけ、まず対応すべき内容を 1 つの画面に整理します。',
      highlights: [
        'Google Maps レビュー取り込み',
        '店舗ごとの感情内訳',
        '不満キーワードの抽出',
      ],
      primaryCta: 'プロダクトの流れを見る',
      secondaryCta: 'ダッシュボードを見る',
    },
    problem: {
      eyebrow: '課題',
      titleLine1: 'レビューは増える。',
      titleLine2: 'でも判断材料にはなりにくい。',
      description:
        '多くの店舗オーナーはレビューを読んではいても、どの問題が繰り返されているのか、どれを先に直すべきかを素早く整理できていません。',
      points: [
        {
          icon: 'reviews',
          title: 'レビューが多く、読み返すだけで時間を取られる',
          description:
            'Google Maps のレビューが増えるほど、内容の確認と分類が手作業になり、店舗運営の時間を圧迫します。',
        },
        {
          icon: 'warning',
          title: '同じ不満が繰り返されても見逃しやすい',
          description:
            '接客、待ち時間、料理の品質などの問題が散らばって現れるため、傾向として把握しにくくなります。',
        },
        {
          icon: 'priority_high',
          title: 'どこから改善するべきか決めにくい',
          description:
            '感覚ではなく、件数と傾向をもとに優先順位をつけられる画面が必要です。',
        },
      ],
    },
    workflow: {
      eyebrow: 'ワークフロー',
      titleLine1: 'Sprint 1 で実現する',
      titleLine2: '最短の改善フロー',
      description:
        'Sprint 1 の Sentify は、1 店舗の登録、1 本の Google Maps URL、1 回のレビュー取り込み、1 つのダッシュボードに絞って、価値が伝わる最短ループを作ります。',
      steps: [
        {
          step: '01',
          title: 'アカウントを作成する',
          description:
            'まず 1 人のオーナーとして登録し、レビューを見たい店舗を 1 つ作成します。',
        },
        {
          step: '02',
          title: 'Google Maps の URL を保存する',
          description:
            '店舗ごとに 1 本の URL を登録し、以後の取り込み元を明確にします。',
        },
        {
          step: '03',
          title: 'レビューを取り込んで重複を除外する',
          description:
            'Sentify がレビューを取得し、既存データと照合して重複をスキップします。',
        },
        {
          step: '04',
          title: 'ダッシュボードで優先課題を確認する',
          description:
            '感情比率、頻出する不満、推移を 1 画面で見て、次に直すべきことを判断します。',
        },
      ],
    },
    dashboard: {
      eyebrow: 'ダッシュボード',
      titleLine1: '1 画面で',
      titleLine2: '変化と課題をつかむ',
      description:
        'レビュー一覧だけではなく、感情の比率、主要な不満、期間ごとの傾向までまとめて確認できます。',
      overview: {
        title: '改善判断のための要約ビュー',
        description:
          'Sentify はレビュー原文を並べるだけではなく、件数と傾向を要約して、現場で判断しやすい形に整えます。',
        kpis: [
          ['124', '総レビュー数'],
          ['4.2', '平均評価'],
          ['31%', 'ネガティブ率'],
        ],
        topComplaintsLabel: '主な不満',
        complaintRows: [
          ['待ち時間', '18件'],
          ['接客対応', '11件'],
          ['味', '7件'],
        ],
        recentMovementLabel: '直近の変化',
      },
      smallCards: [
        {
          icon: 'priority_high',
          tag: '優先',
          title: '最優先の改善項目',
          description: '件数の多い不満から、まず対処すべき課題を明確にします。',
        },
        {
          icon: 'tune',
          tag: 'フィルター',
          title: 'レビューを素早く絞り込む',
          description: '評価や期間で絞り込み、気になる変化だけを確認できます。',
        },
      ],
      sentiment: {
        badge: '感情内訳',
        title: 'ポジティブ・中立・ネガティブを把握',
        description:
          '店舗全体の雰囲気が改善しているのか悪化しているのかを、レビュー全体の比率で確認します。',
        rows: [
          { label: 'ポジティブ', value: 54 },
          { label: '中立', value: 15 },
          { label: 'ネガティブ', value: 31 },
        ],
      },
      trend: {
        title: '期間ごとの評価推移',
        description:
          '週次または月次で変化を追い、改善施策の前後で傾向がどう動いたかを見られます。',
        pill: '週次 / 月次',
      },
    },
    signals: {
      eyebrow: 'シグナル',
      description: 'レビューを読んだ結果ではなく、すぐ行動に移せる形で示します。',
      cards: [
        {
          badge: { text: '増加中', color: 'red' as const },
          icon: 'schedule',
          title: '待ち時間に関する不満が増えている',
          description: '来店ピーク帯で待機に触れるレビューが増え、運営改善の優先度が上がっています。',
          metric: '18件',
        },
        {
          badge: { text: '改善', color: 'green' as const },
          icon: 'mood',
          title: '接客に関する反応が安定している',
          description: '直近 4 週間で接客に関するネガティブ表現が減り、全体評価を支えています。',
          metric: '+9 pt',
        },
        {
          badge: { text: '継続監視', color: 'blue' as const },
          icon: 'local_shipping',
          title: '提供スピードへの言及が続いている',
          description: '改善傾向はあるものの、提供時間に関する指摘がまだ残っています。',
          metric: '11件',
        },
        {
          badge: null,
          icon: 'trending_up',
          title: '平均評価は持ち直している',
          description: '全体評価は上向いていますが、主要不満が解消しなければ再び悪化する可能性があります。',
          metric: '4.2 平均',
        },
      ],
    },
    sprint: {
      eyebrow: 'Sprint 1 の範囲',
      titleLine1: '最初に作るのは',
      titleLine2: '価値が見える最小構成',
      inScopeTitle: '今回含めるもの',
      outOfScopeTitle: '今回は含めないもの',
      whyTitle: 'この切り方にする理由',
      inScopeItems: [
        '1 ユーザー 1 店舗から始める基本フロー',
        'Google Maps URL からのレビュー取り込み',
        'レビュー一覧と条件フィルター',
        '感情比率と不満キーワードの可視化',
        'ダッシュボードでの優先度確認',
      ],
      outOfScopeItems: [
        'Google Maps 以外の複数プラットフォーム連携',
        'チーム招待や複雑な権限管理',
        'PDF レポートや高度なエクスポート',
        'サブスクリプションや課金機能',
      ],
      reasons: [
        'まずは 1 店舗の改善判断に集中するためです。',
        'MVP として価値が通る最短ループを確認するためです。',
        '将来の拡張よりも、今の体験を確実に成立させるためです。',
      ],
    },
    trust: {
      eyebrow: '信頼性',
      titleLine1: '店舗の判断を支えるための',
      titleLine2: '実務的な設計',
      description:
        'Sentify は派手な演出ではなく、レビューの重複排除、店舗単位の管理、継続的な確認という実務に必要な土台を優先しています。',
      pillars: [
        {
          icon: 'admin_panel_settings',
          title: '店舗単位で整理されたデータ',
          description: 'Sprint 1 では店舗単位でレビューと集計を管理し、対象がぶれないようにします。',
        },
        {
          icon: 'verified_user',
          title: 'ログイン前提の安全なアクセス',
          description: 'ユーザーごとにアクセスを分け、対象店舗だけに絞って情報を扱います。',
        },
        {
          icon: 'shield_with_heart',
          title: '改善判断のための要約指標',
          description: '生レビューだけでなく、割合や頻出キーワードとして判断しやすく提示します。',
        },
      ],
    },
    cta: {
      titleLine1: 'レビューを読むだけで終わらせず、',
      titleLine2: '次の改善につなげる。',
      description:
        'Sprint 1 の Sentify は、レビューの収集から要約までをつなぎ、レストランオーナーが最初の改善判断を下せる状態を目指します。',
      primaryCta: 'ダッシュボードを見る',
      secondaryCta: '流れを確認する',
      chips: ['Google Maps レビュー連携', '感情の可視化', '店舗ごとの要約'],
    },
    footer: {
      description:
        'Sentify はレビューを、優先順位のある改善アクションへつなげるレストラン向けプロダクトです。',
      columns: [
        {
          title: '概要',
          links: [
            ['概要', '#overview'],
            ['課題', '#problem'],
            ['流れ', '#workflow'],
            ['ダッシュボード', '#dashboard'],
          ],
        },
        {
          title: '機能',
          links: [
            ['シグナル', '#signals'],
            ['ダッシュボード', '#dashboard'],
            ['感情分析', '#dashboard'],
            ['Sprint 1 の範囲', '#sprint-1'],
          ],
        },
        {
          title: '価値',
          links: [
            ['信頼性', '#trust'],
            ['ワークフロー', '#workflow'],
            ['改善の優先順位', '#dashboard'],
            ['プロダクト概要', '#overview'],
          ],
        },
      ],
      bottomLeft:
        'Sentify ランディングページ。Sprint 1 の目的と、店舗レビューを整理する MVP の価値を紹介しています。',
      bottomRight: 'レストラン向けレビューインサイト',
    },
    ticker: [
      'Google Maps レビュー取り込み',
      'ネガティブ傾向の把握',
      '不満キーワードの抽出',
      '週次・月次トレンド確認',
      '店舗ごとの感情比率',
      '改善優先度の可視化',
    ],
    globe: {
      insights: [
        {
          id: 1,
          avatar: 'US',
          name: 'Mia Chen',
          location: 'シアトル、米国',
          text: '待ち時間の不満がランチ帯に集中しています。',
          metric: '18x',
          metricLabel: '頻出',
        },
        {
          id: 2,
          avatar: 'GB',
          name: 'Luca Wright',
          location: 'ロンドン、英国',
          text: '接客に対する好意的な表現が増えています。',
          metric: '+9',
          metricLabel: '改善',
        },
        {
          id: 3,
          avatar: 'JP',
          name: 'Yuki Tanaka',
          location: '東京、日本',
          text: '料理の提供時間に触れるレビューが 20 件を超えました。',
          metric: '20',
          metricLabel: '件数',
        },
        {
          id: 4,
          avatar: 'BR',
          name: 'Ana Silva',
          location: 'サンパウロ、ブラジル',
          text: '味に関する否定的な表現が再び増えています。',
          metric: '11x',
          metricLabel: '監視',
        },
        {
          id: 5,
          avatar: 'IN',
          name: 'Raj Patel',
          location: 'ムンバイ、インド',
          text: '平均評価は上昇していますが、接客課題は残っています。',
          metric: '4.2',
          metricLabel: '平均',
        },
      ],
    },
  },
} as const

export type LandingContent = (typeof landingContent)[Language]
