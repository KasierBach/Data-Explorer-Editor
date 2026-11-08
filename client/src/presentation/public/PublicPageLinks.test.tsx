import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PublicLanguage, PublicPageKind } from '@/core/seo/publicRoutes';
import { PublicPageLinks } from './PublicPageLinks';

const pages = ['landing', 'docs', 'changelog'] as const;
const localized = {
    vi: { labels: ['Trang chủ', 'Tài liệu', 'Cập nhật'], hrefs: ['/', '/docs', '/changelog'] },
    en: { labels: ['Home', 'Documentation', 'Changelog'], hrefs: ['/en', '/en/docs', '/en/changelog'] },
};

for (const lang of ['vi', 'en'] as const) {
    describe(`PublicPageLinks ${lang}`, () => {
        it.each(pages)('renders only native localized pages with exactly %s active', currentPage => {
            const { container } = render(<PublicPageLinks lang={lang} currentPage={currentPage} className="public-page-link" />);
            const links = screen.getAllByRole('link');
            expect(links).toHaveLength(3);
            expect(container.children).toHaveLength(3);
            expect(links.map(link => link.textContent)).toEqual(localized[lang].labels);
            expect(links.map(link => link.getAttribute('href'))).toEqual(localized[lang].hrefs);
            expect(container.querySelectorAll('[aria-current]')).toHaveLength(1);
            links.forEach((link, index) => {
                expect(link.tagName).toBe('A');
                expect(link).toHaveClass('public-page-link');
                if (pages[index] === currentPage) expect(link).toHaveAttribute('aria-current', 'page');
                else expect(link).not.toHaveAttribute('aria-current');
            });
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'Workspace' })).not.toBeInTheDocument();
        });

        it('uses an explicit href resolver without adding a second locale prefix', () => {
            const hrefFor = vi.fn((path: string) => `/custom${path === '/' ? '' : path}?locale=${lang}`);
            render(<PublicPageLinks lang={lang} currentPage="docs" className="page" hrefFor={hrefFor} />);
            expect(hrefFor.mock.calls.map(([path]) => path)).toEqual(['/', '/docs', '/changelog']);
            expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([
                `/custom?locale=${lang}`,
                `/custom/docs?locale=${lang}`,
                `/custom/changelog?locale=${lang}`,
            ]);
        });

        it('keeps all three localized hrefs and active state in server-rendered output', () => {
            const html = renderToStaticMarkup(<PublicPageLinks lang={lang} currentPage="changelog" className="page" />);
            const document = new DOMParser().parseFromString(html, 'text/html');
            const links = Array.from(document.querySelectorAll('a'));
            expect(links).toHaveLength(3);
            expect(links.map(link => link.textContent)).toEqual(localized[lang].labels);
            expect(links.map(link => link.getAttribute('href'))).toEqual(localized[lang].hrefs);
            expect(document.querySelectorAll('[aria-current]')).toHaveLength(1);
            expect(links[2].getAttribute('aria-current')).toBe('page');
            expect(html).not.toContain('<button');
        });
    });
}

it.each(['legal', 'privacy', 'terms'] as const)('does not falsely mark a page active on %s', (currentPage: PublicPageKind) => {
    const { container } = render(<PublicPageLinks lang="en" currentPage={currentPage} className="page" />);
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(container.querySelector('[aria-current]')).not.toBeInTheDocument();
});

it.each(['vi', 'en'] as const)('calls onNavigate without canceling the native anchor in %s', (lang: PublicLanguage) => {
    const onNavigate = vi.fn();
    render(<PublicPageLinks lang={lang} currentPage="landing" className="page" hrefFor={path => `#${path === '/' ? 'home' : path.slice(1)}`} onNavigate={onNavigate} />);
    expect(onNavigate).not.toHaveBeenCalled();
    const link = screen.getByRole('link', { name: localized[lang].labels[1] });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    expect(fireEvent(link, click)).toBe(true);
    expect(click.defaultPrevented).toBe(false);
    expect(link).toHaveAttribute('href', '#docs');
    expect(onNavigate).toHaveBeenCalledOnce();
});
