import { ArrowUpRight, BookOpen, Braces, Database, GitBranch, Layers3, Pause, Play, Sparkles } from 'lucide-react';
import { PublicScene } from './PublicScene';
import { usePublicExperience } from './PublicExperienceContext';
import { usePublicNavigation } from './PublicNavigationContext';

const topics = [
    { id: 'editor', label: 'SQL', icon: Braces },
    { id: 'nosql-studio', label: 'NoSQL', icon: Database },
    { id: 'ai-service', label: 'AI', icon: Sparkles },
    { id: 'erd', label: 'ERD', icon: GitBranch },
];

export function KnowledgeHub() {
    const { lang, paused, onToggleMotion } = usePublicExperience();
    const navigation = usePublicNavigation();
    const vi = lang === 'vi';
    return (
        <div className="kd-hub pe-scene-region">
            <PublicScene kind="knowledge">
                <div className="kd-orbit kd-orbit-outer" /><div className="kd-orbit kd-orbit-inner" />
                <svg className="kd-routes" viewBox="0 0 520 390" fill="none">
                    <path d="M46 80C130 18 200 56 238 150M455 83C384 9 311 61 281 148M60 305C117 374 207 339 239 257M453 304C390 372 312 330 279 260" />
                    <path className="kd-route-packet" d="M46 80C130 18 200 56 238 150M455 83C384 9 311 61 281 148M60 305C117 374 207 339 239 257M453 304C390 372 312 330 279 260" />
                </svg>
                <div className="kd-stack">
                    <div className="kd-page kd-page-back"><span className="kd-page-edge">SCHEMA / RELATIONS</span><div className="kd-schema"><i>customers</i><span /><i>orders</i><span /><i>results</i></div></div>
                    <div className="kd-page kd-page-middle"><div className="kd-page-bar"><Layers3 size={14} /> DATA EXPLORER <span>DOCS</span></div><div className="kd-page-lines"><i /><i /><i /><i /></div></div>
                    <div className="kd-page kd-page-front">
                        <div className="kd-page-bar"><BookOpen size={15} /> {vi ? 'KHÔNG GIAN KIẾN THỨC' : 'KNOWLEDGE WORKSPACE'}<span className="kd-live-dot" /></div>
                        <div className="kd-page-body"><span className="kd-file-label"><Braces size={13} /> workspace.sql</span>
                            <div className="kd-code"><span><b>SELECT</b> ideas, possibilities</span><span><b>FROM</b> your_workspace</span><span><b>WHERE</b> curiosity = <em>true</em>;</span></div>
                            <div className="kd-result"><span /><span /><span /><span /><span /><span /></div>
                            <div className="kd-page-footer"><span>EXPLORE → UNDERSTAND → BUILD</span><GitBranch size={14} /></div>
                        </div>
                    </div>
                </div>
                <span className="kd-satellite kd-satellite-sql"><Braces />SQL</span>
                <span className="kd-satellite kd-satellite-data"><Database />NoSQL</span>
                <span className="kd-satellite kd-satellite-ai"><Sparkles />AI</span>
                <span className="kd-satellite kd-satellite-erd"><GitBranch />ERD</span>
            </PublicScene>
            <div className="kd-hub-dock" aria-label={vi ? 'Khám phá chủ đề' : 'Explore topics'}>
                {topics.map(topic => <a key={topic.id} href={navigation.path(`/docs/${topic.id}`)} className="kd-topic-link"><topic.icon size={14} aria-hidden="true" /><span>{topic.label}</span><ArrowUpRight size={12} aria-hidden="true" /></a>)}
            </div>
            <div className="kd-hub-caption"><span>{vi ? 'Một chủ đề. Nhiều khả năng.' : 'One topic. More possibilities.'}</span>
                {onToggleMotion && <button type="button" className="pe-motion-control" aria-pressed={paused} onClick={onToggleMotion}>{paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}{paused ? (vi ? 'Bật chuyển động' : 'Enable motion') : (vi ? 'Tạm dừng chuyển động' : 'Pause motion')}</button>}
            </div>
        </div>
    );
}
