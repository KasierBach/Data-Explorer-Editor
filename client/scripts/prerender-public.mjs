import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_PAGES = {
  '/': {
    title: 'Data Explorer - Multi-Engine Database IDE',
    description: 'A unified workspace for PostgreSQL, MySQL, SQL Server, and MongoDB with AI-assisted querying, schema exploration, ERD tools, and team-aware access controls.',
  },
  '/docs': {
    title: 'Documentation | Data Explorer',
    description: 'Install, configure, deploy, and operate Data Explorer with production-ready guidance.',
  },
  '/changelog': {
    title: 'Changelog | Data Explorer',
    description: 'Review the latest Data Explorer product improvements, fixes, and operational changes.',
  },
  '/legal': {
    title: 'Legal center | Data Explorer',
    description: 'Review the operating commitments, privacy rules, and product terms behind Data Explorer.',
  },
  '/privacy': {
    title: 'Privacy policy | Data Explorer',
    description: 'How Data Explorer collects, uses, retains, and protects account and workspace information.',
  },
  '/terms': {
    title: 'Terms of service | Data Explorer',
    description: 'The baseline rules for accessing, registering for, and using Data Explorer.',
  },
};

const SITE_URL = 'https://data-explorer-editor.vercel.app';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

function escapeAttribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

export function renderPage(source, route, metadata) {
  const canonical = `${SITE_URL}${route === '/' ? '' : route}`;
  const title = escapeAttribute(metadata.title);
  const description = escapeAttribute(metadata.description);
  const staticContent = [
    '<main data-static-content hidden>',
    `    <h1>${title}</h1>`,
    `    <p>${description}</p>`,
    '  </main>',
  ].join('\n  ');
  const socialTags = [
    `<link rel="canonical" href="${canonical}" data-static-seo />`,
    '<meta name="robots" content="index, follow" data-static-seo />',
    '<meta property="og:type" content="website" data-static-seo />',
    `<meta property="og:url" content="${canonical}" data-static-seo />`,
    `<meta property="og:title" content="${title}" data-static-seo />`,
    `<meta property="og:description" content="${description}" data-static-seo />`,
    `<meta property="og:image" content="${OG_IMAGE}" data-static-seo />`,
    '<meta name="twitter:card" content="summary_large_image" data-static-seo />',
    '<script src="/seo-hydrate.js"></script>',
  ].join('\n  ');

  return source
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(/<meta name="description"[\s\S]*?\/>/, `<meta name="description" content="${description}" />`)
    .replace('<!-- Dynamic meta tags are managed by react-helmet-async in SEO component -->', socialTags)
    .replace('<div id="root"></div>', `<div id="root">${staticContent}</div>`);
}

export async function prerender(distDir) {
  const source = await readFile(path.join(distDir, 'index.html'), 'utf8');
  for (const [route, metadata] of Object.entries(PUBLIC_PAGES)) {
    const outputDir = route === '/' ? distDir : path.join(distDir, route.slice(1));
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, 'index.html'), renderPage(source, route, metadata));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await prerender(path.resolve('dist'));
}
