import { ArrowUpRight, BookOpen, Braces, Database, GitBranch, Layers3, Sparkles } from 'lucide-react';
import { DOCS_STRUCTURE } from '../components/docs/DocSidebar';
import { getLocalizedDocTitle } from '../components/docs/docsI18n';
import { usePublicExperience } from './PublicExperienceContext';
import { usePublicNavigation } from './PublicNavigationContext';

const paths = [
    { group: 'getting-started', page: 'installation', icon: BookOpen, vi: 'Từ thiết lập đến workspace đầu tiên.', en: 'From setup to your first workspace.' },
    { group: 'connections', page: 'postgres', icon: Database, vi: 'Kết nối dữ liệu. Hiểu từng engine.', en: 'Connect your data. Know each engine.' },
    { group: 'sql-workspace', page: 'editor', icon: Braces, vi: 'Đi từ câu hỏi đến một query rõ ràng.', en: 'From a question to a clear query.' },
    { group: 'nosql-workspace', page: 'nosql-studio', icon: Layers3, vi: 'Khám phá document, pipeline và schema.', en: 'Explore documents, pipelines, and schemas.' },
    { group: 'ai-assistant', page: 'ai-service', icon: Sparkles, vi: 'Tìm hiểu trợ lý và lựa chọn của bạn.', en: 'Understand the assistant and your choices.' },
    { group: 'visualization', page: 'erd', icon: GitBranch, vi: 'Nhìn thấy cấu trúc. Kết nối ý tưởng.', en: 'See the structure. Connect the ideas.' },
];

export function KnowledgePaths() {
    const { lang } = usePublicExperience();
    const navigation = usePublicNavigation();
    return (
        <section className="kd-paths" data-doc-outline-exclude aria-label={lang === 'vi' ? 'Chọn hành trình khám phá' : 'Choose your learning path'}>
            <div className="kd-paths-label"><span className="pe-kicker">{lang === 'vi' ? 'BẮT ĐẦU TỪ ĐIỀU BẠN MUỐN LÀM' : 'START WITH WHAT YOU WANT TO DO'}</span><span>{lang === 'vi' ? 'Mỗi lối đi mở ra một ý tưởng.' : 'Every path opens an idea.'}</span></div>
            <div className="kd-path-grid">{paths.map((entry, index) => {
                const group = DOCS_STRUCTURE.find(item => item.id === entry.group)!;
                return <a key={entry.page} className="kd-path" href={navigation.path(`/docs/${entry.page}`)} data-tone={index % 3}><span className="kd-path-icon"><entry.icon size={19} aria-hidden="true" /></span><span><strong>{getLocalizedDocTitle(lang, group)}</strong><small>{lang === 'vi' ? entry.vi : entry.en}</small></span><ArrowUpRight size={15} aria-hidden="true" /></a>;
            })}</div>
        </section>
    );
}
