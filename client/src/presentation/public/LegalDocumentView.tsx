import { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpenText, ChevronDown, FileText, Link2, List, Scale, ShieldCheck } from 'lucide-react';
import { getLegalDocument, type LegalDocKey } from './legalContent';
import type { PublicLanguage } from '@/core/seo/publicRoutes';
import { usePublicNavigation } from './PublicNavigationContext';

export function LegalDocumentView({ docKey, lang }: { docKey: LegalDocKey; lang: PublicLanguage }) {
    const doc = useMemo(() => getLegalDocument(lang, docKey), [lang, docKey]);
    const navigation = usePublicNavigation();
    const articleRef = useRef<HTMLElement>(null);
    const mobileContentsRef = useRef<HTMLDetailsElement>(null);
    const center = docKey === 'legal';
    const vi = lang === 'vi';
    const Icon = docKey === 'privacy' ? ShieldCheck : docKey === 'terms' ? Scale : FileText;
    const sectionId = (id: string) => `${docKey}-${id}`;
    const selectedId = navigation.hash.slice(1);
    const documents = (['legal', 'privacy', 'terms'] as const).map(key => ({ key, title: getLegalDocument(lang, key).title }));
    const otherDocuments = documents.filter(document => document.key !== docKey);
    const totalLegalSections = (['legal', 'privacy', 'terms'] as const).reduce((total, key) => total + getLegalDocument(lang, key).sections.length, 0);
    const supportLinks = [
        { href: navigation.path('/docs/data-handling'), label: vi ? 'Xử lý và lưu trữ dữ liệu' : 'Data handling and storage' },
        { href: navigation.path('/docs/security'), label: vi ? 'Bảo mật và quyền riêng tư' : 'Security and privacy' },
        { href: navigation.path('/docs/operational-limits'), label: vi ? 'Giới hạn vận hành' : 'Operational limits' },
    ];

    useEffect(() => {
        let active = true;
        let frame = 0;
        const alignSection = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (!active || !doc.sections.some(section => `${docKey}-${section.id}` === selectedId)) return;
                const section = document.getElementById(selectedId);
                if (section && articleRef.current?.contains(section)) section.scrollIntoView?.({ block: 'start', behavior: 'instant' });
            });
        };
        alignSection();
        void document.fonts?.ready.then(alignSection);
        window.addEventListener('load', alignSection);
        return () => {
            active = false;
            cancelAnimationFrame(frame);
            window.removeEventListener('load', alignSection);
        };
    }, [docKey, doc.sections, selectedId]);

    const contents = (
        <ol className="pl-contents-list">
            {doc.sections.map((section, index) => (
                <li key={section.id}>
                    <a href={`#${sectionId(section.id)}`} aria-current={selectedId === sectionId(section.id) ? 'location' : undefined}>
                        <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                        <span>{section.title}</span>
                    </a>
                </li>
            ))}
        </ol>
    );

    return (
        <main className={`public-legal pl-${docKey}`}>
            <div className="pe-container pl-container">
                <div className="pl-masthead">
                    <a href={navigation.path('/')} className="pl-back"><ArrowLeft size={16} aria-hidden="true" />{vi ? 'Quay lại trang chủ' : 'Back to home'}</a>
                    <div className="pl-heading-meta">
                        <span className="pl-document-mark"><Icon size={21} aria-hidden="true" /></span>
                        <span className="pl-kicker">Data Explorer / {vi ? 'Pháp lý' : 'Legal'}</span>
                    </div>
                    <h1>{doc.title}</h1>
                    <p className="pl-subtitle">{doc.subtitle}</p>
                    <p className="pl-effective-date"><span aria-hidden="true" />{doc.effectiveDate}</p>
                </div>

                <nav className="pl-document-nav" aria-label={vi ? 'Tài liệu pháp lý' : 'Legal documents'}>
                    {documents.map(document => (
                        <a key={document.key} href={navigation.path(`/${document.key}`)} aria-current={docKey === document.key ? 'page' : undefined}>{document.title}</a>
                    ))}
                </nav>

                {center && doc.quickLinks && (
                    <div className="pl-center-overview">
                        <div className="pl-document-cards">
                        {doc.quickLinks.map(link => {
                            const key = link.href.slice(1) as 'privacy' | 'terms';
                            const linked = getLegalDocument(lang, key);
                            const DocumentIcon = key === 'privacy' ? ShieldCheck : Scale;
                            return (
                                <a className="pl-document-card" key={link.href} href={navigation.path(link.href)}>
                                    <span className="pl-card-icon"><DocumentIcon size={23} aria-hidden="true" /></span>
                                    <h2>{linked.title}</h2>
                                    <p>{linked.subtitle}</p>
                                    <span className="pl-card-action">{link.label}<ArrowUpRight size={16} aria-hidden="true" /></span>
                                </a>
                            );
                        })}
                        </div>
                        <aside className="pl-center-summary" aria-label={vi ? 'Tổng quan tài liệu pháp lý' : 'Legal overview'}>
                            <p className="pl-context-label">{vi ? 'Bộ tài liệu pháp lý' : 'Legal documents'}</p>
                            <div className="pl-center-stat"><strong>{totalLegalSections}</strong><span>{vi ? 'mục nội dung VI / EN' : 'content sections in VI / EN'}</span></div>
                            <div className="pl-center-stat"><strong>3</strong><span>{vi ? 'tài liệu được liên kết' : 'linked documents'}</span></div>
                            <p className="pl-center-summary-copy">{vi ? 'Bắt đầu tại đây, sau đó mở Chính sách riêng tư hoặc Điều khoản dịch vụ cho nội dung chi tiết.' : 'Start here, then open the Privacy Policy or Terms of Service for the detailed rules.'}</p>
                            <a href="#legal-scope">{vi ? 'Đọc phạm vi áp dụng' : 'Read the scope'}<ArrowUpRight size={15} aria-hidden="true" /></a>
                        </aside>
                    </div>
                )}

                <div className="pl-reading-layout">
                    <aside className="pl-outline"><nav aria-label={vi ? 'Trong tài liệu này' : 'On this page'}><p className="pl-outline-label"><List size={15} aria-hidden="true" />{vi ? 'Trong tài liệu này' : 'On this page'}</p>{contents}</nav></aside>
                    <div className="pl-reading-column">
                        <details ref={mobileContentsRef} className="pl-contents-mobile"><summary onKeyDown={event => {
                            if (event.key !== 'Tab' || event.shiftKey || !event.currentTarget.parentElement?.hasAttribute('open')) return;
                            const firstLink = mobileContentsRef.current?.querySelector<HTMLAnchorElement>('nav a');
                            if (!firstLink) return;
                            event.preventDefault();
                            firstLink.focus();
                        }}><List size={17} aria-hidden="true" />{vi ? 'Mục lục tài liệu' : 'Document contents'}<ChevronDown size={16} aria-hidden="true" /></summary><nav aria-label={vi ? 'Mục lục trên mobile' : 'Mobile document contents'}>{contents}</nav></details>
                        <article ref={articleRef} className="pl-article" aria-label={doc.title}>
                            {doc.sections.map((section, index) => (
                                <section key={section.id} id={sectionId(section.id)} className="pl-section" aria-labelledby={`${sectionId(section.id)}-title`}>
                                    <div className="pl-section-heading">
                                        <span className="pl-section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                                        <h2 id={`${sectionId(section.id)}-title`}>{section.title}</h2>
                                        <a className="pl-section-link" href={`#${sectionId(section.id)}`} aria-label={`${vi ? 'Liên kết tới mục' : 'Link to section'}: ${section.title}`}><Link2 size={16} aria-hidden="true" /></a>
                                    </div>
                                    <div className="pl-prose">
                                        {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                                        {section.bullets && <ul>{section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>}
                                    </div>
                                </section>
                            ))}
                        </article>
                        <div className="pl-reading-end">
                            <a href={navigation.path('/legal')}><FileText size={16} aria-hidden="true" />{vi ? 'Bộ tài liệu pháp lý' : 'Legal documents'}</a>
                            <a href={navigation.path('/docs/data-handling')}>{vi ? 'Tìm hiểu xử lý dữ liệu' : 'Explore data handling'}<ArrowUpRight size={16} aria-hidden="true" /></a>
                        </div>
                    </div>
                    <aside className="pl-context-rail" aria-label={vi ? 'Thông tin liên quan' : 'Related information'}>
                        <div className="pl-context-card pl-context-status">
                            <p className="pl-context-label">{vi ? 'Tài liệu đang đọc' : 'Current document'}</p>
                            <span className="pl-context-icon"><Icon size={20} aria-hidden="true" /></span>
                            <h2>{doc.title}</h2>
                            <p>{doc.effectiveDate}</p>
                            <p>{vi ? `${doc.sections.length} mục · VI / EN` : `${doc.sections.length} sections · VI / EN`}</p>
                        </div>
                        <nav className="pl-context-card" aria-label={vi ? 'Tài liệu pháp lý liên quan' : 'Related legal documents'}>
                            <p className="pl-context-label">{vi ? 'Đọc tiếp' : 'Read next'}</p>
                            {otherDocuments.map(document => <a key={document.key} href={navigation.path(`/${document.key}`)}><span>{document.title}</span><ArrowUpRight size={15} aria-hidden="true" /></a>)}
                        </nav>
                        <nav className="pl-context-card" aria-label={vi ? 'Hướng dẫn liên quan' : 'Related guides'}>
                            <p className="pl-context-label">{vi ? 'Hiểu cách dữ liệu hoạt động' : 'Understand the data flow'}</p>
                            {supportLinks.map(link => <a key={link.href} href={link.href}><span>{link.label}</span><BookOpenText size={15} aria-hidden="true" /></a>)}
                        </nav>
                        <div className="pl-context-note">
                            <ShieldCheck size={17} aria-hidden="true" />
                            <p>{vi ? 'Không gửi mật khẩu, private key, API key hoặc token trong yêu cầu hỗ trợ.' : 'Do not include passwords, private keys, API keys, or tokens in support requests.'}</p>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    );
}
