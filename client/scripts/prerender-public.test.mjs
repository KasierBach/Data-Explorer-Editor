import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPage } from './prerender-public.mjs';

test('renders route-specific crawl and social metadata', () => {
  const source = '<title>Old</title><meta name="description" content="Old" /><!-- Dynamic meta tags are managed by react-helmet-async in SEO component -->';
  const result = renderPage(source, '/docs', { title: 'Docs', description: 'Help' });
  assert.match(result, /<title>Docs<\/title>/);
  assert.match(result, /canonical.*\/docs/);
  assert.match(result, /og:title.*Docs/);
});
