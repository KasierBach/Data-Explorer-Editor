import { publicPath, type PublicLanguage, type PublicPageKind } from '@/core/seo/publicRoutes';

interface PublicPageLinksProps {
    lang: PublicLanguage;
    currentPage: PublicPageKind;
    className: string;
    hrefFor?: (path: string) => string;
    onNavigate?: () => void;
}

export function PublicPageLinks({ lang, currentPage, className, hrefFor, onNavigate }: PublicPageLinksProps) {
    const vi = lang === 'vi';
    const pages = [
        { kind: 'landing', path: '/', label: vi ? 'Trang chủ' : 'Home' },
        { kind: 'docs', path: '/docs', label: vi ? 'Tài liệu' : 'Documentation' },
        { kind: 'changelog', path: '/changelog', label: vi ? 'Cập nhật' : 'Changelog' },
    ] as const;
    return <>{pages.map(page => (
        <a key={page.kind} href={hrefFor ? hrefFor(page.path) : publicPath(lang, page.path)} className={className} aria-current={page.kind === currentPage ? 'page' : undefined} onClick={onNavigate}>
            {page.label}
        </a>
    ))}</>;
}
