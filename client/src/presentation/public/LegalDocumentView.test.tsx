import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePublicRoute, type PublicLanguage } from '@/core/seo/publicRoutes';
import { getLegalDocument, type LegalDocKey } from './legalContent';
import { LegalDocumentView } from './LegalDocumentView';
import { PublicNavigationContext } from './PublicNavigationContext';
import { PublicSite } from './PublicSite';

vi.mock('./PublicSeo', () => ({ PublicSeo: () => null }));

const keys: LegalDocKey[] = ['legal', 'privacy', 'terms'];
const languages: PublicLanguage[] = ['vi', 'en'];
const cases = languages.flatMap(lang => keys.map(docKey => ({ lang, docKey })));

function renderDocument(lang: PublicLanguage, docKey: LegalDocKey) {
    const path = `${lang === 'en' ? '/en' : ''}/${docKey}`;
    return render(
        <PublicNavigationContext.Provider value={resolvePublicRoute(path)}>
            <LegalDocumentView lang={lang} docKey={docKey} />
        </PublicNavigationContext.Provider>,
    );
}

beforeEach(() => {
    window.history.replaceState({}, '', '/');
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('LegalDocumentView', () => {
    it.each(cases)('renders every draft paragraph, list, heading, and date in $lang/$docKey', ({ lang, docKey }) => {
        const doc = getLegalDocument(lang, docKey);
        const { container } = renderDocument(lang, docKey);
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(doc.title);
        expect(screen.getByText(doc.subtitle, { exact: true })).toBeInTheDocument();
        expect(within(container.querySelector('.pl-masthead')!).getByText(doc.effectiveDate, { exact: true })).toBeInTheDocument();
        const article = screen.getByRole('article', { name: doc.title });
        const sections = Array.from(article.querySelectorAll<HTMLElement>(':scope > section'));
        expect(sections).toHaveLength(doc.sections.length);
        for (const [index, section] of doc.sections.entries()) {
            const node = sections[index];
            expect(node.id).toBe(`${docKey}-${section.id}`);
            expect(within(node).getByRole('heading', { level: 2, name: section.title })).toHaveAttribute('id', `${docKey}-${section.id}-title`);
            expect(Array.from(node.querySelectorAll('p'), paragraph => paragraph.textContent)).toEqual([...section.paragraphs]);
            expect(Array.from(node.querySelectorAll('li'), bullet => bullet.textContent)).toEqual([...(section.bullets ?? [])]);
            expect(node.closest('details')).toBeNull();
        }
        expect(container.querySelector('.pe-scene,.lp-stage,.pc-release-details')).toBeNull();
        expect(new Set(Array.from(container.querySelectorAll('[id]'), element => element.id)).size).toBe(container.querySelectorAll('[id]').length);
    });

    it.each(cases)('keeps native legal navigation and locale-aware destinations in $lang/$docKey', ({ lang, docKey }) => {
        const doc = getLegalDocument(lang, docKey);
        const { container } = renderDocument(lang, docKey);
        const nav = screen.getByRole('navigation', { name: lang === 'vi' ? 'Tài liệu pháp lý' : 'Legal documents' });
        const links = within(nav).getAllByRole('link');
        expect(links).toHaveLength(3);
        for (const [index, key] of keys.entries()) {
            expect(links[index]).toHaveAttribute('href', `${lang === 'en' ? '/en' : ''}/${key}`);
            if (key === docKey) expect(links[index]).toHaveAttribute('aria-current', 'page');
            else expect(links[index]).not.toHaveAttribute('aria-current');
        }
        for (const link of container.querySelectorAll('a[href^="#"]')) {
            expect(container.querySelector(link.getAttribute('href')!)).not.toBeNull();
        }
        const cards = container.querySelectorAll<HTMLAnchorElement>('.pl-document-card');
        expect(cards.length).toBe(docKey === 'legal' ? 2 : 0);
        for (const [index, link] of (getLegalDocument(lang, docKey).quickLinks ?? []).entries()) {
            expect(cards[index]).toHaveAttribute('href', `${lang === 'en' ? '/en' : ''}${link.href}`);
            expect(cards[index]).toHaveTextContent(link.label);
        }
        expect(screen.getByRole('link', { name: /^(Quay lại trang chủ|Back to home)$/ })).toHaveAttribute('href', lang === 'en' ? '/en' : '/');
        expect(within(container.querySelector('.pl-reading-end')!).getByRole('link', { name: /^(Tìm hiểu xử lý dữ liệu|Explore data handling)$/ })).toHaveAttribute('href', `${lang === 'en' ? '/en' : ''}/docs/data-handling`);
        if (docKey === 'legal') {
            const overview = screen.getByRole('complementary', { name: lang === 'vi' ? 'Tổng quan tài liệu pháp lý' : 'Legal overview' });
            const totalSections = keys.reduce((total, key) => total + getLegalDocument(lang, key).sections.length, 0);
            expect(within(overview).getByText(String(totalSections), { exact: true })).toBeInTheDocument();
            expect(within(overview).getByRole('link', { name: lang === 'vi' ? 'Đọc phạm vi áp dụng' : 'Read the scope' })).toHaveAttribute('href', '#legal-scope');
        }
        const rail = screen.getByRole('complementary', { name: lang === 'vi' ? 'Thông tin liên quan' : 'Related information' });
        expect(within(rail).getByText(doc.effectiveDate, { exact: true })).toBeInTheDocument();
        expect(within(rail).getByText(lang === 'vi' ? `${doc.sections.length} mục · VI / EN` : `${doc.sections.length} sections · VI / EN`, { exact: true })).toBeInTheDocument();
        for (const key of keys.filter(key => key !== docKey)) {
            expect(within(rail).getByRole('link', { name: getLegalDocument(lang, key).title })).toHaveAttribute('href', `${lang === 'en' ? '/en' : ''}/${key}`);
        }
        for (const path of ['/docs/data-handling', '/docs/security', '/docs/operational-limits']) {
            expect(rail.querySelector(`a[href="${lang === 'en' ? '/en' : ''}${path}"]`)).not.toBeNull();
        }
    });

    it.each(cases)('renders the full article and native contents before JavaScript in $lang/$docKey', ({ lang, docKey }) => {
        const doc = getLegalDocument(lang, docKey);
        const html = renderToString(<LegalDocumentView lang={lang} docKey={docKey} />);
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const article = parsed.querySelector('article')!;
        expect(article.querySelectorAll(':scope > section')).toHaveLength(doc.sections.length);
        for (const section of doc.sections) {
            expect(parsed.getElementById(`${docKey}-${section.id}`)).not.toBeNull();
            for (const text of [...section.paragraphs, ...(section.bullets ?? [])]) expect(article.textContent).toContain(text);
        }
        expect(parsed.querySelector('.pl-contents-mobile')?.tagName).toBe('DETAILS');
        expect(parsed.querySelectorAll('article details,article [hidden]')).toHaveLength(0);
    });

    it('uses the same structural section IDs and block counts for both languages', () => {
        for (const key of keys) {
            const vi = getLegalDocument('vi', key);
            const en = getLegalDocument('en', key);
            expect(vi.sections.map(section => section.id)).toEqual(en.sections.map(section => section.id));
            expect(vi.sections.map(section => [section.paragraphs.length, section.bullets?.length ?? 0])).toEqual(en.sections.map(section => [section.paragraphs.length, section.bullets?.length ?? 0]));
            expect(vi.effectiveDate).toBe('Hiệu lực từ 28/06/2026');
            expect(en.effectiveDate).toBe('Effective June 28, 2026');
        }
    });

    it('selects direct hashes, aligns only article sections, and stops after unmount', async () => {
        window.history.replaceState({}, '', '/en/privacy#privacy-ai');
        const { container, unmount } = renderDocument('en', 'privacy');
        const section = container.querySelector<HTMLElement>('#privacy-ai')!;
        const align = vi.fn();
        section.scrollIntoView = align;
        await waitFor(() => expect(align).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' }));
        expect(container.querySelector('.pl-outline a[href="#privacy-ai"]')).toHaveAttribute('aria-current', 'location');
        const credentials = container.querySelector<HTMLElement>('#privacy-credentials')!;
        const nextAlign = vi.fn();
        credentials.scrollIntoView = nextAlign;
        act(() => {
            window.history.replaceState({}, '', '/en/privacy#privacy-credentials');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        await waitFor(() => expect(nextAlign).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' }));
        expect(container.querySelector('.pl-outline a[href="#privacy-credentials"]')).toHaveAttribute('aria-current', 'location');
        unmount();
        nextAlign.mockClear();
        act(() => { window.dispatchEvent(new Event('load')); window.dispatchEvent(new HashChangeEvent('hashchange')); });
        expect(nextAlign).not.toHaveBeenCalled();
    });

    it('ignores hashes outside the current document', async () => {
        window.history.replaceState({}, '', '/en/privacy#terms-billing');
        const { container } = renderDocument('en', 'privacy');
        const align = vi.fn();
        for (const section of container.querySelectorAll<HTMLElement>('.pl-section')) section.scrollIntoView = align;
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(align).not.toHaveBeenCalled();
        expect(container.querySelector('.pl-contents-list [aria-current]')).toBeNull();
    });

    it('moves keyboard focus from an open mobile contents summary to the first link', () => {
        const { container } = renderDocument('en', 'privacy');
        const details = container.querySelector<HTMLDetailsElement>('.pl-contents-mobile')!;
        const summary = details.querySelector('summary')!;
        const first = details.querySelector<HTMLAnchorElement>('nav a')!;
        details.open = true;
        summary.focus();
        fireEvent.keyDown(summary, { key: 'Tab' });
        expect(first).toHaveFocus();
        first.blur();
        summary.focus();
        fireEvent.keyDown(summary, { key: 'Tab', shiftKey: true });
        expect(summary).toHaveFocus();
        details.open = false;
        fireEvent.keyDown(summary, { key: 'Tab' });
        expect(summary).toHaveFocus();
    });

    it('keeps license and billing explanations factual without schema-only or export-all promises', () => {
        const privacy = JSON.stringify(getLegalDocument('en', 'privacy'));
        const terms = JSON.stringify(getLegalDocument('en', 'terms'));
        expect(privacy).toContain('conversation history');
        expect(privacy).toContain('selected attachments');
        expect(privacy).toContain('not every data category has an export-all or delete-all action');
        expect(privacy).not.toContain('only receive schema metadata');
        expect(privacy).not.toContain('Deleting a connection permanently deletes its credentials');
        expect(terms).toContain('MIT License');
        expect(terms).toContain('30-day or 365-day');
        expect(terms).not.toContain('You can cancel renewal at any time');
        expect(terms).not.toContain('may not copy, reverse engineer');
    });

    it('keeps unconfirmed business clauses and dates visible for owner review rather than silently replacing them', () => {
        const vi = getLegalDocument('vi', 'terms');
        const en = getLegalDocument('en', 'terms');
        expect(vi.sections.find(section => section.id === 'liability')?.paragraphs[0]).toContain('12 tháng gần nhất');
        expect(en.sections.find(section => section.id === 'liability')?.paragraphs[0]).toContain('preceding 12 months');
        expect(vi.sections.find(section => section.id === 'billing')?.paragraphs.at(-1)).toContain('không hoàn lại');
        expect(en.sections.find(section => section.id === 'billing')?.paragraphs.at(-1)).toContain('non-refundable');
        expect(getLegalDocument('en', 'legal').sections.find(section => section.id === 'contact')?.paragraphs[0]).toContain('legal@dataexplorer.app');
    });
});

describe('legal PublicSite shell', () => {
    it.each(cases)('uses reading chrome and no decorative backdrop for $lang/$docKey', ({ lang, docKey }) => {
        const route = resolvePublicRoute(`${lang === 'en' ? '/en' : ''}/${docKey}`)!;
        const { container } = render(<PublicSite route={route} View={() => <LegalDocumentView docKey={docKey} lang={lang} />} />);
        expect(container.querySelector('.public-legal-site')).not.toBeNull();
        expect(container.querySelector('.pe-header')).not.toBeNull();
        expect(container.querySelector('.pe-footer')).not.toBeNull();
        expect(container.querySelector('.lp-header,.interactive-background')).toBeNull();
        const header = screen.getByRole('banner');
        expect(within(header).getByRole('link', { name: 'Workspace' })).toHaveAttribute('href', '/login');
        expect(within(header).getByRole('link', { name: /^EN$/ })).toHaveAttribute('href', `/en/${docKey}`);
        expect(within(header).getByRole('link', { name: /^VN$/ })).toHaveAttribute('href', `/${docKey}`);
        expect(container.querySelector('a[href="#features"],a[href="#demo"],a[href="#pricing"]')).toBeNull();
    });

    it('keeps the signed-in workspace destination and current hash when switching language', () => {
        window.history.replaceState({}, '', '/en/privacy?review=1#privacy-ai');
        const route = resolvePublicRoute('/en/privacy')!;
        render(<PublicSite route={route} View={() => <LegalDocumentView docKey="privacy" lang="en" />} isAuthenticated />);
        const header = screen.getByRole('banner');
        expect(within(header).getByRole('link', { name: 'Workspace' })).toHaveAttribute('href', '/sql-explorer');
        expect(within(header).getByRole('link', { name: /^VN$/ })).toHaveAttribute('href', '/privacy?review=1#privacy-ai');
    });
});
