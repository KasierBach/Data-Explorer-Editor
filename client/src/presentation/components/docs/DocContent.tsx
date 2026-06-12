import React from 'react';
import { DocPageLayout } from './primitives';
import {
    AggregationBuilderSection,
    AiServiceSection,
    ArchitectureSection,
    AuthenticationSection,
    BillingSection,
    ChartsSection,
    CleanCodeSection,
    ConnectionSection,
    DeploymentSection,
    EditorSection,
    EnvVarsSection,
    ErdSection,
    ExplainSection,
    ExportSection,
    FaqSection,
    InstallationSection,
    IntroductionSection,
    LifecycleSection,
    NoSqlInsightsSection,
    NoSqlStudioSection,
    PrerequisitesSection,
    RedisSection,
    ResultsSection,
    SecuritySection,
    SqlGenerationSection,
    TabsSection,
    TeamWorkspaceSection,
    TechStackSection,
    TestingSection,
    VisionSection,
} from './sections';

interface DocContentProps {
    sectionId: string;
    lang: 'vi' | 'en';
}

export function DocContent({ sectionId, lang }: DocContentProps) {
    const t = lang === 'vi';

    const sectionMap: Record<string, React.ReactNode> = {
        introduction: <IntroductionSection lang={lang} />,
        installation: <InstallationSection lang={lang} />,
        prerequisites: <PrerequisitesSection lang={lang} />,
        'env-vars': <EnvVarsSection lang={lang} />,

        postgres: <ConnectionSection lang={lang} engine="postgres" />,
        mysql: <ConnectionSection lang={lang} engine="mysql" />,
        mssql: <ConnectionSection lang={lang} engine="mssql" />,
        mongodb: <ConnectionSection lang={lang} engine="mongodb" />,

        'nosql-studio': <NoSqlStudioSection lang={lang} />,
        'aggregation-builder': <AggregationBuilderSection lang={lang} />,
        'nosql-insights': <NoSqlInsightsSection lang={lang} />,

        editor: <EditorSection lang={lang} />,
        tabs: <TabsSection lang={lang} />,
        results: <ResultsSection lang={lang} />,
        export: <ExportSection lang={lang} />,

        'ai-service': <AiServiceSection lang={lang} />,
        'sql-generation': <SqlGenerationSection lang={lang} />,
        vision: <VisionSection lang={lang} />,
        explain: <ExplainSection lang={lang} />,

        erd: <ErdSection lang={lang} />,
        charts: <ChartsSection lang={lang} />,

        'team-workspace': <TeamWorkspaceSection lang={lang} />,
        authentication: <AuthenticationSection lang={lang} />,
        billing: <BillingSection lang={lang} />,

        architecture: <ArchitectureSection lang={lang} />,
        'tech-stack': <TechStackSection lang={lang} />,
        redis: <RedisSection lang={lang} />,
        security: <SecuritySection lang={lang} />,
        deployment: <DeploymentSection lang={lang} />,
        testing: <TestingSection lang={lang} />,
        'clean-code': <CleanCodeSection lang={lang} />,
        lifecycle: <LifecycleSection lang={lang} />,
        faq: <FaqSection lang={lang} />,
    };

    const content = sectionMap[sectionId];

    if (content) {
        return <>{content}</>;
    }

    return (
        <DocPageLayout
            title={t ? 'Đang cập nhật' : 'Coming Soon'}
            subtitle={t
                ? 'Nội dung của phần này đang được hoàn thiện để bám sát codebase và trải nghiệm sản phẩm hiện tại.'
                : 'This section is being expanded so it can stay aligned with the live codebase and product experience.'}
        >
            <div className="flex flex-col items-center justify-center p-12 text-center h-64 border-2 border-dashed border-muted rounded-3xl bg-muted/5">
                <span className="text-4xl mb-4">🚧</span>
                <p className="text-muted-foreground max-w-md">
                    {t
                        ? 'Phần này chưa có nội dung hiển thị tương ứng. Hãy quay lại sidebar để chọn một mục đã được tài liệu hóa.'
                        : 'There is no mapped content for this section yet. Use the sidebar to return to a documented page.'}
                </p>
            </div>
        </DocPageLayout>
    );
}
