import React from 'react';
import { ArrowUpRight, Braces, ChartNoAxesCombined, GitGraph, History, Sparkles } from 'lucide-react';
import { landingEngines } from '../landingEngines';
import { useLandingMotion } from '../hooks/useLandingMotion';
import { publicPath } from '@/core/seo/publicRoutes';

interface FeaturesSectionProps {
    lang: string;
    isMotionPaused?: boolean;
    addToRevealRefs?: (el: HTMLDivElement | null) => void;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ lang, isMotionPaused = false, addToRevealRefs }) => {
    const vi = lang === 'vi';
    const { ref: motionRef, running, interaction } = useLandingMotion(isMotionPaused);
    const features = [
        { icon: Braces, title: vi ? 'SQL & NoSQL' : 'SQL & NoSQL', description: vi ? 'Monaco cho SQL. JSON, tree và grid cho MongoDB.' : 'Monaco for SQL. JSON, tree, and grid views for MongoDB.', code: 'SELECT · FIND', color: 'blue' },
        { icon: GitGraph, title: 'Schema & ERD', description: vi ? 'Đi từ cấu trúc bảng tới những quan hệ rõ ràng.' : 'Move from table structures to clear relationships.', code: 'TABLE → RELATION', color: 'purple' },
        { icon: History, title: vi ? 'Giữ dòng suy nghĩ' : 'Keep your flow', description: vi ? 'Query đã lưu, lịch sử và bản nháp để quay lại.' : 'Saved queries, history, and drafts to pick up where you left off.', code: 'WRITE · SAVE · RETURN', color: 'cyan' },
        { icon: ChartNoAxesCombined, title: vi ? 'Kết quả có ngữ cảnh' : 'Results in context', description: vi ? 'Đọc grid, xuất dữ liệu hoặc mở biểu đồ.' : 'Read the grid, export data, or open a chart.', code: 'QUERY → INSIGHT', color: 'blue' },
    ];

    return (
        <>
            <section id="features" className="lp-engine-band">
                <div className="lp-container">
                    <div className="lp-engine-intro"><span className="lp-kicker">{vi ? 'KẾT NỐI DATABASE CỦA BẠN' : 'CONNECT YOUR DATABASES'}</span><p>{vi ? '9 engine. Cùng một nơi để làm việc.' : '9 engines. One place to work.'}</p></div>
                    <div className="lp-engine-rail" ref={motionRef} data-running={running} {...interaction}>
                        <div className="lp-engine-track">
                            {[false, true].map(duplicate => (
                                <ul key={String(duplicate)} className="lp-engine-list" aria-hidden={duplicate || undefined}>
                                    {landingEngines.map(engine => (
                                        <li key={engine.name} className="lp-engine-chip" style={{ '--lp-engine-color': engine.color } as React.CSSProperties}><engine.icon aria-hidden="true" /><span>{engine.name}</span></li>
                                    ))}
                                </ul>
                            ))}
                        </div>
                    </div>
                    <p className="lp-engine-note">{vi ? 'Khả năng query, schema và chỉnh sửa khác nhau theo engine.' : 'Query, schema, and editing capabilities vary by engine.'}</p>
                </div>
            </section>
            <section className="lp-section lp-features-section">
                <div className="lp-container" ref={addToRevealRefs}>
                    <div className="lp-section-heading lp-heading-row">
                        <div><span className="lp-kicker">{vi ? 'ÍT ĐỔI TAB. NHIỀU TẬP TRUNG.' : 'LESS TAB SWITCHING. MORE FOCUS.'}</span><h2 className="lp-h2">{vi ? 'Đủ công cụ. Không rườm rà.' : 'Your toolkit. Without the clutter.'}</h2></div>
                        <a href={publicPath(vi ? 'vi' : 'en', '/docs')} className="lp-inline-link">{vi ? 'Khám phá tính năng' : 'Explore the features'}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
                    </div>
                    <div className="lp-feature-grid">
                        {features.map(feature => (
                            <article key={feature.title} className={`lp-feature-card lp-feature-${feature.color}`}>
                                <span className="lp-feature-icon"><feature.icon className="h-6 w-6" aria-hidden="true" /></span>
                                <h3>{feature.title}</h3><p>{feature.description}</p><span className="lp-feature-code">{feature.code}</span>
                            </article>
                        ))}
                    </div>
                    <p className="lp-feature-footnote"><Sparkles className="h-4 w-4" aria-hidden="true" />{vi ? 'Thêm AI theo cách bạn muốn — chọn provider và model cho từng vai trò.' : 'Add AI on your terms — choose providers and models by role.'}</p>
                </div>
            </section>
        </>
    );
};
