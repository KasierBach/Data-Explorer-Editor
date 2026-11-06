import React from 'react';
import { ArrowRight, BookOpen, Globe, Terminal } from 'lucide-react';
import { SiDocker, SiGithub } from 'react-icons/si';
import { publicPath } from '@/core/seo/publicRoutes';

interface DocsCtaSectionProps {
    lang: string;
    addToRevealRefs: (el: HTMLDivElement | null) => void;
    isAuthenticated: boolean;
}

export const DocsCtaSection: React.FC<DocsCtaSectionProps> = ({ lang, addToRevealRefs, isAuthenticated }) => {
    const vi = lang === 'vi';
    const repository = 'https://github.com/KasierBach/Data-Explorer-Editor';
    const workspaceHref = isAuthenticated ? '/sql-explorer' : '/login';
    const paths = [
        { icon: Globe, title: vi ? 'Mở trên web' : 'Open on the web', description: vi ? 'Vào workspace bằng trình duyệt. Đăng nhập để bắt đầu.' : 'Use the workspace in your browser. Sign in to get started.', action: vi ? 'Mở workspace' : 'Open workspace', href: workspaceHref, external: false },
        { icon: SiDocker, title: vi ? 'Chạy local với Docker' : 'Run locally with Docker', description: vi ? 'Tự build và chạy trên máy của bạn. Xem Quick Start để cấu hình.' : 'Build and run on your machine. Follow Quick Start for configuration.', action: vi ? 'Xem Quick Start' : 'Read Quick Start', href: `${repository}#quick-start`, external: true },
        { icon: SiGithub, title: vi ? 'Khám phá source' : 'Explore the source', description: vi ? 'Mã nguồn mở. Xem code, báo lỗi hoặc đóng góp.' : 'Open source. Explore the code, report issues, or contribute.', action: vi ? 'Mở GitHub' : 'View on GitHub', href: repository, external: true },
    ];

    return (
        <section id="get-started" className="lp-section lp-final-cta">
            <div className="lp-container" ref={addToRevealRefs}>
                <div className="lp-section-heading"><span className="lp-kicker">{vi ? 'BẮT ĐẦU THEO CÁCH CỦA BẠN' : 'START YOUR WAY'}</span><h2 className="lp-h2">{vi ? 'Sẵn sàng khi bạn cần.' : 'Ready when you are.'}</h2><p className="lp-body mt-4">{vi ? 'Dùng web app hoặc tự chạy local. Không cần tìm một bản desktop để tải.' : 'Use the web app or run it locally. No desktop download required.'}</p></div>
                <div className="lp-access-grid">
                    {paths.map(path => (
                        <article className="lp-access-card" key={path.title}>
                            <path.icon className="h-7 w-7" aria-hidden="true" /><h3>{path.title}</h3><p>{path.description}</p>
                            <a href={path.href} target={path.external ? '_blank' : undefined} rel={path.external ? 'noopener noreferrer' : undefined} className="lp-inline-link">{path.action}<ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
                        </article>
                    ))}
                </div>
                <p className="lp-access-note"><Terminal className="h-4 w-4" aria-hidden="true" />{vi ? 'Docker Compose là cấu hình local development; triển khai production cần cấu hình riêng.' : 'Docker Compose is a local-development setup; production deployment needs separate configuration.'}<a href={publicPath(vi ? 'vi' : 'en', '/docs')}><BookOpen className="h-4 w-4" aria-hidden="true" />{vi ? 'Đọc tài liệu' : 'Read the docs'}</a></p>
            </div>
        </section>
    );
};
