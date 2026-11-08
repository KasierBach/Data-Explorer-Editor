import {
    Activity,
    Download,
    FolderTree,
    MessageSquare,
    Shield,
    Users,
} from 'lucide-react';
import {
    Callout,
    DocPageLayout,
    DocSection,
    DocSubSection,
    FeatureGrid,
    InfoCard,
    Prose,
} from '../primitives';
import { publicPath } from '@/core/seo/publicRoutes';

interface Props { lang: 'vi' | 'en'; }

export function TeamWorkspaceSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Team Workspace' : 'Team Workspace'}
            subtitle={t
                ? 'Hướng dẫn cho phần cộng tác của Data Explorer: tổ chức theo organization, teamspace, resource sharing, comment thread, activity feed, và backup/restore ở cấp team.'
                : 'A guide to Data Explorer collaboration: organization structure, teamspaces, resource sharing, comment threads, activity feeds, and team-level backup/restore.'}
            gradient
        >
            <FeatureGrid columns={3}>
                <InfoCard icon={<Users className="w-6 h-6 text-blue-500" />} title={t ? 'Organization & member roles' : 'Organization and member roles'} color="blue">
                    <p>
                        {t
                            ? 'Mỗi team hoạt động trong một organization riêng, với member list, lời mời tham gia, vai trò, và quyền truy cập tài nguyên theo ngữ cảnh.'
                            : 'Each team works inside its own organization with a member list, invitations, roles, and context-aware resource access.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<FolderTree className="w-6 h-6 text-emerald-500" />} title={t ? 'Teamspaces & resource groups' : 'Teamspaces and resource groups'} color="emerald">
                    <p>
                        {t
                            ? 'Kết nối, saved query, và dashboard không chỉ “được share hay không” mà còn có thể được nhóm vào teamspace để giữ cấu trúc làm việc rõ ràng hơn.'
                            : 'Connections, saved queries, and dashboards are not just shared or private; they can also be grouped into teamspaces for a cleaner working structure.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<MessageSquare className="w-6 h-6 text-purple-500" />} title={t ? 'Comments & activity' : 'Comments and activity'} color="purple">
                    <p>
                        {t
                            ? 'Tài nguyên có thể có comment thread và activity feed để cả team hiểu tài sản dữ liệu nào đang được ai dùng, sửa, hoặc theo dõi.'
                            : 'Resources can carry comment threads and activity history so the whole team can understand who is using, editing, or watching a data asset.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            <DocSection title={t ? 'Cấu trúc cộng tác trong app' : 'The collaboration structure inside the app'}>
                <Prose>
                    {t
                        ? 'TeamPage là nơi gom nhiều khái niệm lại thành một mặt điều phối: organization, members, teamspaces, shared resources, activity, và backup. Điều này có nghĩa là docs của Team Workspace không chỉ dành cho “quản trị viên”, mà còn hữu ích cho bất kỳ ai cần hiểu cách tài nguyên được mở rộng từ cá nhân sang nhóm.'
                        : 'TeamPage acts as a coordination surface for multiple concepts at once: organizations, members, teamspaces, shared resources, activity, and backup. That means the Team Workspace docs are useful not only for admins, but for anyone who needs to understand how resources grow from personal to team scope.'}
                </Prose>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Organization' : 'Organization'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Là lớp bao ngoài cùng cho thành viên, lời mời, resource policies, và backup/export. Nếu bạn nghĩ theo hướng “workspace cấp công ty / cấp đội”, đây là đơn vị đúng.'
                                : 'This is the outer container for members, invitations, resource policies, and backup/export. If you think in terms of a company or team-level workspace, this is the right unit.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Teamspace' : 'Teamspace'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Là lớp nhóm con trong organization để gom tài nguyên theo sản phẩm, domain, khách hàng, hoặc môi trường vận hành.'
                                : 'This is the subgroup inside an organization that helps cluster resources by product, domain, customer, or runtime environment.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Quyền truy cập tài nguyên hoạt động như thế nào?' : 'How resource permissions work'}>
                <div className="grid gap-4 md:grid-cols-2">
                    <InfoCard icon={<Shield className="w-5 h-5 text-emerald-500" />} title={t ? 'Permission labels dễ đọc' : 'Readable permission labels'} color="emerald">
                        <p className="text-xs">
                            {t
                                ? 'Trong UI, tài nguyên thường được quy về các mức dễ hiểu như read, comments, edit, hoặc manage thay vì bắt người dùng đọc policy thô.'
                                : 'In the UI, resources are summarized into readable levels such as read, comments, edit, or manage instead of exposing raw policy definitions.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Shield className="w-5 h-5 text-amber-500" />} title={t ? 'Comment không đồng nghĩa với edit' : 'Comment is not the same as edit'} color="amber">
                        <p className="text-xs">
                            {t
                                ? 'Một người có thể được phép bình luận lên tài nguyên mà chưa được sửa nội dung của nó. Đây là một khác biệt quan trọng cho review workflow.'
                                : 'A user may be allowed to comment on a resource without being allowed to edit it. That distinction matters for review workflows.'}
                        </p>
                    </InfoCard>
                </div>

                <DocSubSection title={t ? 'Vai trò mặc định và policy theo tài nguyên' : 'Default roles and per-resource policies'}>
                    <div className="grid gap-4 md:grid-cols-2">
                        {[
                            {
                                title: 'Owner',
                                desc: t
                                    ? 'Mặc định có read, write, delete, manage, comment và share trên tài nguyên team. Chỉ Owner thực hiện các thao tác sở hữu như chuyển quyền Owner hoặc xóa organization.'
                                    : 'Defaults to read, write, delete, manage, comment, and share on team resources. Ownership operations such as transferring ownership or deleting the organization are Owner-only.',
                            },
                            {
                                title: 'Admin',
                                desc: t
                                    ? 'Mặc định có cùng bộ quyền tài nguyên với Owner và có thể quản lý các luồng team được cho phép như lời mời, teamspace và backup. Admin không có toàn bộ quyền sở hữu của Owner.'
                                    : 'Defaults to the same resource permissions as Owner and can manage authorized team flows such as invitations, teamspaces, and backups. Admin does not inherit all Owner-only powers.',
                            },
                            {
                                title: 'Member',
                                desc: t
                                    ? 'Mặc định có read, write và comment; không mặc định có delete, manage hay share. Quyền cụ thể vẫn được kiểm tra theo resource policy.'
                                    : 'Defaults to read, write, and comment, not delete, manage, or share. Actual access is still checked against the resource policy.',
                            },
                            {
                                title: 'Viewer',
                                desc: t
                                    ? 'Mặc định chỉ read, không comment hoặc edit. Policy theo tài nguyên có thể thay bộ quyền mặc định; tư cách thành viên không tự vượt quyền database hoặc connection.'
                                    : 'Defaults to read only, without comment or edit. A resource policy can replace the default permission set; membership does not bypass database or connection permissions.',
                            },
                        ].map((item) => (
                            <div key={item.title} className="rounded-2xl border border-border/60 bg-card/40 p-5">
                                <h3 className="text-sm font-bold">{item.title}</h3>
                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </DocSubSection>

                <DocSubSection title={t ? 'Những loại tài nguyên đang được quản lý' : 'The resource types currently managed'}>
                    <Prose>
                        {t
                            ? 'Team Workspace hiển thị connection, saved query và dashboard được chia sẻ; ERD workspace cũng thuộc lớp resource policy. Read, comment, write, delete, manage và share là các quyền riêng biệt, không phải một nhãn “thành viên team” mở toàn bộ thao tác.'
                            : 'Team Workspace displays shared connections, saved queries, and dashboards; ERD workspaces also use resource policies. Read, comment, write, delete, manage, and share are separate permissions, not a single team-membership label that enables every action.'}
                    </Prose>
                </DocSubSection>
            </DocSection>

            <DocSection title={t ? 'Comment thread, activity feed, và lịch sử cộng tác' : 'Comment threads, activity feeds, and collaboration history'}>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <div className="flex items-center gap-3">
                            <MessageSquare className="h-5 w-5 text-purple-400" />
                            <h3 className="text-sm font-bold">{t ? 'Comment drawer theo tài nguyên' : 'Resource-specific comment drawer'}</h3>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Comments được mở theo từng tài nguyên cụ thể, không phải một hộp chat chung chung. Điều này giúp thảo luận gắn đúng vào connection, query, hoặc dashboard đang được review.'
                                : 'Comments open in the context of a specific resource rather than a generic chat box. That keeps the conversation attached to the exact connection, query, or dashboard under review.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <div className="flex items-center gap-3">
                            <Activity className="h-5 w-5 text-blue-400" />
                            <h3 className="text-sm font-bold">{t ? 'Activity tab để nhìn toàn cục' : 'Activity tab for the bigger picture'}</h3>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Nếu comment drawer là góc nhìn cục bộ cho một resource, activity tab là góc nhìn toàn organization: ai vừa làm gì, trên tài nguyên nào, và chuỗi công việc gần đây đang xoay quanh đâu.'
                                : 'If the comment drawer is the local view for one resource, the activity tab is the organization-wide view: who changed what, where, and what the recent work stream is orbiting around.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Backup & restore ở cấp team' : 'Team-level backup and restore'}>
                <Prose>
                    {t
                        ? 'Owner/Admin có thể export JSON gồm metadata và settings của organization, teamspace, policy cho query/dashboard/ERD, saved query, dashboard cùng widget/data snapshot và ERD layout. Đây là gói metadata cộng tác, không phải bản backup toàn bộ hệ thống hay dữ liệu database nguồn.'
                        : 'Owner/Admin can export JSON containing organization metadata/settings, teamspaces, query/dashboard/ERD policies, saved queries, dashboards with widget/data snapshots, and ERD layouts. This is a collaboration-metadata package, not a backup of the entire system or source database contents.'}
                </Prose>

                <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                    <div className="flex items-center gap-3">
                        <Download className="h-5 w-5 text-emerald-400" />
                        <h3 className="text-sm font-bold">{t ? 'Khi nào nên export backup?' : 'When to export a backup'}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {t
                            ? 'Export không chứa connection records/secrets, thành viên, lời mời, comment, activity/audit, AI chat, hoặc bản sao toàn bộ schema/dữ liệu nguồn. Nhiều tập dữ liệu được đọc riêng, nên không bảo đảm snapshot nhất quán tại một thời điểm khi team đang chỉnh sửa. JSON có query text và dashboard snapshot: lưu và chia sẻ như dữ liệu có thể nhạy cảm.'
                            : 'Export does not include connection records/secrets, memberships, invitations, comments, activity/audit, AI chats, or full source schemas/data. Collections are read separately, so concurrent team edits mean this is not a guaranteed point-in-time consistent snapshot. JSON includes query text and dashboard snapshots: store and share it as potentially sensitive data.'}
                    </p>
                </div>
                <Callout type="warning">
                    <p className="text-sm">
                        {t
                            ? 'Restore chỉ chấp nhận gói của cùng organization. Nó tạo thêm teamspace/query/dashboard/ERD và gắn lại policy, đồng thời áp dụng settings được lưu; không phải replace toàn bộ hay merge chống trùng. Restore lại cùng gói có thể tạo bản sao; connection cũ phải được kiểm tra lại. Đọc số lượng và warnings sau restore, không coi thành công là khôi phục mọi đối tượng.'
                            : 'Restore accepts only a package from the same organization. It adds new teamspaces/queries/dashboards/ERDs and reattaches policies while applying stored settings; it is not a full replacement or deduplicating merge. Restoring the same package again can create duplicates; existing connections need review. Inspect counts and warnings rather than treating success as recovery of every object.'}
                    </p>
                </Callout>
                <Prose>
                    <a href={publicPath(lang, '/docs/data-handling')}>
                        {t ? 'Xem phạm vi lưu trữ, export và backup' : 'See retention, export, and backup scope'}
                    </a>
                </Prose>
            </DocSection>

            <DocSection title={t ? 'Di chuyển dữ liệu giữa hai connection (Migration)' : 'Moving data between two connections (Migration)'}>
                <Prose>
                    {t
                        ? 'Migration chuyển dữ liệu giữa bảng/collection trên hai connection và là luồng khác với restore metadata của team. Xem hướng dẫn riêng để kiểm tra nguồn/đích, schema, quyền và theo dõi job.'
                        : 'Migration copies data between tables/collections on two connections and is separate from team metadata restore. Read the dedicated guide for source/target, schema, permission, and job-progress checks.'}
                    {' '}
                    <a href={publicPath(lang, '/docs/data-migration')}>
                        {t ? 'Mở hướng dẫn Data Migration.' : 'Open the Data Migration guide.'}
                    </a>
                </Prose>
                <Callout type="warning">
                    <p className="text-sm">
                        {t
                            ? 'Failed hoặc cancelled không có nghĩa chưa ghi gì: batch trước có thể đã commit và một số engine có thể để lại ghi dở trong batch lỗi. Không có rollback toàn job hoặc resume chống trùng được bảo đảm. Kiểm tra dữ liệu đích, log/progress và xử lý bản ghi đã có trước khi thử lại; không chạy lại từ đầu một cách mù quáng. Sao lưu nguồn/đích phù hợp trước khi chuyển dữ liệu quan trọng.'
                            : 'Failed or cancelled does not mean nothing was written: earlier batches may have committed, and some engines can leave partial writes in a failing batch. Whole-job rollback and deduplicating resume are not guaranteed. Inspect target data and job logs/progress, then reconcile existing rows before retrying; do not blindly rerun from the start. Back up source/target appropriately before an important transfer.'}
                    </p>
                </Callout>
            </DocSection>

            <Callout type="warning">
                <p className="text-sm">
                    {t
                        ? 'Hãy coi Team Workspace là lớp governance của tài sản dữ liệu, không phải chỉ là nơi “rủ đồng đội vào xem cho vui”. Một connection được share, một dashboard được comment, hay một policy được mở rộng đều là thay đổi có hậu quả thật trên cách cả team làm việc với dữ liệu.'
                        : 'Treat Team Workspace as the governance layer for data assets, not just a place to casually invite teammates. Sharing a connection, commenting on a dashboard, or widening a policy all have real consequences for how the team works with data.'}
                </p>
            </Callout>
        </DocPageLayout>
    );
}
