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

                <DocSubSection title={t ? 'Những loại tài nguyên đang được quản lý' : 'The resource types currently managed'}>
                    <Prose>
                        {t
                            ? 'Hiện tại Team Workspace xoay quanh ba nhóm tài nguyên người dùng thấy nhiều nhất: team connections, shared queries, và team dashboards. Đó là ba điểm nơi tri thức dữ liệu dễ bị “giam” trong cá nhân nhất, nên app đưa chúng vào cùng một lớp governance.'
                            : 'Right now the Team Workspace is centered on the three most important shared asset types: team connections, shared queries, and team dashboards. Those are the places where data knowledge most easily gets trapped in personal silos, so the app governs them together.'}
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
                        ? 'TeamPage có backup flow riêng để export organization package thành JSON và restore lại có kiểm soát. Đây là công cụ tốt cho migration nhẹ, sao lưu cấu hình cộng tác, hoặc tạo bản chụp trước khi chỉnh lớn.'
                        : 'TeamPage includes a dedicated backup flow that exports an organization package as JSON and restores it in a controlled way. It is useful for light migration, collaboration-config backup, or creating a snapshot before major changes.'}
                </Prose>

                <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                    <div className="flex items-center gap-3">
                        <Download className="h-5 w-5 text-emerald-400" />
                        <h3 className="text-sm font-bold">{t ? 'Khi nào nên export backup?' : 'When to export a backup'}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {t
                            ? 'Hãy export trước các thay đổi có phạm vi rộng như tái cấu trúc teamspace, thay policy share, di chuyển resource giữa nhóm, hoặc cleanup dữ liệu cộng tác. Backup không thay thế database backup toàn hệ thống, nhưng rất hữu ích cho lớp tổ chức và metadata cộng tác.'
                            : 'Export before broad changes such as teamspace restructuring, share-policy updates, moving resources between groups, or collaboration cleanup. It does not replace full database backups, but it is extremely useful for organization-level metadata and collaboration state.'}
                    </p>
                </div>
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
