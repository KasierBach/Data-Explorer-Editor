import { DOCS_STRUCTURE } from '@/presentation/components/docs/DocSidebar';

export type PublicLanguage = 'vi' | 'en';
export type PublicPageKind = 'landing' | 'docs' | 'changelog' | 'legal' | 'privacy' | 'terms';

export interface PublicRoute {
    path: string;
    basePath: string;
    lang: PublicLanguage;
    kind: PublicPageKind;
    sectionId?: string;
    title: string;
    description: string;
    canonical: string;
}

export const PUBLIC_SITE_URL = 'https://data-explorer-editor.vercel.app';
export const PUBLIC_SITE_NAME = 'Data Explorer';
export const PUBLIC_OG_IMAGE = `${PUBLIC_SITE_URL}/og-image.png`;

const copy = {
    vi: {
        landing: ['Data Explorer — Workspace SQL & NoSQL trên web', 'Khám phá database, viết query SQL, duyệt MongoDB, xem sơ đồ ERD và kết quả trong một workspace mã nguồn mở trên web. Dùng AI tùy chọn khi cần.'],
        docs: ['Tài liệu | Data Explorer', 'Hướng dẫn cài đặt, kết nối database và dùng workspace SQL/NoSQL, ERD, AI và các công cụ dữ liệu của Data Explorer.'],
        changelog: ['Cập nhật sản phẩm | Data Explorer', 'Xem các phiên bản, tính năng, bản sửa lỗi và thay đổi trong Data Explorer — workspace SQL và NoSQL trên web.'],
        legal: ['Trung tâm pháp lý | Data Explorer', 'Thông tin pháp lý, chính sách quyền riêng tư và điều khoản sử dụng Data Explorer cho tài khoản và workspace dữ liệu.'],
        privacy: ['Chính sách quyền riêng tư | Data Explorer', 'Tìm hiểu cách Data Explorer xử lý thông tin tài khoản, kết nối, workspace, lưu trữ dữ liệu và quyền riêng tư.'],
        terms: ['Điều khoản dịch vụ | Data Explorer', 'Điều khoản truy cập, đăng ký và sử dụng Data Explorer; trách nhiệm của người dùng khi làm việc với database và workspace.'],
    },
    en: {
        landing: ['Data Explorer — SQL & NoSQL Web Workspace', 'Explore databases, write SQL, browse MongoDB, and inspect ERDs and query results in an open-source web workspace. Add optional AI when you need it.'],
        docs: ['Documentation | Data Explorer', 'Learn to install Data Explorer, connect databases, and use the SQL/NoSQL workspace, ERD, optional AI, and data tools.'],
        changelog: ['Product Changelog | Data Explorer', 'Explore Data Explorer releases, product improvements, bug fixes, and changes to the SQL and NoSQL web workspace.'],
        legal: ['Legal Center | Data Explorer', 'Review the legal information, privacy policy, and terms of service for Data Explorer accounts and data workspaces.'],
        privacy: ['Privacy Policy | Data Explorer', 'Learn how Data Explorer handles account, connection, and workspace information, data retention, and privacy rights.'],
        terms: ['Terms of Service | Data Explorer', 'Review the terms for accessing, registering for, and using Data Explorer, including responsibilities when working with databases.'],
    },
} as const;

export const publicDocItems = DOCS_STRUCTURE.flatMap(section => section.items ?? []);

export function publicPath(lang: PublicLanguage, path: string) {
    return lang === 'en' ? `/en${path === '/' ? '' : path}` : path;
}

export function resolvePublicRoute(pathname: string): PublicRoute | null {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    const lang: PublicLanguage = path === '/en' || path.startsWith('/en/') ? 'en' : 'vi';
    const basePath = lang === 'en' ? path.slice(3) || '/' : path;
    let kind: PublicPageKind;
    let sectionId: string | undefined;
    if (basePath === '/') kind = 'landing';
    else if (basePath === '/docs' || basePath.startsWith('/docs/')) {
        kind = 'docs';
        sectionId = basePath === '/docs' ? 'introduction' : basePath.slice(6);
        if (!publicDocItems.some(item => item.id === sectionId)) return null;
    } else if (['/changelog', '/legal', '/privacy', '/terms'].includes(basePath)) {
        kind = basePath.slice(1) as PublicPageKind;
    } else return null;

    let [title, description]: [string, string] = [...copy[lang][kind]];
    if (kind === 'docs' && basePath !== '/docs') {
        const item = publicDocItems.find(item => item.id === sectionId)!;
        const label = lang === 'en' ? item.titleEn ?? item.title : item.title;
        title = `${label} | Data Explorer`;
        description = lang === 'vi' ? `Hướng dẫn ${label.toLowerCase()} trong Data Explorer. Thiết lập và sử dụng công cụ phù hợp cho workspace và database của bạn.` : `Learn about ${label.toLowerCase()} in Data Explorer. Configure and use the right tools for your database and workspace.`;
    }
    return { path, basePath, lang, kind, sectionId, title, description, canonical: `${PUBLIC_SITE_URL}${path === '/' ? '' : path}` };
}

export function listPublicRoutes() {
    const paths = ['/', '/docs', '/changelog', '/legal', '/privacy', '/terms', ...publicDocItems.map(item => `/docs/${item.id}`)];
    return (['vi', 'en'] as const).flatMap(lang => paths.map(path => resolvePublicRoute(publicPath(lang, path))!));
}

export function publicStructuredData(route: PublicRoute) {
    const website = { '@type': 'WebSite', '@id': `${PUBLIC_SITE_URL}/#website`, name: PUBLIC_SITE_NAME, url: PUBLIC_SITE_URL, inLanguage: ['vi', 'en'] };
    const page = { '@type': 'WebPage', '@id': `${route.canonical}#page`, name: route.title, description: route.description, url: route.canonical, inLanguage: route.lang, isPartOf: { '@id': website['@id'] } };
    const graph: Record<string, unknown>[] = [website, page];
    if (route.kind === 'landing') {
        graph.push({ '@type': 'WebApplication', '@id': `${PUBLIC_SITE_URL}/#application`, name: PUBLIC_SITE_NAME, url: PUBLIC_SITE_URL, applicationCategory: 'DeveloperApplication', operatingSystem: 'Web browser', description: route.description, image: PUBLIC_OG_IMAGE, screenshot: `${PUBLIC_SITE_URL}/images/landing/workspace.webp`, isAccessibleForFree: true });
    }
    return { '@context': 'https://schema.org', '@graph': graph };
}

export function serializePublicData(value: unknown) {
    return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
