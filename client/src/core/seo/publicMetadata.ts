import { PUBLIC_OG_IMAGE, PUBLIC_SITE_NAME, PUBLIC_SITE_URL, publicPath, publicStructuredData, serializePublicData, type PublicRoute } from './publicRoutes';

export function publicSeoTags(route: PublicRoute) {
    return {
        title: route.title,
        meta: [
            { name: 'description', content: route.description },
            { name: 'robots', content: 'index, follow' },
            { name: 'googlebot', content: 'index, follow' },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: route.canonical },
            { property: 'og:title', content: route.title },
            { property: 'og:description', content: route.description },
            { property: 'og:image', content: PUBLIC_OG_IMAGE },
            { property: 'og:image:width', content: '1200' },
            { property: 'og:image:height', content: '630' },
            { property: 'og:image:type', content: 'image/png' },
            { property: 'og:image:alt', content: 'Data Explorer SQL and NoSQL web workspace' },
            { property: 'og:site_name', content: PUBLIC_SITE_NAME },
            { property: 'og:locale', content: route.lang === 'vi' ? 'vi_VN' : 'en_US' },
            { property: 'og:locale:alternate', content: route.lang === 'vi' ? 'en_US' : 'vi_VN' },
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:title', content: route.title },
            { name: 'twitter:description', content: route.description },
            { name: 'twitter:image', content: PUBLIC_OG_IMAGE },
            { name: 'twitter:image:alt', content: 'Data Explorer SQL and NoSQL web workspace' },
        ],
        links: [
            { rel: 'canonical', href: route.canonical },
            { rel: 'alternate', hreflang: 'vi', href: `${PUBLIC_SITE_URL}${publicPath('vi', route.basePath) === '/' ? '' : publicPath('vi', route.basePath)}` },
            { rel: 'alternate', hreflang: 'en', href: `${PUBLIC_SITE_URL}${publicPath('en', route.basePath)}` },
            { rel: 'alternate', hreflang: 'x-default', href: `${PUBLIC_SITE_URL}${route.basePath === '/' ? '' : route.basePath}` },
        ],
        structuredData: serializePublicData(publicStructuredData(route)),
    };
}
