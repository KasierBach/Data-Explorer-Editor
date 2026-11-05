import React from 'react';
import { ArrowRight, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { LandingScreenshot } from './LandingScreenshot';
import { publicPath } from '@/core/seo/publicRoutes';

interface AiSpotlightSectionProps {
    lang: string;
    addToRevealRefs: (el: HTMLDivElement | null) => void;
}

export const AiSpotlightSection: React.FC<AiSpotlightSectionProps> = ({ lang, addToRevealRefs }) => {
    const vi = lang === 'vi';
    const images = getWorkspaceText(lang).landingImages;

    return (
        <section className="lp-section lp-ai-section">
            <div className="lp-container" ref={addToRevealRefs}>
                <div className="lp-showcase-layout lp-ai-layout">
                    <div>
                        <span className="lp-eyebrow"><Sparkles className="h-4 w-4" aria-hidden="true" />{vi ? 'TRỢ LÝ, KHÔNG PHẢI AUTOPILOT' : 'ASSISTANCE, NOT AUTOPILOT'}</span>
                        <h2 className="lp-h2 mt-5">{vi ? 'AI hỗ trợ.' : 'AI assists.'}<br /><span className="lp-accent-text">{vi ? 'Bạn quyết định.' : 'You decide.'}</span></h2>
                        <p className="lp-body mt-5">{vi ? 'Gợi ý query, giải thích execution plan và autocomplete. Chọn provider/model theo vai trò, xem lại đề xuất trước khi chạy — quyền thực thi vẫn do kết nối quyết định.' : 'Draft queries, explain execution plans, and autocomplete. Choose providers and models by role, review proposals before running them — connection settings still govern execution.'}</p>
                        <div className="lp-role-list mt-6">
                            <span><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{vi ? 'Model theo vai trò' : 'Models by role'}</span>
                            <span><ShieldCheck className="h-4 w-4" aria-hidden="true" />{vi ? 'Xem lại trước khi chạy' : 'Review before execution'}</span>
                        </div>
                        <a href={publicPath(vi ? 'vi' : 'en', '/docs/ai-service')} className="lp-inline-link mt-5">{vi ? 'Tìm hiểu cấu hình AI' : 'Explore AI configuration'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
                    </div>
                    <div>
                        <LandingScreenshot src="/images/landing/ai-review.webp" alt={images.aiReview} lang={lang} />
                        <p className="lp-image-note">{vi ? 'Dữ liệu demo · Cảnh báo trước một câu lệnh DELETE chưa được xác nhận.' : 'Demo data · Warning before an unconfirmed DELETE statement.'}</p>
                    </div>
                </div>
            </div>
        </section>
    );
};
