import React from 'react';
import { ArrowRight, Braces, GitGraph, Globe, Terminal } from 'lucide-react';

interface HeroSectionProps {
    lang: string;
    isAuthenticated: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ lang, isAuthenticated }) => {
    const vi = lang === 'vi';
    const workspaceHref = isAuthenticated ? '/sql-explorer' : '/login';

    return (
        <div className="lp-hero-copy">
            <span className="lp-eyebrow"><span className="lp-status-dot" />{vi ? 'SQL & NoSQL. Một workspace.' : 'SQL & NoSQL. One workspace.'}</span>
            <h1 className="lp-h1">
                {vi ? 'Dữ liệu phức tạp.' : 'Complex data.'}
                <span className="lp-heading-highlight">{vi ? 'Làm việc đơn giản.' : 'Simple workflow.'}</span>
            </h1>
            <p className="lp-body lp-hero-description">
                {vi ? 'Viết query, khám phá schema và nhìn rõ kết quả. Công cụ bạn cần, cùng một nơi — ngay trong trình duyệt.' : 'Write queries, explore schemas, and make sense of results. The tools you need, together — right in your browser.'}
            </p>
            <div className="lp-hero-actions">
                <a href={workspaceHref} className="lp-button lp-button-primary">
                    <Globe className="h-4 w-4" aria-hidden="true" />
                    {vi ? 'Mở workspace' : 'Open workspace'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a href="#get-started" className="lp-button lp-button-secondary">
                    <Terminal className="h-4 w-4" aria-hidden="true" />{vi ? 'Chạy local' : 'Run locally'}
                </a>
            </div>
            <p className="lp-hero-note">{vi ? 'Web app mã nguồn mở · Không cần cài desktop' : 'Open-source web app · No desktop install'}</p>
            <div className="lp-capabilities">
                <span><Braces className="h-4 w-4" aria-hidden="true" />SQL / NoSQL</span>
                <span><GitGraph className="h-4 w-4" aria-hidden="true" />Schema / ERD</span>
                <span><Terminal className="h-4 w-4" aria-hidden="true" />{vi ? 'AI khi bạn cần' : 'AI when you need it'}</span>
            </div>
        </div>
    );
};
