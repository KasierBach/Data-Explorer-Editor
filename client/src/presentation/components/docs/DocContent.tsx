import React from 'react';
import { DocPageLayout } from './primitives';
import {
    IntroductionSection,
    InstallationSection,
    PrerequisitesSection,
    ConnectionSection,
    EditorSection,
    TabsSection,
    ResultsSection,
    ExportSection,
    SqlGenerationSection,
    VisionSection,
    ExplainSection,
    ErdSection,
    ChartsSection,
    ArchitectureSection,
    TechStackSection,
    SecuritySection,
    LifecycleSection,
    FaqSection,
    AiServiceSection,
    DeploymentSection
} from './sections';

interface DocContentProps {
    sectionId: string;
    lang: 'vi' | 'en';
}

export function DocContent({ sectionId, lang }: DocContentProps) {
    const t = lang === 'vi';

    // Helper map to route sectionId to the appropriate component
    const sectionMap: Record<string, React.ReactNode> = {
        'introduction': <IntroductionSection lang={lang} />,
        'installation': <InstallationSection lang={lang} />,
        'prerequisites': <PrerequisitesSection lang={lang} />,

        // Connections
        'postgres': <ConnectionSection lang={lang} engine="postgres" />,
        'mysql': <ConnectionSection lang={lang} engine="mysql" />,
        'mssql': <ConnectionSection lang={lang} engine="mssql" />,

        // SQL Workspace
        'editor': <EditorSection lang={lang} />,
        'tabs': <TabsSection lang={lang} />,
        'results': <ResultsSection lang={lang} />,
        'export': <ExportSection lang={lang} />,

        // AI Assistant
        'sql-generation': <SqlGenerationSection lang={lang} />,
        'ai-service': <AiServiceSection lang={lang} />,
        'vision': <VisionSection lang={lang} />,
        'explain': <ExplainSection lang={lang} />,

        // Visualization
        'erd': <ErdSection lang={lang} />,
        'charts': <ChartsSection lang={lang} />,

        // Architecture & Tech
        'architecture': <ArchitectureSection lang={lang} />,
        'tech-stack': <TechStackSection lang={lang} />,
        'security': <SecuritySection lang={lang} />,
        'deployment': <DeploymentSection lang={lang} />,
        'lifecycle': <LifecycleSection lang={lang} />,
        'faq': <FaqSection lang={lang} />
    };

    const content = sectionMap[sectionId];

    if (content) {
        return <>{content}</>;
    }

    // Fallback for missing or unknown sections
    return (
        <DocPageLayout
            title={t ? 'Đang cập nhật' : 'Coming Soon'}
            subtitle={t
                ? 'Nội dung phần này đang được chúng tôi xây dựng và sẽ sớm ra mắt trong các phiên bản tiếp theo.'
                : 'Content for this section is currently under construction and will be available in upcoming releases.'}
        >
            <div className="flex flex-col items-center justify-center p-12 text-center h-64 border-2 border-dashed border-muted rounded-3xl bg-muted/5">
                <span className="text-4xl mb-4">🚧</span>
                <p className="text-muted-foreground max-w-md">
                    {t
                        ? 'Cảm ơn sự kiên nhẫn của bạn. Chúng tôi đang nỗ lực hoàn thiện tài liệu để mang lại trải nghiệm tốt nhất.'
                        : 'Thank you for your patience. We are working hard to complete the documentation for the best experience.'}
                </p>
            </div>
        </DocPageLayout>
    );
}
