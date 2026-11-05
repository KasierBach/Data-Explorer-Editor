import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PublicSeo } from './PublicSeo';
import { publicSeoTags } from '@/core/seo/publicMetadata';
import { resolvePublicRoute } from '@/core/seo/publicRoutes';

const selector = 'title,meta[name="description"],meta[name="robots"],meta[name="googlebot"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],link[hreflang],script[type="application/ld+json"]';

describe('PublicSeo ownership', () => {
    afterEach(() => document.querySelectorAll(selector).forEach(element => element.remove()));

    it('replaces static duplicates with one route-consistent set and cleans up only its nodes', () => {
        document.head.insertAdjacentHTML('beforeend', '<title>Old</title><title>Duplicate</title><meta name="description" content="Old"><meta name="description" content="Duplicate">');
        const route = resolvePublicRoute('/en')!;
        const { unmount } = render(<PublicSeo route={route} />);
        expect(document.querySelectorAll('title')).toHaveLength(1);
        expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
        expect(document.title).toBe(publicSeoTags(route).title);
        expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://data-explorer-editor.vercel.app/en');
        const unrelated = document.createElement('meta');
        unrelated.name = 'robots';
        unrelated.content = 'noindex';
        document.head.append(unrelated);
        unmount();
        expect(document.querySelectorAll('[data-public-seo]')).toHaveLength(0);
        expect(unrelated.isConnected).toBe(true);
    });

    it('restores app head ownership and language when an embedded public route unmounts', () => {
        document.documentElement.lang = 'en';
        document.head.insertAdjacentHTML('beforeend', '<title data-rh="true">Data Explorer</title><meta data-rh="true" name="robots" content="noindex, nofollow">');
        const { rerender, unmount } = render(<PublicSeo route={resolvePublicRoute('/docs')!} />);
        expect(document.documentElement.lang).toBe('vi');
        expect(document.querySelectorAll('title')).toHaveLength(1);
        expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
        rerender(<PublicSeo route={resolvePublicRoute('/en/docs/editor')!} />);
        expect(document.title).toBe(publicSeoTags(resolvePublicRoute('/en/docs/editor')!).title);
        expect(document.querySelectorAll('title')).toHaveLength(1);
        unmount();
        expect(document.title).toBe('Data Explorer');
        expect(document.querySelectorAll('title')).toHaveLength(1);
        expect(document.documentElement.lang).toBe('en');
        expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
        expect(document.querySelector('link[rel="canonical"]')).toBeNull();
        expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
    });

    it('adopts server metadata without restoring stale public tags after cleanup', () => {
        document.head.insertAdjacentHTML('beforeend', '<title data-public-seo>Static public title</title><meta data-public-seo name="description" content="Static public description">');
        const { unmount } = render(<PublicSeo route={resolvePublicRoute('/en')!} />);
        expect(document.querySelectorAll('title')).toHaveLength(1);
        unmount();
        expect(document.querySelectorAll('[data-public-seo]')).toHaveLength(0);
        expect(document.querySelectorAll('title')).toHaveLength(0);
    });
});
