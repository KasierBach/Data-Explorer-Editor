import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPage } from './prerender-public.mjs';

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
