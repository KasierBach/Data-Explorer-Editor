export type LegalDocKey = 'legal' | 'privacy' | 'terms';

type LegalSection = {
    id: string;
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
                subtitle: 'Đọc chính sách riêng tư và điều khoản sử dụng để hiểu dữ liệu nào đi qua workspace, các lựa chọn của bạn và trách nhiệm khi làm việc với database.',
                effectiveDate: 'Hiệu lực từ 28/06/2026',
                quickLinks: [
                    { label: 'Xem chính sách riêng tư', href: '/privacy' },
                    { label: 'Xem điều khoản dịch vụ', href: '/terms' },
                ],
                sections: [
                    {
                        id: 'scope',
                        title: 'Phạm vi của các tài liệu',
                        paragraphs: [
                            'Bộ tài liệu này mô tả việc sử dụng Data Explorer, xử lý thông tin tài khoản, cấu hình kết nối, nội dung workspace và các luồng AI tùy chọn. Chính sách riêng tư giải thích cách dữ liệu được xử lý; Điều khoản dịch vụ nêu quyền truy cập và trách nhiệm sử dụng.',
                            'Database bạn kết nối là hệ thống riêng với quyền truy cập do bạn hoặc bên quản trị database cấp. Data Explorer không thay thế quyền đó, chính sách của database hay nghĩa vụ của bạn đối với dữ liệu của người khác.',
                        ],
                    },
                    {
                        id: 'account',
                        title: 'Khi bạn tạo và sử dụng tài khoản',
                        paragraphs: [
                            'Khi tạo tài khoản, bạn xác nhận có quyền sử dụng email đăng ký, chịu trách nhiệm với thông tin và thao tác của tài khoản, đồng thời chấp thuận các tài liệu pháp lý được liên kết trong luồng đăng ký hoặc chấp thuận.',
                        ],
                        bullets: [
                            'Đọc Điều khoản dịch vụ trước khi kết nối database, thực thi truy vấn hoặc sử dụng tính năng trả phí.',
                            'Đọc Chính sách riêng tư trước khi lưu query, chia sẻ workspace, gửi nội dung AI hoặc đính kèm tệp.',
                            'Chỉ kết nối hệ thống và xử lý dữ liệu mà bạn sở hữu hoặc được ủy quyền truy cập.',
                        ],
                    },
                    {
                        id: 'deployment',
                        title: 'Bản hosted và bản tự triển khai',
                        paragraphs: [
                            'Với bản hosted, tài khoản và nội dung bạn chọn lưu được xử lý qua backend và các dịch vụ hạ tầng mà bản triển khai sử dụng. Database đích, dịch vụ OAuth, thanh toán và AI có thể do các bên khác vận hành.',
                            'Nếu tự triển khai, bên vận hành bản đó chịu trách nhiệm lựa chọn hạ tầng, cấu hình secret, quyền truy cập, sao lưu, lưu giữ dữ liệu và kênh tiếp nhận yêu cầu. Cấu hình hoặc khả năng của bản tự triển khai không phải cam kết về mọi bản hosted.',
                            'Mã nguồn Data Explorer được cung cấp theo MIT License. Quyền sử dụng mã nguồn và các điều kiện kèm theo được nêu trong tệp LICENSE của repository, tách biệt với tài khoản và dịch vụ hosted.',
                        ],
                    },
                    {
                        id: 'contact',
                        title: 'Liên hệ và yêu cầu pháp lý',
                        paragraphs: [
                            'Nếu bạn cần gửi yêu cầu liên quan đến dữ liệu cá nhân, bảo mật tài khoản hoặc điều khoản sử dụng, hãy liên hệ đội vận hành qua địa chỉ legal@dataexplorer.app.',
                            'Không gửi mật khẩu database, private key, API key, token phiên hoặc dữ liệu nhạy cảm không cần thiết trong yêu cầu. Với bản tự triển khai, liên hệ bên vận hành của bản đó để xác định phạm vi dữ liệu và cách xử lý yêu cầu.',
                        ],
                    },
                ],
            },
            privacy: {
                title: 'Chính sách riêng tư',
                subtitle: 'Cách tài khoản, kết nối, nội dung workspace và AI tùy chọn được xử lý — cùng các lựa chọn và giới hạn khi bạn lưu, chia sẻ hoặc yêu cầu xóa dữ liệu.',
                effectiveDate: 'Hiệu lực từ 28/06/2026',
                sections: [
                    {
                        id: 'data',
                        title: 'Thông tin tài khoản và workspace',
                        paragraphs: [
                            'Ứng dụng xử lý các trường cần cho tài khoản như email, tên, thông tin hồ sơ, danh tính đăng nhập qua OAuth, cấu hình giao diện và cài đặt bạn lựa chọn. Các trường hồ sơ hoặc onboarding bạn cung cấp cũng có thể được lưu.',
                            'Nội dung workspace có thể gồm cấu hình và metadata kết nối, SQL đã lưu, lịch sử truy vấn và thao tác, dashboard, sơ đồ ERD, bản nháp và thiết lập AI. Query result được lưu thành widget dashboard có thể giữ snapshot tối đa 200 dòng dữ liệu hiển thị, không chỉ tên bảng hoặc cột.',
                            'Một số thao tác truy vấn và quản trị tạo bản ghi audit, có thể bao gồm câu SQL và thông tin về thao tác. SQL, tên đối tượng và dữ liệu bạn chọn lưu có thể chứa thông tin cá nhân; hãy cân nhắc nội dung trước khi gửi hoặc lưu.',
                        ],
                    },
                    {
                        id: 'purpose',
                        title: 'Mục đích và luồng xử lý dữ liệu',
                        paragraphs: [
                            'Thông tin tài khoản được dùng để xác thực, duy trì phiên, khôi phục trạng thái làm việc, cá nhân hóa giao diện và cung cấp tính năng cộng tác hoặc billing được bật.',
                            'Khi bạn dùng một kết nối, backend giao tiếp với database đích bằng quyền của kết nối để lấy schema, chạy thao tác và trả kết quả. Dữ liệu được chọn lưu trong query, dashboard hoặc nội dung AI là một phần riêng với dữ liệu gốc trong database.',
                        ],
                        bullets: [
                            'Kiểm soát quyền truy cập vào tài khoản, kết nối và tài nguyên chia sẻ.',
                            'Duy trì query đã lưu, workspace và các cài đặt bạn lựa chọn.',
                            'Ghi nhận thao tác, trạng thái thanh toán và thông tin cần cho vận hành.',
                            'Cung cấp AI qua provider và model được cấu hình khi bạn sử dụng tính năng AI.',
                        ],
                    },
                    {
                        id: 'credentials',
                        title: 'Thông tin đăng nhập database và API key',
                        paragraphs: [
                            'Mật khẩu kết nối, SSH secret và AI API key mới được lưu qua các luồng hỗ trợ được mã hóa bằng AES-256-GCM. Các trường secret được loại khỏi phản hồi metadata kết nối thông thường.',
                            'Backend giải mã secret khi cần cho thao tác vận hành và dùng chúng để xác thực tới database, SSH host hoặc endpoint AI mà bạn cấu hình. API key là thông tin xác thực được gửi tới dịch vụ nhận yêu cầu; không đồng nghĩa với việc mọi secret chỉ được dùng tại thời điểm tạo kết nối.',
                            'Biện pháp bảo vệ còn phụ thuộc cấu hình bản triển khai, quyền quản trị và bên nhận dữ liệu. Không chia sẻ secret trong SQL, chat, ảnh, tệp hoặc tài nguyên cộng tác. Việc xóa một tài nguyên trong ứng dụng không bảo đảm mọi bản sao trong backup hoặc hệ thống bên thứ ba bị xóa ngay.',
                        ],
                    },
                    {
                        id: 'ai',
                        title: 'AI tùy chọn và tệp đính kèm',
                        paragraphs: [
                            'Bạn có thể làm việc với database mà không bật AI. Khi dùng AI, yêu cầu có thể gồm prompt, lịch sử hội thoại, schema hoặc ngữ cảnh kết nối và nội dung bạn chọn đính kèm, gửi qua backend tới provider được cấu hình.',
                            'Ngữ cảnh đính kèm có thể gồm văn bản, SQL, dữ liệu bảng, tệp, ảnh hoặc PDF được tính năng hỗ trợ. Những nội dung này có thể chứa giá trị dòng dữ liệu hoặc thông tin cá nhân ngay cả khi bạn không tự dán chúng vào chat. Không phải mọi query result đều tự động gửi tới AI.',
                            'Hội thoại, câu SQL sinh ra, giải thích và một phần nội dung attachment có thể được lưu trong ứng dụng theo luồng sử dụng. Nội dung tin nhắn AI không nằm trong phần trạng thái chat được lưu lâu dài ở browser; metadata chat và preferences có thể có ở đó. Một số attachment nhị phân không được giữ trong bản lưu hội thoại.',
                            'Provider AI có chính sách lưu giữ và xử lý riêng. Xóa hội thoại hoặc tắt AI trong Data Explorer không tự xóa dữ liệu đã nhận bởi provider; kiểm tra provider, model và nội dung trước khi gửi.',
                        ],
                    },
                    {
                        id: 'sharing',
                        title: 'Chia sẻ và các dịch vụ bên thứ ba',
                        paragraphs: [
                            'Khi bạn chia sẻ tài nguyên cho team hoặc workspace, người có quyền tương ứng có thể truy cập nội dung được chia sẻ. Dữ liệu query, dashboard snapshot hoặc sơ đồ có thể chứa thông tin về database; kiểm tra quyền và nội dung trước khi chia sẻ.',
                            'Bản triển khai có thể sử dụng dịch vụ ngoài cho các chức năng dưới đây. Phạm vi xử lý phụ thuộc chức năng và cấu hình; các bên nhận dữ liệu có chính sách của họ.',
                        ],
                        bullets: [
                            'Nhà cung cấp OAuth xử lý luồng đăng nhập và cung cấp thông tin danh tính được cho phép.',
                            'Dịch vụ email xử lý việc gửi mã xác minh và thông báo tài khoản.',
                            'Hạ tầng hosting, lưu trữ và CDN phục vụ ứng dụng và backend.',
                            'MoMo hoặc ZaloPay xử lý checkout và xác nhận giao dịch khi bạn chọn thanh toán.',
                            'Endpoint AI được cấu hình nhận nội dung và thông tin xác thực cần cho yêu cầu AI.',
                        ],
                    },
                    {
                        id: 'browser',
                        title: 'Cookie và lưu trữ trong trình duyệt',
                        paragraphs: [
                            'Phiên đăng nhập sử dụng refresh cookie được mã hóa và đánh dấu HttpOnly cùng access token được giữ trong bộ nhớ ứng dụng. Cấu hình cookie như Secure, SameSite và thời hạn phụ thuộc bản triển khai.',
                            'localStorage có thể giữ metadata kết nối đã được loại secret, tab đang mở, trạng thái trang/workspace và preferences như theme, ngôn ngữ hoặc cấu hình chat. Phần persistence này không giữ access token, hồ sơ xác thực hay nội dung tin nhắn AI.',
                            'Xóa dữ liệu browser có thể làm mất trạng thái cục bộ nhưng không tự xóa dữ liệu lưu ở backend, database đích hoặc provider. Cookie và storage của dịch vụ OAuth, thanh toán hoặc website bên thứ ba chịu chính sách riêng của dịch vụ đó.',
                        ],
                    },
                    {
                        id: 'retention',
                        title: 'Lưu giữ, xóa dữ liệu và bảo mật',
                        paragraphs: [
                            'Các loại dữ liệu có vòng đời khác nhau. Nội dung đã lưu, audit, giao dịch, bản ghi hoạt động AI và feedback không nhất thiết được xóa cùng lúc với một connection hoặc hội thoại.',
                            'Ứng dụng có cơ chế cleanup theo cấu hình cho một số bản ghi audit, payment payload và hội thoại AI. Cleanup hội thoại có phạm vi riêng, không tự bao gồm backup, bản xuất, bản ghi AI khác hoặc dữ liệu provider. Các giá trị mặc định trong mã nguồn không phải thời hạn lưu giữ được cam kết cho mọi bản triển khai.',
                            'Yêu cầu xóa có thể cần xác minh quyền, xử lý tài nguyên chia sẻ và các ràng buộc lưu trữ. Không có cam kết rằng mọi dữ liệu hoặc bản sao biến mất tức thì sau một nút xóa. Với bản tự triển khai, bên vận hành chịu trách nhiệm cấu hình retention, backup và bảo vệ hạ tầng.',
                            'Ứng dụng áp dụng xác thực, phân quyền, mã hóa secret và guardrail để giảm rủi ro, nhưng không bảo đảm loại bỏ mọi rủi ro bảo mật hoặc thay thế việc quản trị database an toàn.',
                        ],
                    },
                    {
                        id: 'choices',
                        title: 'Các lựa chọn và yêu cầu của bạn',
                        paragraphs: [
                            'Bạn có thể xem hoặc chỉnh sửa thông tin qua tính năng được hỗ trợ, quản lý tài nguyên thuộc quyền của mình và yêu cầu hỗ trợ về truy cập, sửa hoặc xóa dữ liệu qua kênh liên hệ pháp lý.',
                            'Khả năng xuất hoặc xóa tùy thuộc loại tài nguyên, quyền truy cập và trạng thái hệ thống; không phải mọi dữ liệu đều có nút export-all hoặc delete-all. Xóa metadata kết nối trong Data Explorer không đồng nghĩa xóa database đích.',
                            'Trước khi chia sẻ hoặc gửi AI, hãy chọn đúng tài nguyên và giới hạn dữ liệu nhạy cảm. Không gửi secret trong yêu cầu hỗ trợ. Với bản tự triển khai, liên hệ bên vận hành của bản đó.',
                        ],
                    },
                    {
                        id: 'changes',
                        title: 'Thay đổi chính sách',
                        paragraphs: [
                            'Khi có thay đổi đáng kể về chính sách riêng tư, chúng tôi sẽ thông báo qua email hoặc thông báo trong ứng dụng trước khi thay đổi có hiệu lực. Ngày hiệu lực ở đầu tài liệu luôn phản ánh phiên bản mới nhất.',
                        ],
                    },
                ],
            },
            terms: {
                title: 'Điều khoản dịch vụ',
                subtitle: 'Quyền truy cập, sử dụng database, nội dung AI và thanh toán: các nguyên tắc khi bạn làm việc với Data Explorer.',
                effectiveDate: 'Hiệu lực từ 28/06/2026',
                sections: [
                    {
                        id: 'account',
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
                        id: 'use',
                        title: 'Sử dụng chấp nhận được',
                        paragraphs: [
                            'Bạn chỉ nên dùng Data Explorer cho các hoạt động hợp pháp, an toàn và phù hợp với quyền truy cập dữ liệu mà mình thực sự sở hữu hoặc được ủy quyền.',
                        ],
                        bullets: [
                            'Không dùng sản phẩm để phá hoại dữ liệu, đánh cắp thông tin hoặc khai thác trái phép hạ tầng.',
                            'Không gửi nội dung vi phạm pháp luật, độc hại hoặc cố tình gây mất ổn định dịch vụ.',
                            'Chỉ dùng connection và tài nguyên chia sẻ trong phạm vi quyền được cấp; quyền UI không mở rộng quyền thực tế của database.',
                        ],
                    },
                    {
                        id: 'database',
                        title: 'Truy vấn, dữ liệu và tài nguyên chia sẻ',
                        paragraphs: [
                            'Lệnh được thực thi bằng quyền của kết nối đang dùng. Bạn chịu trách nhiệm xác nhận database, câu lệnh, phạm vi dữ liệu và người nhận tài nguyên trước khi thực thi, lưu, xuất hoặc chia sẻ.',
                            'Guardrail và cảnh báo là hỗ trợ, không bảo đảm mọi lệnh nguy hiểm đều được phát hiện hoặc có thể hoàn tác. Backup, quyền read-only và quy trình phê duyệt của hệ thống đích vẫn cần được quản lý riêng.',
                            'Snapshot dashboard hoặc kết quả xuất chỉ phản ánh phần dữ liệu được lưu/tải; không phải backup đầy đủ hay cam kết luôn đồng bộ với database gốc.',
                        ],
                    },
                    {
                        id: 'ai',
                        title: 'Nội dung AI và kết quả truy vấn',
                        paragraphs: [
                            'Các gợi ý AI, câu SQL hoặc diễn giải do hệ thống sinh ra chỉ mang tính hỗ trợ. Bạn vẫn là người chịu trách nhiệm cuối cùng trước khi chạy truy vấn trên dữ liệu thật.',
                            'AI là tùy chọn. Khi sử dụng, bạn chịu trách nhiệm với quyền gửi prompt, schema/context và attachment tới endpoint/provider đã cấu hình. Nội dung sinh ra có thể sai, thiếu hoặc không phù hợp với engine và dữ liệu của bạn; hãy kiểm tra trước khi áp dụng.',
                        ],
                    },
                    {
                        id: 'billing',
                        title: 'Thanh toán và gói dịch vụ',
                        paragraphs: [
                            'Luồng thanh toán hiện hỗ trợ MoMo và ZaloPay. Mỗi giao dịch thành công được xác nhận bằng webhook hợp lệ sẽ cấp hoặc cộng thêm thời hạn Pro 30 ngày hoặc 365 ngày theo gói chọn. Việc quay lại từ trang checkout không tự chứng minh giao dịch đã thanh toán.',
                            'Đây là thời hạn truy cập được mua qua từng lần checkout; không có cam kết về tính năng auto-renew hay nút hủy gia hạn. Mã gói và trạng thái Pro không đồng nghĩa mọi entitlement hoặc quota nâng cao đã được triển khai; xem thông tin gói hiện tại trước khi thanh toán.',
                            'Phí đã thanh toán cho thời hạn hiện tại không hoàn lại khi bạn ngừng sử dụng giữa thời hạn, nhưng quyền truy cập của gói vẫn kéo dài đến ngày hết hạn.',
                        ],
                    },
                    {
                        id: 'license',
                        title: 'Dữ liệu của bạn và giấy phép mã nguồn',
                        paragraphs: [
                            'Bạn giữ các quyền hiện có đối với dữ liệu và nội dung mà bạn sở hữu hoặc được phép sử dụng trong workspace. Không dùng việc lưu hoặc chia sẻ trong Data Explorer để yêu cầu quyền với dữ liệu của người khác.',
                            'Mã nguồn repository Data Explorer được cung cấp theo MIT License, cho phép sử dụng, sao chép, chỉnh sửa và phân phối theo các điều kiện trong LICENSE, bao gồm giữ thông báo bản quyền và giấy phép. Các điều khoản dịch vụ này không thu hồi những quyền được cấp bởi giấy phép mã nguồn.',
                            'MIT License áp dụng cho mã nguồn và tài liệu được cấp phép; việc truy cập tài khoản, dịch vụ hosted và các dịch vụ bên thứ ba vẫn chịu điều kiện sử dụng tương ứng. Đọc LICENSE để biết đầy đủ điều kiện và tuyên bố miễn trừ của mã nguồn.',
                        ],
                    },
                    {
                        id: 'disclaimer',
                        title: 'Tuyên bố miễn trừ trách nhiệm',
                        paragraphs: [
                            'Dịch vụ được cung cấp "nguyên trạng". Chúng tôi không cam kết dịch vụ hoạt động không gián đoạn hoặc không lỗi, và không chịu trách nhiệm với thiệt hại phát sinh từ việc bạn chạy truy vấn (đặc biệt là các truy vấn thay đổi dữ liệu) trên hệ thống của mình.',
                            'Bạn nên luôn kiểm tra cẩn thận các truy vấn hủy dữ liệu và sao lưu trước khi thao tác với database production.',
                        ],
                    },
                    {
                        id: 'liability',
                        title: 'Giới hạn trách nhiệm pháp lý',
                        paragraphs: [
                            'Trong mọi trường hợp, tổng trách nhiệm của chúng tôi không vượt quá số tiền bạn đã thanh toán cho dịch vụ trong 12 tháng gần nhất. Chúng tôi không chịu trách nhiệm với thiệt hại gián tiếp, mất dữ liệu kinh doanh hoặc mất lợi nhuận.',
                        ],
                    },
                    {
                        id: 'termination',
                        title: 'Tạm ngưng hoặc chấm dứt',
                        paragraphs: [
                            'Chúng tôi có thể giới hạn hoặc tạm ngưng tài khoản nếu phát hiện hành vi lạm dụng, vi phạm bảo mật hoặc sử dụng sản phẩm theo cách có nguy cơ ảnh hưởng đến người dùng khác hoặc hệ thống.',
                            'Việc xóa hoặc yêu cầu xóa tài khoản qua luồng được hỗ trợ phụ thuộc quyền và các ràng buộc lưu trữ. Nội dung chia sẻ, audit, giao dịch, backup và dữ liệu đã gửi tới provider có thể cần xử lý riêng; không bảo đảm mọi bản sao được gỡ ngay cùng tài khoản.',
                        ],
                    },
                    {
                        id: 'deployment',
                        title: 'Tự triển khai và dịch vụ bên thứ ba',
                        paragraphs: [
                            'Khi tự triển khai, bạn hoặc bên vận hành chịu trách nhiệm cấu hình hạ tầng, secret, quyền database, backup, retention và các dịch vụ tích hợp. Hướng dẫn local development không phải cam kết về cấu hình production của mọi hệ thống.',
                            'OAuth, email, hosting, thanh toán và provider AI có điều kiện sử dụng riêng. Tính năng tích hợp không thay thế nghĩa vụ kiểm tra điều kiện, phạm vi dữ liệu và chi phí của các dịch vụ đó.',
                        ],
                    },
                ],
            },
        },
        en: {
            legal: {
                title: 'Legal center',
                subtitle: 'Read the privacy policy and terms to understand what passes through your workspace, the choices you have, and your responsibilities when working with databases.',
                effectiveDate: 'Effective June 28, 2026',
                quickLinks: [
                    { label: 'Read the privacy policy', href: '/privacy' },
                    { label: 'Read the terms of service', href: '/terms' },
                ],
                sections: [
                    {
                        id: 'scope',
                        title: 'Scope of these documents',
                        paragraphs: [
                            'These documents describe using Data Explorer and handling account information, connection configuration, workspace content, and optional AI flows. The privacy policy explains data handling; the terms of service cover access and responsibilities.',
                            'The databases you connect are separate systems with permissions granted by you or their administrators. Data Explorer does not replace those permissions, database policies, or your obligations regarding other people’s data.',
                        ],
                    },
                    {
                        id: 'account',
                        title: 'Creating and using an account',
                        paragraphs: [
                            'When creating an account, you confirm that you may use the registration email, take responsibility for the account’s information and actions, and accept the legal documents linked in the registration or consent flow.',
                        ],
                        bullets: [
                            'Read the terms before connecting a database, executing queries, or using paid features.',
                            'Read the privacy policy before saving queries, sharing workspace resources, sending AI content, or attaching files.',
                            'Connect only systems and process only data that you own or are authorized to access.',
                        ],
                    },
                    {
                        id: 'deployment',
                        title: 'Hosted and self-hosted deployments',
                        paragraphs: [
                            'In a hosted deployment, account information and content you choose to save pass through the backend and its infrastructure services. Target databases, OAuth, payment, and AI services may be operated by other parties.',
                            'For a self-hosted deployment, its operator is responsible for infrastructure choices, secret configuration, access, backups, retention, and request handling. A self-hosted configuration or capability is not a commitment about every hosted deployment.',
                            'Data Explorer source code is provided under the MIT License. Source-use permissions and conditions are set out in the repository’s LICENSE file, separately from accounts and hosted services.',
                        ],
                    },
                    {
                        id: 'contact',
                        title: 'Contact and legal requests',
                        paragraphs: [
                            'For requests about personal data, account security, or product terms, contact the operations team at legal@dataexplorer.app.',
                            'Do not include database passwords, private keys, API keys, session tokens, or unnecessary sensitive data in a request. For a self-hosted deployment, contact its operator to establish the data scope and request process.',
                        ],
                    },
                ],
            },
            privacy: {
                title: 'Privacy policy',
                subtitle: 'How accounts, connections, workspace content, and optional AI are handled — including choices and limits when saving, sharing, or requesting deletion.',
                effectiveDate: 'Effective June 28, 2026',
                sections: [
                    {
                        id: 'data',
                        title: 'Account and workspace information',
                        paragraphs: [
                            'The application processes fields needed for an account, such as email, names, profile details, OAuth identity, interface configuration, and settings you choose. Profile or onboarding fields you provide may also be stored.',
                            'Workspace content can include connection configuration and metadata, saved SQL, query and activity history, dashboards, ERDs, drafts, and AI settings. A query result saved as a dashboard widget can retain a snapshot of up to 200 displayed rows, not only table or column names.',
                            'Some query and administrative actions create audit records that may include SQL and action details. SQL, object names, and content you choose to save may contain personal information; consider the content before sending or saving it.',
                        ],
                    },
                    {
                        id: 'purpose',
                        title: 'Purposes and data flows',
                        paragraphs: [
                            'Account information is used for authentication, sessions, restoring work state, interface preferences, and collaboration or billing features that are enabled.',
                            'When you use a connection, the backend communicates with the target database using that connection’s permissions to retrieve schema, perform operations, and return results. Content saved in queries, dashboards, or AI flows is separate from the source data in the database.',
                        ],
                        bullets: [
                            'Control access to accounts, connections, and shared resources.',
                            'Maintain saved queries, workspace state, and settings you choose.',
                            'Record activity, payment status, and information needed for operations.',
                            'Provide AI through configured providers and models when you use AI features.',
                        ],
                    },
                    {
                        id: 'credentials',
                        title: 'Database credentials and API keys',
                        paragraphs: [
                            'Newly saved connection passwords, SSH secrets, and AI API keys in supported flows are encrypted with AES-256-GCM. Secret fields are excluded from ordinary connection-metadata responses.',
                            'The backend decrypts secrets when needed for operational use and authenticates to the database, SSH host, or AI endpoint you configure. An API key is an authentication credential sent to the service receiving the request; this does not mean every secret is used only when a connection is first created.',
                            'Protection also depends on deployment configuration, administrative access, and the data recipient. Do not share secrets in SQL, chat, images, files, or collaborative resources. Deleting an application resource does not guarantee immediate deletion of every backup or third-party copy.',
                        ],
                    },
                    {
                        id: 'ai',
                        title: 'Optional AI and attachments',
                        paragraphs: [
                            'You can work with databases without enabling AI. When using AI, a request may include prompts, conversation history, schema or connection context, and selected attachments, passing through the backend to the configured provider.',
                            'Attachment context can include text, SQL, table data, files, images, or PDFs supported by the feature. These may contain row values or personal information even when you did not paste them into chat. Not every query result is automatically sent to AI.',
                            'Conversations, generated SQL, explanations, and some attachment content may be stored by the application as part of the flow. AI message bodies are not part of persisted browser chat state; chat metadata and preferences may be stored there. Some binary attachments are not retained in the saved conversation.',
                            'AI providers have their own handling and retention policies. Deleting a conversation or switching AI off in Data Explorer does not automatically erase data a provider has received; check the provider, model, and content before sending.',
                        ],
                    },
                    {
                        id: 'sharing',
                        title: 'Sharing and third-party services',
                        paragraphs: [
                            'When you share resources with a team or workspace, people with the corresponding permissions may access that shared content. Queries, dashboard snapshots, or diagrams may contain database information; review permissions and content before sharing.',
                            'A deployment may use external services for the functions below. Processing scope depends on the function and configuration, and recipients have their own policies.',
                        ],
                        bullets: [
                            'OAuth providers handle sign-in and supply the identity information you authorize.',
                            'Email services deliver verification codes and account notifications.',
                            'Hosting, storage, and CDN infrastructure serve the application and backend.',
                            'MoMo or ZaloPay handle checkout and transaction confirmation when you choose to pay.',
                            'Configured AI endpoints receive content and authentication information needed for AI requests.',
                        ],
                    },
                    {
                        id: 'browser',
                        title: 'Cookies and browser storage',
                        paragraphs: [
                            'Sign-in uses an encrypted HttpOnly refresh cookie together with an access token held in application memory. Cookie settings such as Secure, SameSite, and lifetime depend on the deployment.',
                            'localStorage may retain connection metadata with secrets removed, open tabs, page/workspace state, and preferences such as theme, language, or chat settings. This persistence does not retain access tokens, authenticated profile information, or AI message bodies.',
                            'Clearing browser data may remove local state but does not automatically delete backend, target-database, or provider data. Cookies and storage used by OAuth, payment, or other third-party websites are governed by those services’ policies.',
                        ],
                    },
                    {
                        id: 'retention',
                        title: 'Retention, deletion, and security',
                        paragraphs: [
                            'Data categories have different lifecycles. Saved content, audits, transactions, AI activity records, and feedback are not necessarily deleted together with a connection or conversation.',
                            'The application provides configurable cleanup for some audit records, payment payloads, and AI conversations. Conversation cleanup has its own scope and does not automatically include backups, exports, other AI records, or provider data. Source-code defaults are not promised retention periods for every deployment.',
                            'Deletion requests may require permission checks, handling shared resources, and resolving storage constraints. There is no promise that all data or copies disappear immediately after a delete action. Self-hosted operators are responsible for configuring retention, backups, and infrastructure protection.',
                            'Authentication, permissions, secret encryption, and guardrails reduce risk but do not eliminate every security risk or replace safe database administration.',
                        ],
                    },
                    {
                        id: 'choices',
                        title: 'Your choices and requests',
                        paragraphs: [
                            'You can view or edit information through supported features, manage resources you have permission to control, and request help with access, correction, or deletion through the legal contact channel.',
                            'Export and deletion capabilities depend on resource type, permissions, and system state; not every data category has an export-all or delete-all action. Deleting connection metadata in Data Explorer does not mean deleting the target database.',
                            'Before sharing or sending AI content, choose the right resources and limit sensitive data. Do not include secrets in support requests. For a self-hosted deployment, contact its operator.',
                        ],
                    },
                    {
                        id: 'changes',
                        title: 'Changes to this policy',
                        paragraphs: [
                            'If we make material changes to this policy, we will notify you by email or in-app notice before the change takes effect. The effective date at the top of this document always reflects the latest version.',
                        ],
                    },
                ],
            },
            terms: {
                title: 'Terms of service',
                subtitle: 'Access, database use, AI content, and payments: the rules for working with Data Explorer.',
                effectiveDate: 'Effective June 28, 2026',
                sections: [
                    {
                        id: 'account',
                        title: 'Accounts and access',
                        paragraphs: [
                            'You are responsible for your account, including login credentials, linked OAuth providers, and activity performed through that account.',
                        ],
                        bullets: [
                            'Do not use another person’s account without permission.',
                            'Do not bypass product permissions, guardrails, or access restrictions.',
                        ],
                    },
                    {
                        id: 'use',
                        title: 'Acceptable use',
                        paragraphs: [
                            'Use Data Explorer only for lawful, safe work and only against data systems that you own or are authorized to access.',
                        ],
                        bullets: [
                            'Do not use the product to damage data, exfiltrate information, or attack infrastructure.',
                            'Do not submit illegal, harmful, or intentionally disruptive content.',
                            'Use connections and shared resources only within granted permissions; UI access does not expand the database’s actual permissions.',
                        ],
                    },
                    {
                        id: 'database',
                        title: 'Queries, data, and shared resources',
                        paragraphs: [
                            'Commands run with the permissions of the selected connection. You are responsible for checking the database, command, data scope, and resource recipients before executing, saving, exporting, or sharing.',
                            'Guardrails and warnings are assistance, not a guarantee that every dangerous command is detected or reversible. Backups, read-only permissions, and the target system’s approval process must be managed separately.',
                            'Dashboard snapshots and exported results reflect only the data saved or loaded; they are not complete backups or a promise of continuous synchronization with the source database.',
                        ],
                    },
                    {
                        id: 'ai',
                        title: 'AI output and query results',
                        paragraphs: [
                            'AI suggestions, generated SQL, and textual explanations are assistive outputs. You remain responsible for reviewing them before running anything against production data.',
                            'AI is optional. When using it, you are responsible for having permission to send prompts, schema/context, and attachments to the configured endpoint or provider. Generated content may be wrong, incomplete, or unsuitable for your engine and data; review it before applying.',
                        ],
                    },
                    {
                        id: 'billing',
                        title: 'Billing and plans',
                        paragraphs: [
                            'The current payment flow supports MoMo and ZaloPay. Each successful transaction confirmed by a valid webhook grants or adds a 30-day or 365-day Pro period according to the chosen plan. Returning from checkout does not by itself prove payment succeeded.',
                            'These are access periods purchased through separate checkouts, not a promise of auto-renewal or a renewal-cancellation control. Plan codes and Pro status do not mean every advanced entitlement or quota has been implemented; check current plan information before paying.',
                            'Fees paid for the current access period are non-refundable if you stop using the service partway through, while plan access continues until its expiry date.',
                        ],
                    },
                    {
                        id: 'license',
                        title: 'Your data and the source-code license',
                        paragraphs: [
                            'You retain existing rights to data and content you own or are permitted to use in your workspace. Saving or sharing in Data Explorer does not give you rights to someone else’s data.',
                            'The Data Explorer repository’s source code is provided under the MIT License, which permits use, copying, modification, and distribution under the conditions in LICENSE, including retaining copyright and license notices. These service terms do not withdraw permissions granted by the source-code license.',
                            'The MIT License applies to the licensed source and documentation; accounts, hosted-service access, and third-party services remain subject to their respective conditions. Read LICENSE for the complete source-code conditions and disclaimer.',
                        ],
                    },
                    {
                        id: 'disclaimer',
                        title: 'Disclaimers',
                        paragraphs: [
                            'The service is provided "as is". We do not promise uninterrupted or error-free operation and are not liable for damage arising from queries you run (especially data-modifying queries) against your own systems.',
                            'Always double-check destructive queries and back up your data before operating on production databases.',
                        ],
                    },
                    {
                        id: 'liability',
                        title: 'Limitation of liability',
                        paragraphs: [
                            'To the maximum extent permitted by law, our total liability will not exceed the amount you paid for the service in the preceding 12 months. We are not liable for indirect damages, loss of business data, or lost profits.',
                        ],
                    },
                    {
                        id: 'termination',
                        title: 'Suspension or termination',
                        paragraphs: [
                            'We may limit or suspend access if an account is abusive, violates security expectations, or uses the product in a way that creates risk for other users or the service itself.',
                            'Deleting or requesting deletion of an account through supported flows depends on permissions and storage constraints. Shared content, audits, transactions, backups, and provider data may require separate handling; not every copy is guaranteed to disappear together with the account.',
                        ],
                    },
                    {
                        id: 'deployment',
                        title: 'Self-hosting and third-party services',
                        paragraphs: [
                            'For self-hosting, you or the operator are responsible for infrastructure, secrets, database permissions, backups, retention, and integrated services. Local-development guidance is not a promise about every system’s production configuration.',
                            'OAuth, email, hosting, payments, and AI providers have their own terms. An integration does not replace the need to check those services’ conditions, data scope, and costs.',
                        ],
                    },
                ],
            },
        },
    } as const;

    return docs[lang][key];
};
