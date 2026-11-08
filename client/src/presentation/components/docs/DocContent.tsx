import type { ReactElement } from 'react';
import { getDocTopic, type DocTopicId } from '@/core/docs/docsCatalog';
import { DocPageLayout, Prose } from './primitives';
import {
    AggregationBuilderSection, AiServiceSection, ArchitectureSection, AuthenticationSection,
    BillingSection, ChartsSection, CleanCodeSection, ConnectionSection, DeploymentSection,
    EditorSection, EnvVarsSection, ErdSection, ExplainSection, ExportSection, FaqSection,
    InstallationSection, IntroductionSection, LifecycleSection, UiTourSection, NoSqlInsightsSection,
    NoSqlStudioSection, PrerequisitesSection, RedisSection, ResultsSection, SecuritySection,
    SqlGenerationSection, TabsSection, TeamWorkspaceSection, TechStackSection, TestingSection, VisionSection,
    FirstQuerySection, SqliteConnectionSection, ClickHouseConnectionSection, DatabaseCapabilitiesSection,
    OperationalLimitsSection, MigrationSection, DataHandlingSection,
} from './sections';

type DocLanguage = 'vi' | 'en';
type DocRenderer = (props: { lang: DocLanguage }) => ReactElement;

/** Exhaustive presentation registry: catalog/SEO never import section components. */
export const DOC_RENDERERS = {
    introduction: IntroductionSection,
    'first-query': FirstQuerySection,
    'ui-tour': UiTourSection,
    installation: InstallationSection,
    prerequisites: PrerequisitesSection,
    'env-vars': EnvVarsSection,
    postgres: ({ lang }) => <ConnectionSection lang={lang} engine="postgres" />,
    mysql: ({ lang }) => <ConnectionSection lang={lang} engine="mysql" />,
    mariadb: ({ lang }) => <ConnectionSection lang={lang} engine="mariadb" />,
    cockroach: ({ lang }) => <ConnectionSection lang={lang} engine="cockroach" />,
    mssql: ({ lang }) => <ConnectionSection lang={lang} engine="mssql" />,
    mongodb: ({ lang }) => <ConnectionSection lang={lang} engine="mongodb" />,
    sqlite: SqliteConnectionSection,
    clickhouse: ClickHouseConnectionSection,
    'database-capabilities': DatabaseCapabilitiesSection,
    'nosql-studio': NoSqlStudioSection,
    'aggregation-builder': AggregationBuilderSection,
    'nosql-insights': NoSqlInsightsSection,
    editor: EditorSection,
    tabs: TabsSection,
    results: ResultsSection,
    export: ExportSection,
    'ai-service': AiServiceSection,
    'sql-generation': SqlGenerationSection,
    vision: VisionSection,
    explain: ExplainSection,
    erd: ErdSection,
    charts: ChartsSection,
    'team-workspace': TeamWorkspaceSection,
    'data-migration': MigrationSection,
    authentication: AuthenticationSection,
    billing: BillingSection,
    architecture: ArchitectureSection,
    'tech-stack': TechStackSection,
    redis: RedisSection,
    security: SecuritySection,
    'operational-limits': OperationalLimitsSection,
    'data-handling': DataHandlingSection,
    deployment: DeploymentSection,
    testing: TestingSection,
    'clean-code': CleanCodeSection,
    lifecycle: LifecycleSection,
    faq: FaqSection,
} satisfies Record<DocTopicId, DocRenderer>;

interface DocContentProps {
    sectionId: string;
    lang: DocLanguage;
}

export function DocContent({ sectionId, lang }: DocContentProps) {
    const topic = getDocTopic(sectionId);
    if (!topic) {
        return (
            <DocPageLayout title={lang === 'vi' ? 'Không tìm thấy tài liệu' : 'Documentation not found'} subtitle={lang === 'vi' ? 'Mục này không có trong danh mục tài liệu.' : 'This topic is not in the documentation catalog.'}>
                <Prose>{lang === 'vi' ? 'Chọn một mục trong menu tài liệu để tiếp tục.' : 'Choose a topic in the documentation navigation to continue.'}</Prose>
            </DocPageLayout>
        );
    }
    const Renderer = DOC_RENDERERS[topic.id];
    return <div data-doc-topic={topic.id} data-doc-lang={lang}><Renderer lang={lang} /></div>;
}
