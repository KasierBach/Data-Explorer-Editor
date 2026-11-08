/** Public documentation metadata only: no UI, database runtime, or filesystem dependencies. */
const REVIEWED_AT = '2026-11-07';
const SECTION_ROOT = 'client/src/presentation/components/docs/sections';

function topic<const Id extends string>(
  id: Id,
  title: string,
  titleEn: string,
  description: string,
  descriptionEn: string,
  sourceFile: string,
) {
  return { id, title, titleEn, description, descriptionEn, sourcePath: `${SECTION_ROOT}/${sourceFile}.tsx`, updatedAt: REVIEWED_AT } as const;
}

export const DOCS_CATALOG = [
  {
    id: 'getting-started', title: 'Bắt đầu', titleEn: 'Getting Started',
    items: [
      topic('introduction', 'Giới thiệu', 'Introduction', 'Khám phá workspace SQL, NoSQL và các hướng dẫn thực hành của Data Explorer.', 'Explore the Data Explorer SQL and NoSQL workspace and its practical guides.', 'IntroductionSection'),
      topic('first-query', 'Truy vấn đầu tiên', 'Your First Query', 'Tạo kết nối PostgreSQL chỉ đọc, mở bảng, chạy SELECT và hiểu cách yêu cầu hủy truy vấn.', 'Create a read-only PostgreSQL connection, browse a table, run SELECT, and understand cancellation requests.', 'FirstQuerySection'),
      topic('ui-tour', 'Hướng dẫn giao diện', 'UI Tour', 'Tìm kết nối, trình soạn thảo, lưới kết quả và công cụ theo từng workspace.', 'Find connections, the editor, result grid, and tools in each workspace.', 'UiTourSection'),
      topic('installation', 'Cài đặt', 'Installation', 'Cài đặt dự án, cấu hình môi trường và khởi chạy client cùng server.', 'Install the project, configure its environment, and start the client and server.', 'InstallationSection'),
      topic('prerequisites', 'Điều kiện tiên quyết', 'Prerequisites', 'Chuẩn bị runtime, metastore, Redis và quyền truy cập database trước khi cài đặt.', 'Prepare the runtime, metastore, Redis, and database access before installation.', 'PrerequisitesSection'),
      topic('env-vars', 'Biến môi trường', 'Environment Variables', 'Cấu hình biến môi trường, secret, dịch vụ tùy chọn và các giới hạn server.', 'Configure environment variables, secrets, optional services, and server limits.', 'EnvVarsSection'),
    ],
  },
  {
    id: 'connections', title: 'Kết nối', titleEn: 'Connections',
    items: [
      topic('postgres', 'PostgreSQL', 'PostgreSQL', 'Kết nối PostgreSQL, kiểm tra TLS và duyệt schema bằng tài khoản phù hợp.', 'Connect PostgreSQL, verify TLS, and browse schemas with an appropriate account.', 'ConnectionSection'),
      topic('mysql', 'MySQL', 'MySQL', 'Thiết lập MySQL, lựa chọn TLS và kiểm tra kết nối trước khi chạy truy vấn.', 'Configure MySQL, choose TLS settings, and test the connection before querying.', 'ConnectionSection'),
      topic('mariadb', 'MariaDB', 'MariaDB', 'Dùng strategy tương thích MySQL cho MariaDB và hiểu cấu hình TLS hiện tại.', 'Use the MySQL-compatible strategy for MariaDB and understand current TLS settings.', 'ConnectionSection'),
      topic('cockroach', 'CockroachDB', 'CockroachDB', 'Kết nối CockroachDB qua giao thức PostgreSQL và xem các giới hạn tương thích.', 'Connect CockroachDB over the PostgreSQL protocol and review compatibility limits.', 'ConnectionSection'),
      topic('mssql', 'SQL Server', 'SQL Server', 'Thiết lập SQL Server, mã hóa kết nối và duyệt đối tượng theo schema.', 'Configure SQL Server, connection encryption, and schema-scoped object browsing.', 'ConnectionSection'),
      topic('mongodb', 'MongoDB & Atlas', 'MongoDB & Atlas', 'Kết nối MongoDB hoặc Atlas và mở collection trong workspace NoSQL.', 'Connect MongoDB or Atlas and open collections in the NoSQL workspace.', 'ConnectionSection'),
      topic('sqlite', 'SQLite', 'SQLite', 'Hiểu đường dẫn SQLite phía server, schema main và khoảng trống selector trong workspace SQL.', 'Understand server-side SQLite paths, the main schema, and the SQL workspace selector gap.', 'SqliteConnectionSection'),
      topic('clickhouse', 'ClickHouse', 'ClickHouse', 'Cấu hình ClickHouse HTTP/HTTPS và phân biệt truy vấn với sửa dòng và hủy đang chạy.', 'Configure ClickHouse HTTP/HTTPS and distinguish querying from row editing and active cancellation.', 'ClickHouseConnectionSection'),
      topic('database-capabilities', 'Khả năng từng database', 'Database Capabilities', 'Đối chiếu 10 kiểu kết nối, alias, hỗ trợ backend, tuyến giao diện và giới hạn bảo mật.', 'Compare 10 connection types, aliases, backend support, UI routing, and security limits.', 'DatabaseCapabilitiesSection'),
    ],
  },
  {
    id: 'nosql-workspace', title: 'Không gian NoSQL', titleEn: 'NoSQL Workspace',
    items: [
      topic('nosql-studio', 'NoSQL Studio', 'NoSQL Studio', 'Duyệt document, soạn MQL và làm việc với collection MongoDB trong NoSQL Studio.', 'Browse documents, write MQL, and work with MongoDB collections in NoSQL Studio.', 'NoSqlStudioSection'),
      topic('aggregation-builder', 'Aggregation Builder', 'Aggregation Builder', 'Xây pipeline MongoDB từ stage và kiểm tra giới hạn trước khi thực thi.', 'Build MongoDB pipelines from stages and check limits before execution.', 'AggregationBuilderSection'),
      topic('nosql-insights', 'Công cụ schema & insight', 'Schema & Insight Tools', 'Phân tích schema lấy mẫu và hiểu phạm vi cùng thời gian cache của insight MongoDB.', 'Analyze sampled schemas and understand the scope and cache lifetime of MongoDB insights.', 'NoSqlInsightsSection'),
    ],
  },
  {
    id: 'sql-workspace', title: 'Không gian SQL', titleEn: 'SQL Workspace',
    items: [
      topic('editor', 'Trình soạn thảo Monaco', 'Monaco Editor', 'Soạn SQL, dùng phím tắt, chọn đoạn truy vấn và chạy trong đúng ngữ cảnh kết nối.', 'Write SQL, use shortcuts, select statements, and run in the correct connection context.', 'EditorSection'),
      topic('tabs', 'Quản lý tab', 'Tab Management', 'Quản lý tab truy vấn, trạng thái cục bộ và ngữ cảnh database của từng tab.', 'Manage query tabs, local state, and each tab’s database context.', 'TabsSection'),
      topic('results', 'Lưới kết quả', 'Result Grid', 'Đọc lưới kết quả, phân trang và điều kiện nhận diện dòng trước khi chỉnh sửa.', 'Read result grids, pagination, and row-identity requirements before editing.', 'ResultsSection'),
      topic('export', 'Xuất dữ liệu', 'Data Export', 'Xuất dữ liệu đã tải trong trình duyệt và hiểu phạm vi định dạng, phân trang cùng chính sách hiện tại.', 'Export browser-loaded data and understand format, pagination, and current policy boundaries.', 'ExportSection'),
    ],
  },
  {
    id: 'ai-assistant', title: 'Trí tuệ nhân tạo (AI)', titleEn: 'AI Assistant',
    items: [
      topic('ai-service', 'Định tuyến AI & trợ lý', 'AI Routing & Assistant', 'Cấu hình provider, model và định tuyến AI tùy chọn theo khả năng thực tế.', 'Configure providers, models, and optional AI routing according to actual capabilities.', 'AiServiceSection'),
      topic('sql-generation', 'Tạo mã SQL', 'SQL Generation', 'Tạo bản nháp SQL bằng AI, review trước khi chủ động chạy và hiểu xác nhận backend cho thao tác tác động lớn.', 'Generate SQL drafts with AI, review before explicit execution, and understand backend confirmation for high-impact operations.', 'SqlGenerationSection'),
      topic('vision', 'AI Vision & ảnh đính kèm', 'AI Vision & Attachments', 'Hiểu ảnh, PDF, văn bản đính kèm và khả năng từng model trong yêu cầu AI.', 'Understand images, PDFs, text attachments, and per-model capabilities in AI requests.', 'VisionSection'),
      topic('explain', 'Giải thích truy vấn', 'Query Explanation', 'Phân biệt giải thích AI với kế hoạch thực thi và kiểm tra SQL được gửi đi.', 'Distinguish AI explanations from execution plans and inspect the SQL being sent.', 'ExplainSection'),
    ],
  },
  {
    id: 'visualization', title: 'Trực quan hóa', titleEn: 'Visualization',
    items: [
      topic('erd', 'Sơ đồ ERD', 'ERD Diagram', 'Xem quan hệ database và lưu sơ đồ ERD theo ngữ cảnh workspace.', 'Explore database relationships and save ERDs within the workspace context.', 'ErdSection'),
      topic('charts', 'Biểu đồ tương tác', 'Interactive Charts', 'Tạo biểu đồ từ kết quả, hiểu giới hạn dữ liệu và lưu snapshot dashboard.', 'Create charts from results, understand data limits, and save dashboard snapshots.', 'ChartsSection'),
    ],
  },
  {
    id: 'workspace-operations', title: 'Cộng tác & vận hành', titleEn: 'Collaboration & Operations',
    items: [
      topic('team-workspace', 'Không gian cộng tác', 'Team Workspace', 'Chia sẻ kết nối và tài nguyên theo quyền thành viên cùng phạm vi teamspace.', 'Share connections and resources according to member permissions and teamspace scope.', 'TeamWorkspaceSection'),
      topic('data-migration', 'Di chuyển dữ liệu', 'Data Migration', 'Review preflight, quyền hai đầu, batch ghi từng phần và nguy cơ khi chạy lại migration.', 'Review preflight, endpoint permissions, partial batch writes, and migration replay risks.', 'MigrationSection'),
      topic('authentication', 'Xác thực & onboarding', 'Authentication & Onboarding', 'Đăng nhập, thiết lập tài khoản và hiểu các bước onboarding hiện tại.', 'Sign in, configure an account, and understand current onboarding steps.', 'AuthenticationSection'),
      topic('billing', 'Thanh toán & gói dịch vụ', 'Billing & Subscription', 'Xem luồng thanh toán và phân biệt giới hạn triển khai với quyền lợi gói.', 'Review billing flows and distinguish implemented limits from plan entitlements.', 'BillingSection'),
    ],
  },
  {
    id: 'architecture-tech', title: 'Kiến trúc & công nghệ', titleEn: 'Architecture & Tech',
    items: [
      topic('architecture', 'Kiến trúc hệ thống', 'System Architecture', 'Tìm hiểu client, API, metastore và các strategy database của hệ thống.', 'Understand the client, API, metastore, and database strategies.', 'ArchitectureSection'),
      topic('tech-stack', 'Danh sách công nghệ', 'Technology Stack', 'Đối chiếu runtime, thư viện giao diện và công nghệ backend trong dự án.', 'Review runtimes, UI libraries, and backend technologies used by the project.', 'TechStackSection'),
      topic('redis', 'Redis & Caching', 'Redis & Caching', 'Phân biệt Redis hạ tầng cache/queue với Redis đích và giới hạn tuyến NoSQL hiện tại.', 'Distinguish infrastructure Redis cache/queues from Redis targets and current NoSQL routing limits.', 'RedisSection'),
      topic('security', 'Bảo mật & quyền riêng tư', 'Security & Privacy', 'Hiểu xác thực, quyền tài nguyên, guardrail truy vấn và bảo vệ thông tin kết nối.', 'Understand authentication, resource permissions, query guardrails, and connection-secret protection.', 'SecuritySection'),
      topic('operational-limits', 'Giới hạn vận hành', 'Operational Limits', 'Tra cứu giới hạn SQL, MongoDB, Redis, AI và dashboard đang được code thực thi.', 'Look up SQL, MongoDB, Redis, AI, and dashboard bounds currently enforced by code.', 'OperationalLimitsSection'),
      topic('data-handling', 'Xử lý & lưu trữ dữ liệu', 'Data Handling', 'Theo dõi dữ liệu trong trình duyệt, metastore, cache, provider AI và việc xóa tài khoản.', 'Trace data through the browser, metastore, cache, AI providers, and account deletion.', 'DataHandlingSection'),
      topic('deployment', 'Triển khai production', 'Production Deployment', 'Chuẩn bị triển khai, kết nối hạ tầng và kiểm tra cấu hình an toàn cho production.', 'Prepare deployment, infrastructure connections, and production safety configuration.', 'DeploymentSection'),
      topic('testing', 'Kiểm thử & đóng góp', 'Testing & Contribution', 'Chạy kiểm thử phù hợp và đóng góp thay đổi có phạm vi rõ ràng.', 'Run appropriate tests and contribute changes with a clearly defined scope.', 'TestingSection'),
      topic('clean-code', 'Clean Code & Refactor', 'Clean Code & Refactor', 'Áp dụng ranh giới module và quy ước refactor dựa trên codebase thực tế.', 'Apply module boundaries and refactoring conventions grounded in the actual codebase.', 'CleanCodeSection'),
      topic('lifecycle', 'Quy trình phát triển', 'Dev Lifecycle', 'Theo dõi quy trình phát triển, kiểm tra thay đổi và phát hành của dự án.', 'Follow the project’s development, change verification, and release workflow.', 'LifecycleSection'),
      topic('faq', 'FAQ & khắc phục lỗi', 'FAQ & Troubleshooting', 'Chẩn đoán lỗi cài đặt, kết nối, truy vấn và tính năng tùy chọn.', 'Diagnose installation, connection, query, and optional-feature failures.', 'FaqSection'),
    ],
  },
] as const;

export type DocTopic = (typeof DOCS_CATALOG)[number]['items'][number];
export type DocTopicId = DocTopic['id'];
export const DOCS_TOPICS: readonly DocTopic[] = DOCS_CATALOG.flatMap<DocTopic>(section => section.items);

export function getDocTopic(id: string): DocTopic | undefined {
  return DOCS_TOPICS.find(item => item.id === id);
}
