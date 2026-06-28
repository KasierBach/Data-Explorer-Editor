import { normalizeAppLang, pickLocalizedText, type AppLang } from '@/core/utils/i18n';

export type ChangelogIconKey =
  | 'sparkles'
  | 'database'
  | 'code2'
  | 'shieldCheck'
  | 'zap'
  | 'globe'
  | 'testTube'
  | 'fileCode'
  | 'settings'
  | 'users';

export interface ChangelogFeature {
  icon: ChangelogIconKey;
  title: string;
  description: string;
}

export interface ChangelogRelease {
  version: string;
  date: string;
  title: string;
  badge?: string;
  features: ChangelogFeature[];
}

export interface ChangelogPageContent {
  seoTitle: string;
  seoDescription: string;
  heading: string;
  subtitle: string;
  releases: ChangelogRelease[];
}

function feature(
  lang: AppLang,
  icon: ChangelogIconKey,
  viTitle: string,
  enTitle: string,
  viDescription: string,
  enDescription: string,
): ChangelogFeature {
  return {
    icon,
    title: pickLocalizedText(lang, viTitle, enTitle),
    description: pickLocalizedText(lang, viDescription, enDescription),
  };
}

export function getChangelogPageContent(
  lang: AppLang | string | null | undefined,
): ChangelogPageContent {
  const currentLang = normalizeAppLang(lang);

  return {
    seoTitle: 'Changelog | Data Explorer',
    seoDescription: pickLocalizedText(
      currentLang,
      'Những cập nhật mới nhất của nền tảng Data Explorer.',
      'The latest updates from the Data Explorer platform.',
    ),
    heading: pickLocalizedText(currentLang, 'Bản ghi cập nhật', 'Changelog'),
    subtitle: pickLocalizedText(
      currentLang,
      'Theo dõi hành trình phát triển của hệ quản trị cơ sở dữ liệu thế hệ mới.',
      'Track the journey of the next-generation database management IDE.',
    ),
    releases: [
      {
        version: 'v3.6.4',
        date: pickLocalizedText(currentLang, '22 tháng 6, 2026', 'June 22, 2026'),
        title: pickLocalizedText(
          currentLang,
          'Cấu hình AI linh hoạt, query guard thông minh & phủ song ngữ rộng hơn',
          'Flexible AI Configuration, Smarter Query Guards & Broader Localization',
        ),
        badge: pickLocalizedText(currentLang, 'Mới nhất', 'Latest'),
        features: [
          feature(
            currentLang,
            'settings',
            'Cấu hình AI theo vai trò & provider tùy chỉnh',
            'Role-based AI configuration & custom providers',
            'Thêm trung tâm cấu hình AI riêng để chọn model cho Assistant, Explain, SQL và NoSQL, đồng thời lưu provider OpenAI-compatible tùy chỉnh với model mặc định riêng cho từng nguồn.',
            'Added a dedicated AI configuration hub for Assistant, Explain, SQL, and NoSQL model selection, plus custom OpenAI-compatible providers with their own default models.',
          ),
          feature(
            currentLang,
            'shieldCheck',
            'Cảnh báo truy vấn bớt ồn và đúng trọng tâm hơn',
            'Higher-signal query safety warnings',
            'Siết lại lớp phân tích truy vấn để chỉ nâng cảnh báo ở các thao tác thật sự rủi ro, giảm cảnh báo giả cho những lệnh tạo dữ liệu thông thường và làm rõ lý do trước khi chạy.',
            'Tightened query analysis so warnings focus on genuinely risky actions, cut down false alarms on routine creation flows, and explain the reason more clearly before execution.',
          ),
          feature(
            currentLang,
            'code2',
            'AI Explain và SQL Steps liền mạch hơn trong editor',
            'Smoother AI Explain and SQL Steps inside the editor',
            'Bổ sung luồng giải thích truy vấn bằng AI, dialog SQL Steps để sắp xếp và chạy tuần tự nhiều đoạn SQL, cùng các tinh chỉnh toolbar giúp workflow trong editor mạch lạc hơn.',
            'Added AI-powered query explanation, an SQL Steps dialog for reordering and running multi-step SQL sequences, and toolbar refinements that make the editor workflow feel more cohesive.',
          ),
          feature(
            currentLang,
            'zap',
            'Tối ưu hot-path thật và có benchmark đi kèm',
            'Hot-path performance backed by real benchmarks',
            'Tăng tốc table-window browsing, adaptive migration batching, search indexing và các đường đọc dữ liệu quan trọng, đồng thời công bố baseline hiệu năng để theo dõi các đợt tối ưu sau.',
            'Accelerated table-window browsing, adaptive migration batching, search indexing, and other critical data-access paths while publishing a real performance baseline for future tuning passes.',
          ),
          feature(
            currentLang,
            'globe',
            'Phủ song ngữ sâu hơn cho workspace, docs và landing',
            'Deeper bilingual coverage for workspace, docs, and landing',
            'Mở rộng shared content map và i18n cho nhiều màn hình hơn, giúp các khu vực workspace, tài liệu và landing giữ ngữ nghĩa nhất quán hơn giữa tiếng Việt và tiếng Anh.',
            'Expanded the shared content map and i18n coverage so more workspace, documentation, and landing surfaces stay semantically consistent in Vietnamese and English.',
          ),
        ],
      },
      {
        version: 'v3.6.3',
        date: pickLocalizedText(currentLang, '13 tháng 6, 2026', 'June 13, 2026'),
        title: pickLocalizedText(
          currentLang,
          'AI đầu ra thống nhất, NoSQL hành động được & runtime gọn hơn',
          'Unified AI Outputs, Actionable NoSQL & Leaner Runtime',
        ),
        features: [
          feature(
            currentLang,
            'sparkles',
            'Structured outputs dùng chung cho chat, SQL và NoSQL',
            'Shared structured outputs across chat, SQL, and NoSQL',
            'Hợp nhất cơ chế đầu ra có cấu trúc để AI trả lời ổn định hơn giữa chat tự do, sinh SQL và luồng hỗ trợ NoSQL, giảm nhánh xử lý riêng và giúp kết quả dễ tái sử dụng hơn.',
            'Unified structured outputs so freeform chat, SQL generation, and NoSQL assistance behave more consistently while reducing one-off parsing paths and making results easier to reuse.',
          ),
          feature(
            currentLang,
            'database',
            'NoSQL có summary, mutation và phân tích sâu hơn',
            'NoSQL summaries, mutations, and deeper analysis',
            'Mở rộng NoSQL workspace với summary trực tiếp trên kết quả, hỗ trợ mutation rõ ràng hơn và các màn hình schema/visualize được làm lại để đọc hành vi dữ liệu tốt hơn.',
            'Expanded the NoSQL workspace with inline summaries, clearer mutation support, and reworked schema and visualize surfaces that make data behavior easier to inspect.',
          ),
          feature(
            currentLang,
            'globe',
            'Routing provider gọn hơn và dễ mở rộng hơn',
            'Leaner provider routing with broader extensibility',
            'Đơn giản hóa provider runner, gom lại logic tương thích OpenAI-style và mở rộng lane model để việc thêm provider hoặc đổi model bớt phụ thuộc vào các nhánh đặc biệt.',
            'Simplified the provider runner, consolidated OpenAI-style compatibility logic, and widened model lanes so adding providers or swapping models depends less on special-case branches.',
          ),
          feature(
            currentLang,
            'code2',
            'Replay hội thoại và prompt context ổn định hơn',
            'More stable conversation replay and prompt context',
            'Củng cố luồng replay hội thoại, ghép context và prompt builder để Assistant giữ mạch tốt hơn giữa các lượt trao đổi dài hoặc khi chuyển qua lại giữa SQL và NoSQL.',
            'Strengthened conversation replay, context assembly, and prompt building so the Assistant keeps its flow more reliably during longer exchanges or when switching between SQL and NoSQL.',
          ),
          feature(
            currentLang,
            'testTube',
            'Tái cấu trúc lớn cho màn hình NoSQL và visualize',
            'Major refactors across NoSQL and visualize screens',
            'Dọn lại kiến trúc của các màn hình tổng hợp, schema analysis và visualize để giảm logic rải rác, tăng độ tách bạch và tạo nền cho các vòng cải tiến UX về sau.',
            'Reworked the aggregation, schema analysis, and visualize screens to reduce scattered logic, improve separation of concerns, and prepare the ground for later UX iterations.',
          ),
        ],
      },
      {
        version: 'v3.6.2',
        date: pickLocalizedText(currentLang, '28 tháng 5, 2026', 'May 28, 2026'),
        title: pickLocalizedText(
          currentLang,
          'AI Vision mở rộng & catalog model mới',
          'Expanded AI Vision & New Model Catalog',
        ),
        features: [
          feature(
            currentLang,
            'sparkles',
            'Ảnh đính kèm & vision-aware routing',
            'Image attachments & vision-aware routing',
            'AI chat giờ nhận ảnh đính kèm trực tiếp trong prompt và tự ưu tiên lane có hỗ trợ vision khi tác vụ cần phân tích ảnh chụp màn hình, sơ đồ hoặc hình minh họa.',
            'AI chat now accepts direct image attachments in prompts and automatically prioritizes vision-capable lanes for screenshots, diagrams, and image-based tasks.',
          ),
          feature(
            currentLang,
            'globe',
            'Beeknoee chính thức vào routing',
            'Beeknoee added to routing',
            'Bổ sung provider Beeknoee vào hệ thống routing, kèm cấu hình môi trường riêng để chọn model rõ ràng thay vì nhét vào fallback ngầm.',
            'Added Beeknoee as a first-class routing provider with dedicated environment configuration instead of hiding it behind implicit fallback paths.',
          ),
          feature(
            currentLang,
            'database',
            'Catalog model riêng & MiniMax M2.7',
            'Dedicated model catalog & MiniMax M2.7',
            'Tách danh sách model AI Assistant thành catalog riêng, đồng thời mở rộng picker với Qwen 3 235B, GLM 4.7 Flash và MiniMax M2.7.',
            'Split the AI Assistant model list into a dedicated catalog and expanded the picker with Qwen 3 235B, GLM 4.7 Flash, and MiniMax M2.7.',
          ),
          feature(
            currentLang,
            'code2',
            'AI chat composer bóng bẩy hơn',
            'Polished AI chat composer',
            'Làm mới ô nhập AI với styling tốt hơn, animation mượt hơn, icon model rõ hơn và trải nghiệm soạn prompt trực quan hơn.',
            'Refreshed the AI chat composer with better styling, smoother animation, clearer model icons, and a more expressive prompt composition experience.',
          ),
          feature(
            currentLang,
            'zap',
            'Timeout AI 60 giây cho payload nặng',
            '60-second AI timeouts for heavier payloads',
            'Tăng timeout provider lên 60 giây để ổn định hơn khi gửi prompt dài, schema lớn hoặc ảnh có kích thước đáng kể.',
            'Raised provider timeouts to 60 seconds so larger prompts, heavier schema context, and image payloads complete more reliably.',
          ),
        ],
      },
      {
        version: 'v3.6.1',
        date: pickLocalizedText(currentLang, '21 tháng 5, 2026', 'May 21, 2026'),
        title: pickLocalizedText(
          currentLang,
          'Billing thật, quyền truy cập chặt hơn & trợ lý AI giàu ngữ cảnh',
          'Real Billing, Tighter Access Control & Richer AI Context',
        ),
        features: [
          feature(
            currentLang,
            'database',
            'Billing checkout thật với MoMo/ZaloPay',
            'Real billing checkout with MoMo/ZaloPay',
            'Thay pricing mock bằng flow thanh toán thật, có bảng plan, lưu subscription, webhook xử lý trạng thái và màn hình return cho checkout.',
            'Replaced mock pricing with a real checkout flow including plan definitions, subscription persistence, payment webhooks, and billing return handling.',
          ),
          feature(
            currentLang,
            'shieldCheck',
            'Permission lọc theo resource & hardening bảo mật',
            'Resource-level permissions & security hardening',
            'Siết quyền truy cập connections, queries và dashboards theo resource policy thực tế, đồng thời tăng cường SSRF protection cho SSH tunnel và các đường AI nhạy cảm.',
            'Tightened access to connections, queries, and dashboards using resource-level policies while further hardening SSH tunnel SSRF protection and sensitive AI paths.',
          ),
          feature(
            currentLang,
            'zap',
            'DataGrid nhanh hơn, sâu hơn',
            'Faster, deeper DataGrid workflows',
            'Thêm cell inspector, bulk replace, highlight tìm kiếm, cuộn mượt hơn, virtualization tốt hơn cho NoSQL grid và caching thông minh hơn cho metadata/query.',
            'Added a cell inspector, bulk replace, search highlighting, smoother scrolling, stronger NoSQL virtualization, and smarter metadata/query caching.',
          ),
          feature(
            currentLang,
            'sparkles',
            'AI hiểu schema tốt hơn & prompt context giàu hơn',
            'Smarter schema-aware AI context',
            'AI context giờ có thêm sample rows, luật chuyên biệt cho NoSQL, giới hạn chống overflow và autocomplete chính xác hơn nhờ hiểu kiểu dữ liệu tốt hơn.',
            'AI context now includes sample rows, NoSQL-specific rules, overflow guards, and more accurate autocomplete thanks to stronger type awareness.',
          ),
          feature(
            currentLang,
            'globe',
            'Đa ngôn ngữ vi/en xuyên suốt',
            'End-to-end vi/en localization',
            'Triển khai i18n cho client, server, email templates và auth flow để thông báo, lỗi và UI chính đều hiển thị nhất quán bằng tiếng Việt hoặc tiếng Anh.',
            'Rolled out i18n across the client, server, email templates, and auth flows so key UI, errors, and notifications can stay consistent in Vietnamese or English.',
          ),
        ],
      },
      {
        version: 'v3.6.0',
        date: pickLocalizedText(currentLang, 'Giữa tháng 5, 2026', 'Mid May 2026'),
        title: pickLocalizedText(
          currentLang,
          'Kiến trúc nền AI & reasoning xuyên thấu',
          'AI Foundational Architecture & Reasoning Transparency',
        ),
        features: [
          feature(
            currentLang,
            'sparkles',
            'Xuyên thấu suy nghĩ AI',
            'AI Reasoning Transparency',
            'Bổ sung block Thought có thể gập mở ngay trong khung chat để hiển thị phần tóm tắt và phân tích logic của AI, tăng độ trong suốt và đáng tin cậy.',
            "Added a collapsible Thought block in the chat interface to show the AI's summary and reasoning process, improving transparency and trust.",
          ),
          feature(
            currentLang,
            'globe',
            'Routing động & fallback mượt hơn',
            'Dynamic AI Routing & Fallback',
            'Tái cấu trúc backend với các module routing và provider runner để hỗ trợ mạng lưới model đa dạng như OpenRouter, Groq cùng cơ chế fallback mượt hơn khi model chính quá tải.',
            'Refactored the backend with routing and provider runner modules to support diverse model networks like OpenRouter and Groq, plus smoother fallback behavior when the primary model is overloaded.',
          ),
          feature(
            currentLang,
            'database',
            'Mở rộng trợ lý AI cho NoSQL',
            'NoSQL AI Assistant Integration',
            'Phát triển NoSqlAiQueryBox mới, mang khả năng hoàn thiện mã, sửa lỗi cú pháp và khởi tạo query NoSQL trực tiếp trong không gian MongoDB.',
            'Introduced the new NoSqlAiQueryBox, bringing completion, syntax repair, and query generation directly into the MongoDB workspace.',
          ),
          feature(
            currentLang,
            'code2',
            'Nâng cấp quản lý state & UI chat',
            'Chat State & UI Overhaul',
            'Làm mới luồng quản lý hội thoại với aiChatSlice, useAiChat và AiChatInput mới để hỗ trợ lịch sử ngữ cảnh dài hơn và nhập liệu đa dòng mượt hơn.',
            'Overhauled the conversation state flow using aiChatSlice, useAiChat, and a new AiChatInput component to support longer-lived context and smoother multi-line input.',
          ),
          feature(
            currentLang,
            'zap',
            'Siết chặt autocomplete',
            'Autocomplete Hardening',
            'Siết context qua prompt builder, xử lý triệt để lỗi treo UI với timeout chặt hơn và ưu tiên các model cực nhanh như Gemini Flash Preview.',
            'Tightened prompt context, removed UI hang scenarios with stricter timeouts, and aggressively prioritized ultra-fast models like Gemini Flash Preview.',
          ),
        ],
      },
      {
        version: 'v3.5.0',
        date: pickLocalizedText(currentLang, '8 tháng 5, 2026', 'May 8, 2026'),
        title: pickLocalizedText(
          currentLang,
          'NoSQL Explorer parity & tinh chỉnh UX',
          'NoSQL Explorer Parity & UX Refinement',
        ),
        features: [
          feature(
            currentLang,
            'zap',
            'NoSQL workspace parity',
            'NoSQL Workspace Parity',
            'Đưa các phím tắt, menu File/Edit và công cụ Visualize/Diagram lên NoSQL để đồng nhất trải nghiệm với SQL.',
            'Brought shortcuts, File/Edit menus, and Visualize/Diagram tools to NoSQL for a more consistent workspace experience with SQL.',
          ),
          feature(
            currentLang,
            'fileCode',
            'Version history & metadata freshness',
            'Version History & Metadata Freshness',
            'Theo dõi lịch sử phiên bản của các thực thể và tự động cập nhật độ tươi của metadata để đảm bảo dữ liệu luôn chính xác.',
            'Added entity version history and automatic metadata freshness tracking so data stays accurate.',
          ),
          feature(
            currentLang,
            'shieldCheck',
            'Org backup & migration preview',
            'Org Backup & Migration Preview',
            'Thêm hệ thống sao lưu tổ chức và công cụ xem trước migration để việc chuyển đổi hạ tầng an toàn hơn.',
            'Introduced organization backups and migration preview tooling to make infrastructure transitions safer.',
          ),
          feature(
            currentLang,
            'users',
            'Theo dõi hiện diện thời gian thực',
            'Real-time Presence Tracking',
            'Hiển thị ai đang cùng hoạt động trong workspace nhờ hệ thống presence theo thời gian thực.',
            'Shows who is active in the workspace in real time through presence tracking.',
          ),
          feature(
            currentLang,
            'sparkles',
            'Persistent workspace state',
            'Persistent Workspace State',
            'Ghi nhớ chiều cao bảng kết quả, chế độ xem Tree/Grid và các aggregation stages ngay cả sau khi tải lại trang.',
            'Persists result panel height, Tree/Grid view mode, and aggregation stages across page refreshes.',
          ),
          feature(
            currentLang,
            'globe',
            'Universal Visualize Hub',
            'Universal Visualize Hub',
            'Trang trực quan hóa giờ hỗ trợ đầy đủ NoSQL, cho phép tạo biểu đồ từ dữ liệu MongoDB mượt mà hơn.',
            'The visualization page now fully supports NoSQL, enabling smoother chart creation from MongoDB data.',
          ),
        ],
      },
      {
        version: 'v3.4.0',
        date: pickLocalizedText(currentLang, 'Đầu tháng 5, 2026', 'Early May 2026'),
        title: pickLocalizedText(
          currentLang,
          'Siết bảo mật & hardening hạ tầng',
          'Advanced Security & Infrastructure Hardening',
        ),
        features: [
          feature(
            currentLang,
            'shieldCheck',
            'Enterprise-grade security hardening',
            'Enterprise-Grade Security Hardening',
            'Siết SQL Guard chống lách EXEC, chặn lỗ hổng SSRF qua SSH tunnel và tăng quyền riêng tư cho team.',
            'Strengthened SQL Guard against EXEC bypasses, blocked SSH tunnel SSRF vectors, and tightened team privacy logic.',
          ),
          feature(
            currentLang,
            'sparkles',
            'Advanced data privacy',
            'Advanced Data Privacy',
            'Sanitize lỗi database chi tiết để tránh rò rỉ hạ tầng và bảo mật lại thông tin xác thực admin mặc định.',
            'Sanitized detailed database errors to prevent infrastructure leakage and further secured default admin credentials.',
          ),
          feature(
            currentLang,
            'settings',
            'Migration guardrails',
            'Migration Guardrails',
            'Áp dụng timeout an toàn cho các tiến trình migration lớn để tránh treo tài nguyên hệ thống.',
            'Applied safety timeouts to large migration flows to prevent resource exhaustion.',
          ),
          feature(
            currentLang,
            'zap',
            'Pentest & security validation',
            'Pentest & Security Validation',
            'Hoàn thành đợt kiểm tra an ninh nâng cao với các kịch bản tấn công logic thực tế.',
            'Completed an advanced security audit with real-world logic attack scenarios.',
          ),
        ],
      },
      {
        version: 'v3.3.1',
        date: pickLocalizedText(currentLang, 'Cuối tháng 4, 2026', 'Late April 2026'),
        title: pickLocalizedText(
          currentLang,
          'Cộng tác nhóm & polish trên mobile',
          'Team Collaboration & Mobile Polish',
        ),
        features: [
          feature(
            currentLang,
            'sparkles',
            'Organizations & shared workspaces',
            'Organizations & Shared Workspaces',
            'Thêm nền tảng cộng tác nhóm với organizations, members, roles và chia sẻ connections, queries, dashboards.',
            'Added the collaboration foundation for organizations, members, roles, and shared connections, queries, and dashboards.',
          ),
          feature(
            currentLang,
            'globe',
            'Mobile collaboration access',
            'Mobile Collaboration Access',
            'Teams giờ có thể mở từ menu avatar trên mobile, đồng thời các màn workspace, dialog và admin được tinh chỉnh tốt hơn cho màn nhỏ.',
            'Teams are now reachable from the avatar menu on mobile, while workspace, dialog, and admin screens are tuned for smaller layouts.',
          ),
          feature(
            currentLang,
            'testTube',
            'Connection diagnostics',
            'Connection Diagnostics',
            'ConnectionDialog có thêm Test Connection, đi kèm sửa lỗi UI và tinh chỉnh trải nghiệm thiết lập kết nối.',
            'ConnectionDialog now includes Test Connection alongside UI fixes and a smoother connection setup flow.',
          ),
          feature(
            currentLang,
            'database',
            'Realtime stability',
            'Realtime Stability',
            'SSE notifications, cache và luồng cập nhật nền được đồng bộ lại với backend API và hạ tầng Redis hiện tại.',
            'SSE notifications, cache, and background update flows were realigned with the current backend API and Redis infrastructure.',
          ),
        ],
      },
      {
        version: 'v3.3.0',
        date: pickLocalizedText(currentLang, 'Giữa tháng 4, 2026', 'Mid April 2026'),
        title: pickLocalizedText(
          currentLang,
          'AI thế hệ mới & type safety toàn diện',
          'Next-Gen AI & Comprehensive Type Safety',
        ),
        features: [
          feature(
            currentLang,
            'sparkles',
            'AI service decomposition',
            'AI Service Decomposition',
            'Tách AI service thành các sub-service chuyên biệt: routing, provider runner, chat completion và autocomplete.',
            'Decomposed the AI service into specialized sub-services for routing, provider runners, chat completion, and autocomplete.',
          ),
          feature(
            currentLang,
            'code2',
            'Type safety hoàn toàn',
            'Complete Type Safety',
            'Loại bỏ any, siết generic, tách AI constants và nâng chất lượng code theo SOLID, KISS, YAGNI, DRY.',
            'Removed any types, constrained generics, extracted AI constants, and improved code quality using SOLID, KISS, YAGNI, and DRY.',
          ),
          feature(
            currentLang,
            'database',
            'Redis caching & global search',
            'Redis Caching & Global Search',
            'Bổ sung query result caching, global schema search, real-time SSE notifications và session management tốt hơn.',
            'Added query result caching, global schema search, real-time SSE notifications, and more efficient session management.',
          ),
          feature(
            currentLang,
            'zap',
            'AI-powered SQL generation',
            'AI-Powered SQL Generation',
            'Tạo SQL tự động từ ngôn ngữ tự nhiên và semantic search cho database objects.',
            'Added SQL generation from natural language plus semantic search for database objects.',
          ),
        ],
      },
      {
        version: 'v3.2.0',
        date: pickLocalizedText(currentLang, 'Đầu tháng 4, 2026', 'Early April 2026'),
        title: pickLocalizedText(
          currentLang,
          'ERD thông minh & thông báo thời gian thực',
          'Smart ERD & Real-time Notifications',
        ),
        features: [
          feature(
            currentLang,
            'code2',
            'ERD performance optimization',
            'ERD Performance Optimization',
            'Tối ưu performance và độ rõ ràng khi trực quan hóa ERD với Redis caching và smart suggestions.',
            'Improved ERD performance and visual clarity with Redis caching and smart suggestions.',
          ),
          feature(
            currentLang,
            'globe',
            'Real-time SSE notifications',
            'Real-time SSE Notifications',
            'Thông báo thời gian thực qua Server-Sent Events cho query status và system updates.',
            'Added real-time notifications via Server-Sent Events for query status and system updates.',
          ),
          feature(
            currentLang,
            'testTube',
            'Client-side testing suite',
            'Client-side Testing Suite',
            'Thêm unit tests cho ConnectionService và SavedQueryService để tăng độ tin cậy.',
            'Added unit tests for ConnectionService and SavedQueryService to improve reliability.',
          ),
        ],
      },
      {
        version: 'v3.1.0',
        date: pickLocalizedText(currentLang, 'Cuối tháng 3, 2026', 'Late March 2026'),
        title: pickLocalizedText(
          currentLang,
          'Nâng cấp UI & tinh chỉnh hooks',
          'UI Upgrade & Hooks Refinement',
        ),
        features: [
          feature(
            currentLang,
            'sparkles',
            'Landing page dark mode cinematic',
            'Cinematic Dark Mode Landing Page',
            'Nâng cấp giao diện landing page với dark mode cinematic, animation mượt và visual effect tốt hơn.',
            'Upgraded the landing page with a cinematic dark theme, smoother animation, and richer visual effects.',
          ),
          feature(
            currentLang,
            'code2',
            'Query/ERD hooks alignment',
            'Query ERD Hooks Alignment',
            'Căn chỉnh Query và ERD hooks, sửa TypeScript errors và dọn code không dùng.',
            'Aligned Query and ERD hooks, fixed TypeScript errors, and cleaned up unused code.',
          ),
        ],
      },
      {
        version: 'v3.0.5',
        date: pickLocalizedText(currentLang, 'Giữa tháng 3, 2026', 'Mid March 2026'),
        title: pickLocalizedText(
          currentLang,
          'Chất lượng code & sửa type',
          'Code Quality & Type Fixes',
        ),
        features: [
          feature(
            currentLang,
            'settings',
            'Refactor theo SOLID, KISS, YAGNI, DRY',
            'SOLID, KISS, YAGNI, DRY Refactoring',
            'Cải thiện chất lượng code với các nguyên tắc thiết kế phần mềm rõ trách nhiệm và dễ bảo trì hơn.',
            'Improved code quality with software design principles focused on clarity, boundaries, and maintainability.',
          ),
          feature(
            currentLang,
            'fileCode',
            'Gỡ lỗi TypeScript',
            'TypeScript Error Resolution',
            'Sửa lỗi TypeScript, dọn props không dùng và siết lại kiểu dữ liệu.',
            'Fixed TypeScript errors, cleaned up unused props, and tightened types.',
          ),
        ],
      },
      {
        version: 'v3.0.0',
        date: pickLocalizedText(currentLang, 'Cuối tháng 1, 2026', 'Late January 2026'),
        title: pickLocalizedText(currentLang, 'Nền tảng cốt lõi', 'The Core Platform Genesis'),
        features: [
          feature(
            currentLang,
            'database',
            'Kiến trúc NestJS & Prisma',
            'NestJS & Prisma Backbone',
            'Backend ổn định hỗ trợ OAuth, JWT và mã hóa AES-256-GCM.',
            'Shipped a stable backend supporting OAuth, JWT, and AES-256-GCM encryption.',
          ),
          feature(
            currentLang,
            'shieldCheck',
            'Auth service spec',
            'Auth Service Specification',
            'Bổ sung auth service specification và cấu hình thư mục agent.',
            'Added the auth service specification and agent directory configuration.',
          ),
        ],
      },
    ],
  };
}
