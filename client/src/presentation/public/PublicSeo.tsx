import { useEffect } from 'react';
import { publicSeoTags } from '@/core/seo/publicMetadata';
import type { PublicRoute } from '@/core/seo/publicRoutes';

export function PublicSeo({ route }: { route: PublicRoute }) {
    useEffect(() => {
        const tags = publicSeoTags(route);
        const previousLanguage = document.documentElement.lang;
        const previous = Array.from(document.head.querySelectorAll('title,meta[name="description"],meta[name="robots"],meta[name="googlebot"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],link[hreflang],script[type="application/ld+json"]'));
        const baseline = previous.filter(element => !element.hasAttribute('data-public-seo'));
        previous.forEach(element => element.remove());
        const owned: HTMLElement[] = [];
        const append = (element: HTMLElement) => {
            element.setAttribute('data-public-seo', '');
            owned.push(element);
            document.head.append(element);
        };
        const title = document.createElement('title');
        title.textContent = tags.title;
        append(title);
        for (const attributes of tags.meta) {
            const element = document.createElement('meta');
            for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
            append(element);
        }
        for (const attributes of tags.links) {
            const element = document.createElement('link');
            for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
            append(element);
        }
        const schema = document.createElement('script');
        schema.type = 'application/ld+json';
        schema.textContent = tags.structuredData;
        append(schema);
        document.documentElement.lang = route.lang;
        return () => {
            owned.forEach(element => element.remove());
            baseline.forEach(element => document.head.append(element));
            if (document.documentElement.lang === route.lang) document.documentElement.lang = previousLanguage;
        };
    }, [route]);
    return null;
}
