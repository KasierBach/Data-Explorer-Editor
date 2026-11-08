import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getChangelogPageContent } from '../pages/changelogContent';
import { ChangelogView } from './ChangelogView';

function releaseAnchorId(version: string): string {
    return `release-${version.replaceAll('.', '-')}`;
}

beforeEach(() => {
    window.history.replaceState({}, '', '/');
    vi.stubGlobal('IntersectionObserver', undefined);
});

afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('ChangelogView', () => {
    it.each(['en', 'vi'] as const)('preserves all release content while keeping the latest open in %s', lang => {
        const content = getChangelogPageContent(lang);
        const { container } = render(<ChangelogView lang={lang} />);

        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(content.heading);
        expect(screen.getByText(content.subtitle)).toBeInTheDocument();
        expect(screen.getAllByRole('article')).toHaveLength(content.releases.length);
        expect(screen.getAllByRole('heading', { level: 4, hidden: true })).toHaveLength(content.releases.reduce((count, release) => count + release.features.length, 0));

        for (const [index, release] of content.releases.entries()) {
            const article = container.querySelector<HTMLElement>(`#${releaseAnchorId(release.version)}`)!;
            expect(within(article).getByRole('heading', { level: 2, name: release.version })).toBeInTheDocument();
            expect(within(article).getByRole('heading', { level: 3, name: release.title })).toBeInTheDocument();
            expect(within(article).getByText(release.date, { exact: true })).toBeInTheDocument();
            if (release.badge) expect(within(article).getByText(release.badge, { exact: true })).toBeInTheDocument();
            for (const feature of release.features) {
                const featureHeading = within(article).getByRole('heading', { level: 4, name: feature.title, hidden: true });
                expect(within(featureHeading.closest('li')!).getByText(feature.description, { exact: true })).toBeInTheDocument();
            }
            if (index === 0) expect(article.querySelector('.pc-release-details')).toBeNull();
            else expect(article.querySelector('details')).not.toHaveAttribute('open');
        }
        expect(container.querySelector('.pc-hero,.pc-deck,.pe-scene')).toBeNull();
        expect(screen.queryByRole('button', { name: /motion|chuyển động/i })).not.toBeInTheDocument();
    });

    it('keeps native release anchors and opens the selected history entry', () => {
        const content = getChangelogPageContent('en');
        const { container } = render(<ChangelogView lang="en" />);
        const index = screen.getByRole('navigation', { name: 'Versions' });
        const links = within(index).getAllByRole('link');
        expect(links).toHaveLength(content.releases.length);
        expect(links[0]).toHaveAttribute('aria-current', 'location');

        for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href^="#release-v"]')) {
            expect(container.querySelector(link.getAttribute('href')!)?.tagName).toBe('ARTICLE');
        }
        for (const [position, release] of content.releases.entries()) {
            expect(links[position]).toHaveAttribute('href', `#${releaseAnchorId(release.version)}`);
        }
        fireEvent.click(links[1]);
        const selected = releaseAnchorId(content.releases[1].version);
        expect(links[1]).toHaveAttribute('aria-current', 'location');
        expect(links[0]).not.toHaveAttribute('aria-current');
        expect(container.querySelector('.pc-selected-version')).toHaveTextContent(content.releases[1].version);
        expect(container.querySelector(`#${selected}`)).toHaveAttribute('data-active', 'true');
        expect(container.querySelector(`#${selected} details`)).toHaveAttribute('open');
        expect(container.querySelector('.pc-index-mobile')).toHaveProperty('tagName', 'DETAILS');
    });

    it('matches versions and hidden feature text, expands matches, and restores the list on clear', async () => {
        const content = getChangelogPageContent('en');
        const { container } = render(<ChangelogView lang="en" />);
        const input = await screen.findByRole('searchbox', { name: 'Search releases and updates' });
        await waitFor(() => expect(input).toBeVisible());
        fireEvent.change(input, { target: { value: '1.6.6' } });
        expect(screen.getAllByRole('article')).toHaveLength(1);
        expect(screen.getByRole('article')).toHaveAttribute('id', '#release-v1-6-6'.slice(1));
        expect(container.querySelector('#release-v1-6-6 details')).toHaveAttribute('open');
        expect(screen.getByRole('status')).toHaveTextContent('1 matching releases');

        fireEvent.change(input, { target: { value: content.releases[1].features[0].description.slice(0, 40) } });
        expect(screen.getAllByRole('article').some(article => article.id === 'release-v1-6-6')).toBe(true);
        expect(container.querySelector('#release-v1-6-6 details')).toHaveAttribute('open');
        fireEvent.change(input, { target: { value: 'no-such-release-987654' } });
        expect(screen.queryAllByRole('article')).toHaveLength(0);
        expect(screen.getByRole('heading', { name: 'No matching releases' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'View all releases' }));
        expect(input).toHaveValue('');
        expect(input).toHaveFocus();
        expect(screen.getAllByRole('article')).toHaveLength(content.releases.length);

        fireEvent.change(input, { target: { value: '1.6.5' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(input).toHaveValue('');
        expect(screen.getAllByRole('article')).toHaveLength(content.releases.length);
    });

    it('searches Vietnamese without requiring accents and clears without navigation', async () => {
        const { container } = render(<ChangelogView lang="vi" />);
        const input = await screen.findByRole('searchbox', { name: 'Tìm phiên bản hoặc nội dung cập nhật' });
        await waitFor(() => expect(input).toBeVisible());
        fireEvent.change(input, { target: { value: 'dau ra' } });
        expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
        expect(screen.getAllByRole('article').every(article => {
            const text = article.textContent!.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
            return text.includes('dau') && text.includes('ra');
        })).toBe(true);
        expect(container.querySelectorAll('article:not([hidden]) details:not([open])')).toHaveLength(0);
        fireEvent.click(screen.getByRole('button', { name: 'Xóa tìm kiếm' }));
        expect(input).toHaveFocus();
        expect(input).toHaveValue('');
        expect(window.location.hash).toBe('');
    });

    it('opens direct hashes and follows hash changes without an observer', async () => {
        window.history.replaceState({}, '', '#release-v1-6-5');
        const { container } = render(<ChangelogView lang="en" />);
        await waitFor(() => expect(container.querySelector('#release-v1-6-5 details')).toHaveAttribute('open'));
        expect(container.querySelector('#release-v1-6-5')).toHaveAttribute('data-active', 'true');
        act(() => {
            window.history.replaceState({}, '', '#release-v1-6-6');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        expect(container.querySelector('#release-v1-6-6 details')).toHaveAttribute('open');
        expect(container.querySelector('#release-v1-6-6')).toHaveAttribute('data-active', 'true');
    });

    it('opens a requested release even when the current search hides it', async () => {
        const { container } = render(<ChangelogView lang="en" />);
        const input = await screen.findByRole('searchbox', { name: 'Search releases and updates' });
        fireEvent.change(input, { target: { value: '1.6.5' } });
        expect(container.querySelector('#release-v1-6-7')).toHaveAttribute('hidden');
        fireEvent.click(screen.getByRole('link', { name: /Latest release/ }));
        expect(input).toHaveValue('');
        expect(container.querySelector('#release-v1-6-7')).not.toHaveAttribute('hidden');
        expect(container.querySelector('#release-v1-6-7')).toHaveAttribute('data-active', 'true');
    });

    it('aligns a requested release after enhancement and stops listening after unmount', async () => {
        const { container, unmount } = render(<ChangelogView lang="en" />);
        await screen.findByRole('searchbox', { name: 'Search releases and updates' });
        const release = container.querySelector<HTMLElement>('#release-v1-6-5')!;
        const align = vi.fn();
        release.scrollIntoView = align;
        act(() => { window.history.replaceState({}, '', '#release-v1-6-5'); window.dispatchEvent(new HashChangeEvent('hashchange')); });
        await waitFor(() => expect(align).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' }));
        align.mockClear();
        act(() => { window.dispatchEvent(new Event('load')); });
        await waitFor(() => expect(align).toHaveBeenCalledOnce());
        unmount();
        align.mockClear();
        act(() => { window.dispatchEvent(new Event('load')); window.dispatchEvent(new HashChangeEvent('hashchange')); });
        await new Promise(resolve => setTimeout(resolve, 30));
        expect(align).not.toHaveBeenCalled();
    });

    it('renders all content before enhancement with native history disclosure and no search requirement', () => {
        const content = getChangelogPageContent('en');
        const html = renderToString(<ChangelogView lang="en" />);
        expect(html).toContain('data-enhanced="false"');
        expect(html).toContain('class="pc-search-tools" hidden=""');
        expect(html).toContain('<details class="pc-release-details">');
        expect(html).not.toContain('pc-deck');
        for (const release of content.releases) {
            expect(html).toContain(`id="${releaseAnchorId(release.version)}"`);
            expect(html).toContain(release.version);
            for (const feature of release.features) {
                expect(html).toContain(feature.description.replaceAll('&', '&amp;').replaceAll('>', '&gt;').replaceAll('<', '&lt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;'));
            }
        }
    });

    it('observes only local release articles and disconnects on unmount', () => {
        const observers: LocalObserver[] = [];
        class LocalObserver implements IntersectionObserver {
            readonly root = null;
            readonly rootMargin = '';
            readonly thresholds = [0];
            targets: Element[] = [];
            disconnect = vi.fn();
            unobserve = vi.fn();
            takeRecords = vi.fn(() => []);
            observe = vi.fn((target: Element) => { this.targets.push(target); });
            readonly callback: IntersectionObserverCallback;
            constructor(callback: IntersectionObserverCallback) {
                this.callback = callback;
                observers.push(this);
            }
        }
        vi.stubGlobal('IntersectionObserver', LocalObserver);
        const { container, unmount } = render(<ChangelogView lang="en" />);
        const observer = observers.find(candidate => candidate.targets.some(target => target.tagName === 'ARTICLE'))!;
        const articles = Array.from(container.querySelectorAll('article[data-release-id]'));
        expect(observer).toBeDefined();
        expect(observer.targets).toEqual(articles);
        act(() => {
            observer.callback([{ target: articles[1], isIntersecting: true } as IntersectionObserverEntry], observer);
        });
        expect(articles[1]).toHaveAttribute('data-active', 'true');
        unmount();
        expect(observer.disconnect).toHaveBeenCalled();
    });
});
