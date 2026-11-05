export type LegalDocKey = 'legal' | 'privacy' | 'terms';

type LegalSection = {
    title: string;
    paragraphs: readonly string[];
    bullets?: readonly string[];
};

type LegalDocument = {
    title: string;
    subtitle: string;
    effectiveDate: string;
    sections: readonly LegalSection[];
    quickLinks?: readonly { label: string; href: string }[];
};

export const getLegalDocument = (lang: 'vi' | 'en', key: LegalDocKey): LegalDocument => {
    const docs = {
        vi: {
            legal: {
                title: 'Trung tâm pháp lý',
                subtitle: 'Một nơi tập trung để đọc nhanh các cam kết vận hành, quyền riêng tư và điều khoản sử dụng của Data Explorer.',
                effectiveDate: 'Hiệu lực từ 28/06/2026',
                quickLinks: [
                    { label: 'Xem chính sách riêng tư', href: '/privacy' },
                    { label: 'Xem điều khoản dịch vụ', href: '/terms' },
                ],
                sections: [
                    {
                        title: 'Cách các tài liệu này hoạt động',
                        paragraphs: [
                            'Bộ tài liệu này mô tả cách Data Explorer xử lý tài khoản, dữ liệu cấu hình, kết quả truy vấn, nội dung AI và các trách nhiệm cơ bản khi bạn sử dụng sản phẩm.',
                            'Nếu bạn tạo tài khoản hoặc dùng các khu vực cần đăng nhập, việc tiếp tục sử dụng đồng nghĩa với việc bạn đang vận hành theo các tài liệu được liên kết tại đây.',
                        ],
                    },
                    {
                        title: 'Những gì áp dụng khi bạn đăng ký',
                        paragraphs: [
                            'Khi tạo tài khoản, bạn xác nhận mình có quyền dùng email đó, chịu trách nhiệm với truy vấn hoặc nội dung mình gửi lên hệ thống, và đồng ý với điều khoản lẫn chính sách riêng tư hiện hành.',
                        ],
                        bullets: [
                            'Điều khoản dịch vụ quy định quyền truy cập, giới hạn sử dụng và các trường hợp bị tạm ngưng tài khoản.',
                            'Chính sách riêng tư giải thích dữ liệu nào được lưu, vì sao hệ thống cần nó và bạn có thể yêu cầu gì từ phía chúng tôi.',
                        ],
                    },
                    {
                        title: 'Liên hệ và yêu cầu pháp lý',
                        paragraphs: [
                            'Nếu bạn cần gửi yêu cầu liên quan đến dữ liệu cá nhân, bảo mật tài khoản hoặc điều khoản sử dụng, hãy liên hệ đội vận hành qua địa chỉ legal@dataexplorer.app.',
                        ],
                    },
                ],
            },
            privacy: {
                title: 'Chính sách riêng tư',
                subtitle: 'Tóm tắt cách Data Explorer thu thập, sử dụng, lưu giữ và bảo vệ thông tin liên quan đến tài khoản và workspace của bạn.',
                effectiveDate: 'Hiệu lực từ 28/06/2026',
                sections: [
                    {
                        title: 'Dữ liệu chúng tôi thu thập',
                        paragraphs: [
                            'Chúng tôi thu thập các trường cần để vận hành tài khoản như email, tên hiển thị, thông tin hồ sơ, cấu hình giao diện và các cài đặt thông báo bạn tự chọn.',
                            'Trong workspace, hệ thống có thể lưu metadata như connections, truy vấn đã lưu, lịch sử thao tác, dashboard, ERD workspace và các thiết lập AI mà bạn chủ động tạo. Khi bạn lưu query result thành dashboard widget, tối đa 200 dòng dữ liệu hiển thị cũng được lưu làm snapshot cho đến khi widget hoặc dashboard bị xóa.',
                        ],
                    },
                    {
                        title: 'Cách dữ liệu được sử dụng',
                        paragraphs: [
                            'Dữ liệu tài khoản được dùng để xác thực, đồng bộ phiên đăng nhập, cá nhân hóa giao diện và duy trì các tính năng cộng tác, lịch sử hoặc billing khi có.',
                        ],
                        bullets: [
                            'Bảo vệ phiên đăng nhập và phát hiện đăng nhập bất thường.',
                            'Khôi phục workspace, draft và lịch sử sử dụng khi bạn quay lại.',
                            'Cung cấp trải nghiệm AI theo provider hoặc model mà bạn đã cấu hình.',
                            'Theo mặc định, ngữ cảnh AI chỉ gồm metadata về schema, bảng, cột và quan hệ; hệ thống không đọc hoặc gửi giá trị trong các dòng dữ liệu.',
                        ],
                    },
                    {
                        title: 'Thông tin đăng nhập database của bạn',
                        paragraphs: [
                            'Mật khẩu, SSH private key và API key của AI provider mà bạn cung cấp được mã hóa bằng AES-256-GCM trước khi lưu trữ và chỉ được giải mã trong khoảnh khắc thiết lập kết nối theo yêu cầu của bạn.',
                            'Chúng tôi không bao giờ hiển thị lại các thông tin này sau khi đã lưu, không ghi chúng vào log và không chia sẻ với bên thứ ba. Việc xóa connection sẽ xóa vĩnh viễn các thông tin đăng nhập liên quan.',
                        ],
                    },
                    {
                        title: 'Dịch vụ bên thứ ba',
                        paragraphs: [
                            'Data Explorer vận hành trên hạ tầng cloud và sử dụng một số dịch vụ hỗ trợ. Các bên này chỉ nhận dữ liệu ở mức tối thiểu cần thiết để thực hiện chức năng:',
                        ],
                        bullets: [
                            'Nhà cung cấp AI (OpenRouter, Google, Groq...) chỉ nhận schema metadata và prompt bạn chủ động gửi; không nhận giá trị dòng dữ liệu trừ khi bạn tự dán vào chat.',
                            'Dịch vụ email dùng để gửi mã xác minh và thông báo tài khoản.',
                            'Hạ tầng hosting và CDN phục vụ ứng dụng.',
                        ],
                    },
                    {
                        title: 'Cookie và lưu trữ cục bộ',
                        paragraphs: [
                            'Chúng tôi sử dụng một cookie httpOnly mã hóa để duy trì phiên đăng nhập và localStorage để lưu trạng thái giao diện (tab mở, theme, ngôn ngữ). Không dùng cookie quảng cáo hay theo dõi bên thứ ba.',
                        ],
                    },
                    {
                        title: 'Lưu giữ và bảo mật',
                        paragraphs: [
                            'Chúng tôi áp dụng cơ chế xác thực, kiểm soát quyền và guardrail mức ứng dụng để giảm rủi ro truy cập trái phép. Dữ liệu chỉ được giữ trong phạm vi cần thiết để cung cấp dịch vụ và đáp ứng yêu cầu vận hành hợp lý.',
                        ],
                    },
                    {
                        title: 'Quyền của bạn',
                        paragraphs: [
                            'Bạn có thể yêu cầu xem, chỉnh sửa hoặc xóa dữ liệu tài khoản của mình trong phạm vi sản phẩm hỗ trợ hoặc thông qua kênh liên hệ pháp lý.',
                            'Bạn có thể xuất hoặc xóa toàn bộ connections, saved queries và workspace bất cứ lúc nào trực tiếp trong sản phẩm mà không cần liên hệ.',
                        ],
                    },
                    {
                        title: 'Thay đổi chính sách',
                        paragraphs: [
                            'Khi có thay đổi đáng kể về chính sách riêng tư, chúng tôi sẽ thông báo qua email hoặc thông báo trong ứng dụng trước khi thay đổi có hiệu lực. Ngày hiệu lực ở đầu tài liệu luôn phản ánh phiên bản mới nhất.',
                        ],
                    },
                ],
            },
            terms: {
                title: 'Điều khoản dịch vụ',
                subtitle: 'Những nguyên tắc cơ bản khi bạn truy cập, đăng ký và sử dụng Data Explorer trong công việc hàng ngày.',
                effectiveDate: 'Hiệu lực từ 28/06/2026',
                sections: [
                    {
                        title: 'Tài khoản và quyền truy cập',
                        paragraphs: [
                            'Bạn chịu trách nhiệm với tài khoản của mình, bao gồm thông tin đăng nhập, provider OAuth được liên kết và mọi thao tác được thực hiện trong phạm vi tài khoản đó.',
                        ],
                        bullets: [
                            'Không dùng tài khoản của người khác khi chưa được phép.',
                            'Không cố tình vượt qua cơ chế phân quyền, guardrail hoặc hạn chế truy cập của hệ thống.',
                        ],
                    },
                    {
                        title: 'Sử dụng chấp nhận được',
                        paragraphs: [
                            'Bạn chỉ nên dùng Data Explorer cho các hoạt động hợp pháp, an toàn và phù hợp với quyền truy cập dữ liệu mà mình thực sự sở hữu hoặc được ủy quyền.',
                        ],
                        bullets: [
                            'Không dùng sản phẩm để phá hoại dữ liệu, đánh cắp thông tin hoặc khai thác trái phép hạ tầng.',
                            'Không gửi nội dung vi phạm pháp luật, độc hại hoặc cố tình gây mất ổn định dịch vụ.',
                        ],
                    },
                    {
                        title: 'Nội dung AI và kết quả truy vấn',
                        paragraphs: [
                            'Các gợi ý AI, câu SQL hoặc diễn giải do hệ thống sinh ra chỉ mang tính hỗ trợ. Bạn vẫn là người chịu trách nhiệm cuối cùng trước khi chạy truy vấn trên dữ liệu thật.',
                        ],
                    },
                    {
                        title: 'Thanh toán và gói dịch vụ',
                        paragraphs: [
                            'Các gói trả phí (nếu có) được tính theo chu kỳ bạn chọn khi đăng ký. Phí đã thanh toán cho chu kỳ hiện tại không hoàn lại khi bạn hủy giữa chu kỳ, nhưng bạn vẫn dùng được đến hết chu kỳ đó.',
                            'Bạn có thể hủy gia hạn bất cứ lúc nào trong phần cài đặt tài khoản. Việc không thanh toán đúng hạn có thể dẫn đến việc hạ cấp tài khoản về gói miễn phí.',
                        ],
                    },
                    {
                        title: 'Sở hữu trí tuệ',
                        paragraphs: [
                            'Bạn giữ toàn bộ quyền sở hữu với dữ liệu của mình: connections, truy vấn, dashboard, schema và mọi nội dung bạn tạo trong workspace.',
                            'Data Explorer giữ quyền sở hữu với phần mềm, giao diện, thương hiệu và mọi cải tiến của sản phẩm. Bạn không được sao chép, reverse engineer hoặc tạo sản phẩm phái sinh từ mã nguồn của chúng tôi khi chưa được phép.',
                        ],
                    },
                    {
                        title: 'Tuyên bố miễn trừ trách nhiệm',
                        paragraphs: [
                            'Dịch vụ được cung cấp "nguyên trạng". Chúng tôi không cam kết dịch vụ hoạt động không gián đoạn hoặc không lỗi, và không chịu trách nhiệm với thiệt hại phát sinh từ việc bạn chạy truy vấn (đặc biệt là các truy vấn thay đổi dữ liệu) trên hệ thống của mình.',
                            'Bạn nên luôn kiểm tra cẩn thận các truy vấn hủy dữ liệu và sao lưu trước khi thao tác với database production.',
                        ],
                    },
                    {
                        title: 'Giới hạn trách nhiệm pháp lý',
                        paragraphs: [
                            'Trong mọi trường hợp, tổng trách nhiệm của chúng tôi không vượt quá số tiền bạn đã thanh toán cho dịch vụ trong 12 tháng gần nhất. Chúng tôi không chịu trách nhiệm với thiệt hại gián tiếp, mất dữ liệu kinh doanh hoặc mất lợi nhuận.',
                        ],
                    },
                    {
                        title: 'Tạm ngưng hoặc chấm dứt',
                        paragraphs: [
                            'Chúng tôi có thể giới hạn hoặc tạm ngưng tài khoản nếu phát hiện hành vi lạm dụng, vi phạm bảo mật hoặc sử dụng sản phẩm theo cách có nguy cơ ảnh hưởng đến người dùng khác hoặc hệ thống.',
                            'Bạn có thể xóa tài khoản bất cứ lúc nào trong cài đặt. Khi tài khoản bị xóa, dữ liệu cá nhân và workspace của bạn sẽ bị gỡ theo chính sách lưu giữ.',
                        ],
                    },
                ],
            },
        },
        en: {
            legal: {
                title: 'Legal center',
                subtitle: 'One place to review the operating commitments, privacy rules, and product terms behind Data Explorer.',
                effectiveDate: 'Effective June 28, 2026',
                quickLinks: [
                    { label: 'Read the privacy policy', href: '/privacy' },
                    { label: 'Read the terms of service', href: '/terms' },
                ],
                sections: [
                    {
                        title: 'How these documents work',
                        paragraphs: [
                            'These documents explain how Data Explorer handles accounts, configuration data, query results, AI-related content, and the baseline responsibilities that come with using the product.',
                            'If you create an account or use authenticated parts of the product, your continued use follows the documents linked from this page.',
                        ],
                    },
                    {
                        title: 'What applies when you sign up',
                        paragraphs: [
                            'When you create an account, you confirm that you control the email address you use, that you are responsible for the queries and content you send through the system, and that you agree to the current terms and privacy policy.',
                        ],
                        bullets: [
                            'The terms of service describe access rights, usage boundaries, and when an account may be limited or suspended.',
                            'The privacy policy explains what data is stored, why it is needed, and what requests you can make about it.',
                        ],
                    },
                    {
                        title: 'Contact and legal requests',
                        paragraphs: [
                            'For requests about personal data, account security, or product terms, contact the operations team at legal@dataexplorer.app.',
                        ],
                    },
                ],
            },
            privacy: {
                title: 'Privacy policy',
                subtitle: 'A practical summary of how Data Explorer collects, uses, retains, and protects account and workspace information.',
                effectiveDate: 'Effective June 28, 2026',
                sections: [
                    {
                        title: 'What we collect',
                        paragraphs: [
                            'We collect the fields needed to operate your account, such as email, display identity, profile details, interface preferences, and the notification settings you choose.',
                            'Inside the workspace, the system may store metadata such as connections, saved queries, activity history, dashboards, ERD workspaces, and AI settings that you explicitly create. When you save query results as a dashboard widget, up to 200 displayed rows are also retained as a snapshot until the widget or dashboard is deleted.',
                        ],
                    },
                    {
                        title: 'How the data is used',
                        paragraphs: [
                            'Account data is used to authenticate users, maintain sessions, personalize the interface, and support collaboration, history, and billing-related flows when enabled.',
                        ],
                        bullets: [
                            'Protect account sessions and detect unusual sign-ins.',
                            'Restore workspace state, drafts, and usage history when you return.',
                            'Deliver AI experiences through the provider or model choices you configured.',
                            'By default, AI context contains only schema, table, column, and relationship metadata; the system does not read or send row values.',
                        ],
                    },
                    {
                        title: 'Your database credentials',
                        paragraphs: [
                            'Passwords, SSH private keys, and AI provider API keys you provide are encrypted with AES-256-GCM before storage and are decrypted only for the moment a connection is established at your request.',
                            'We never display these secrets again after they are saved, never write them to logs, and never share them with third parties. Deleting a connection permanently deletes its credentials.',
                        ],
                    },
                    {
                        title: 'Third-party services',
                        paragraphs: [
                            'Data Explorer runs on cloud infrastructure and relies on a small set of support services. These parties only receive the minimum data needed to perform their function:',
                        ],
                        bullets: [
                            'AI providers (OpenRouter, Google, Groq, ...) only receive schema metadata and prompts you deliberately send; row values are not included unless you paste them into a chat yourself.',
                            'An email delivery service used for verification codes and account notifications.',
                            'Hosting and CDN infrastructure that serves the application.',
                        ],
                    },
                    {
                        title: 'Cookies and local storage',
                        paragraphs: [
                            'We use a single encrypted httpOnly cookie to keep you signed in, plus localStorage for interface state (open tabs, theme, language). We do not use advertising or third-party tracking cookies.',
                        ],
                    },
                    {
                        title: 'Retention and security',
                        paragraphs: [
                            'We use authentication controls, permission boundaries, and application-level guardrails to reduce unauthorized access. Data is kept only as long as reasonably required to operate the service and support legitimate product workflows.',
                        ],
                    },
                    {
                        title: 'Your choices',
                        paragraphs: [
                            'You can request access to, correction of, or deletion of your account data through supported product flows or through the legal contact channel.',
                            'You can export or delete all of your connections, saved queries, and workspaces at any time directly in the product — no need to contact us.',
                        ],
                    },
                    {
                        title: 'Changes to this policy',
                        paragraphs: [
                            'If we make material changes to this policy, we will notify you by email or in-app notice before the change takes effect. The effective date at the top of this document always reflects the latest version.',
                        ],
                    },
                ],
            },
            terms: {
                title: 'Terms of service',
                subtitle: 'The baseline rules for accessing, registering for, and using Data Explorer in day-to-day work.',
                effectiveDate: 'Effective June 28, 2026',
                sections: [
                    {
                        title: 'Accounts and access',
                        paragraphs: [
                            'You are responsible for your account, including login credentials, linked OAuth providers, and activity performed through that account.',
                        ],
                        bullets: [
                            'Do not use another person\'s account without permission.',
                            'Do not bypass product permissions, guardrails, or access restrictions.',
                        ],
                    },
                    {
                        title: 'Acceptable use',
                        paragraphs: [
                            'Use Data Explorer only for lawful, safe work and only against data systems that you own or are authorized to access.',
                        ],
                        bullets: [
                            'Do not use the product to damage data, exfiltrate information, or attack infrastructure.',
                            'Do not submit illegal, harmful, or intentionally disruptive content.',
                        ],
                    },
                    {
                        title: 'AI output and query results',
                        paragraphs: [
                            'AI suggestions, generated SQL, and textual explanations are assistive outputs. You remain responsible for reviewing them before running anything against production data.',
                        ],
                    },
                    {
                        title: 'Billing and plans',
                        paragraphs: [
                            'Paid plans (if any) are billed for the cycle you choose at signup. Fees already paid for the current cycle are non-refundable upon mid-cycle cancellation, but your plan remains active until the end of that cycle.',
                            'You can cancel renewal at any time from account settings. Failed payments may result in your account being downgraded to the free plan.',
                        ],
                    },
                    {
                        title: 'Intellectual property',
                        paragraphs: [
                            'You retain full ownership of your data: connections, queries, dashboards, schemas, and everything else you create in your workspace.',
                            'Data Explorer retains all rights to the software, interface, branding, and product improvements. You may not copy, reverse engineer, or build derivative products from our code without permission.',
                        ],
                    },
                    {
                        title: 'Disclaimers',
                        paragraphs: [
                            'The service is provided "as is". We do not promise uninterrupted or error-free operation and are not liable for damage arising from queries you run (especially data-modifying queries) against your own systems.',
                            'Always double-check destructive queries and back up your data before operating on production databases.',
                        ],
                    },
                    {
                        title: 'Limitation of liability',
                        paragraphs: [
                            'To the maximum extent permitted by law, our total liability will not exceed the amount you paid for the service in the preceding 12 months. We are not liable for indirect damages, loss of business data, or lost profits.',
                        ],
                    },
                    {
                        title: 'Suspension or termination',
                        paragraphs: [
                            'We may limit or suspend access if an account is abusive, violates security expectations, or uses the product in a way that creates risk for other users or the service itself.',
                            'You can delete your account at any time from settings. When an account is deleted, your personal data and workspaces are removed according to our retention policy.',
                        ],
                    },
                ],
            },
        },
    } as const;

    return docs[lang][key];
};
