import assert from 'node:assert/strict';
import test from 'node:test';
import { publicStylesFromManifest, renderPage, renderSitemap } from './prerender-public.mjs';

const source = '<html lang="en"><head><title>Old</title><meta name="description" content="Old" /><!-- public-head --></head><body><div id="root"></div></body></html>';
const route = { path: '/docs', lang: 'vi' };
const rendered = {
  html: '<main><h1>Tài liệu</h1><a href="/docs/editor">Trình soạn thảo</a></main>',
  tags: { title: 'Tài liệu', meta: [{ name: 'description', content: 'Hướng dẫn & thiết lập' }], links: [{ rel: 'canonical', href: 'https://data-explorer-editor.vercel.app/docs' }], structuredData: '{"@context":"https://schema.org","@type":"WebPage"}' },
};

test('renders visible real content and one set of route metadata', () => {
  const html = renderPage(source, route, rendered);
  assert.match(html, /<html lang="vi"/);
  assert.equal((html.match(/<title\b/g) ?? []).length, 1);
  assert.match(html, /<title data-public-seo>/);
  assert.equal((html.match(/name="description"/g) ?? []).length, 1);
  assert.match(html, /canonical.*\/docs/);
  assert.match(html, /data-public-rendered/);
  assert.match(html, /<main><h1>Tài liệu<\/h1><a href="\/docs\/editor"/);
  assert.match(html, /type="application\/ld\+json"/);
  assert.doesNotMatch(html, /data-static-content|hidden|seo-hydrate\.js/);
});

test('refuses missing rendered content instead of falling back to a shell', () => {
  assert.throws(() => renderPage(source, route, { ...rendered, html: '' }), /Missing rendered public content/);
  assert.throws(() => renderPage(source, route, { ...rendered, html: '<main data-static-content hidden></main>' }), /Missing rendered public content/);
});

test('escapes metadata attributes and titles', () => {
  const html = renderPage(source, route, { ...rendered, tags: { ...rendered.tags, title: '<title>', meta: [{ name: 'description', content: '"<>&' }] } });
  assert.match(html, /&lt;title&gt;/);
  assert.match(html, /&quot;&lt;&gt;&amp;/);
});

test('sitemap uses explicit docs review dates, never build time or a non-doc date', () => {
  const routes = [
    { kind: 'docs', canonical: 'https://example.com/docs/first-query', dateModified: '2026-11-07' },
    { kind: 'docs', canonical: 'https://example.com/en/docs/first-query', dateModified: '2026-11-07' },
    { kind: 'docs', canonical: 'https://example.com/docs/editor' },
    { kind: 'docs', canonical: 'https://example.com/docs/bad-date', dateModified: '<bad>' },
    { kind: 'landing', canonical: 'https://example.com', dateModified: '2026-11-07' },
    { kind: 'changelog', canonical: 'https://example.com/changelog', dateModified: '2026-09-02' },
    { kind: 'privacy', canonical: 'https://example.com/privacy' },
  ];
  const sitemap = renderSitemap(routes);
  assert.equal((sitemap.match(/<lastmod>/g) ?? []).length, 2);
  assert.equal((sitemap.match(/<lastmod>2026-11-07<\/lastmod>/g) ?? []).length, 2);
  assert.match(sitemap, /<loc>https:\/\/example.com\/docs\/first-query<\/loc><lastmod>2026-11-07/);
  assert.match(sitemap, /<loc>https:\/\/example.com\/en\/docs\/first-query<\/loc><lastmod>2026-11-07/);
  assert.doesNotMatch(sitemap, /2026-09-02|<bad>/);
  assert.match(sitemap, /<loc>https:\/\/example.com\/docs\/editor<\/loc><\/url>/);
  assert.match(sitemap, /<loc>https:\/\/example.com<\/loc><\/url>/);
  assert.equal(renderSitemap(routes), sitemap);
});

test('public styles follow static manifest imports rather than chunk filenames', () => {
  const manifest = {
    'src/presentation/public/PublicClient.tsx': { imports: ['_shared-client.js'], css: ['assets/client.css'], dynamicImports: ['editor'] },
    '_shared-client.js': { imports: ['_site-runtime.js'], css: ['assets/renamed-public.css'] },
    '_site-runtime.js': { imports: ['_shared-client.js'], css: ['assets/renamed-public.css'] },
    editor: { css: ['assets/vendor-monaco.css'] },
  };
  assert.deepEqual(publicStylesFromManifest(manifest), ['assets/renamed-public.css', 'assets/client.css']);
  assert.throws(() => publicStylesFromManifest({}), /Public client entry is missing/);
  assert.throws(() => publicStylesFromManifest({ 'src/presentation/public/PublicClient.tsx': { imports: ['missing'] } }), /Public dependency is missing/);
  assert.throws(() => publicStylesFromManifest({ 'src/presentation/public/PublicClient.tsx': {} }), /Public stylesheet is missing/);
});

test('sitemap escapes canonical URLs without adding a fallback lastmod', () => {
  const sitemap = renderSitemap([{ kind: 'docs', canonical: 'https://example.com/docs/a?x="<&' }]);
  assert.match(sitemap, /&quot;&lt;&amp;/);
  assert.doesNotMatch(sitemap, /<lastmod>/);
});
