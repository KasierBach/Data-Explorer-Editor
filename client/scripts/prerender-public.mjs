import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function escapeAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function renderPage(source, route, rendered) {
  if (!rendered?.html?.includes('<main') || rendered.html.includes('data-static-content')) {
    throw new Error(`Missing rendered public content for ${route.path}`);
  }
  const attributes = values => Object.entries(values).map(([name, value]) => `${name}="${escapeAttribute(value)}"`).join(' ');
  const head = [
    `<title data-public-seo>${escapeAttribute(rendered.tags.title)}</title>`,
    ...rendered.tags.meta.map(meta => `<meta ${attributes(meta)} data-public-seo />`),
    ...rendered.tags.links.map(link => `<link ${attributes(link)} data-public-seo />`),
    `<script type="application/ld+json" data-public-seo>${rendered.tags.structuredData}</script>`,
  ].join('\n  ');
  return source
    .replace(/<html\s+lang="[^"]*"/, `<html lang="${route.lang}"`)
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/g, '')
    .replace(/<meta\b[^>]*name="(?:description|robots|googlebot)"[^>]*>/g, '')
    .replace('<!-- public-head -->', head)
    .replace('<div id="root"></div>', `<div id="root" data-public-rendered data-public-path="${escapeAttribute(route.path)}">${rendered.html}</div>`);
}

export function renderSitemap(routes) {
  const entries = routes.map(route => {
    const date = route.kind === 'docs' && /^\d{4}-\d{2}-\d{2}$/.test(route.dateModified ?? '') ? route.dateModified : undefined;
    return `  <url><loc>${escapeAttribute(route.canonical)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

export function publicStylesFromManifest(manifest) {
  const entry = 'src/presentation/public/PublicClient.tsx';
  if (!manifest[entry]) throw new Error('Public client entry is missing from the build manifest');
  const visited = new Set();
  const styles = new Set();
  const visit = key => {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Public dependency is missing from the build manifest: ${key}`);
    for (const dependency of chunk.imports ?? []) visit(dependency);
    for (const css of chunk.css ?? []) styles.add(css);
  };
  visit(entry);
  if (!styles.size) throw new Error('Public stylesheet is missing from the build manifest');
  return [...styles];
}

export async function prerender(distDir) {
  const source = await readFile(path.join(distDir, 'index.html'), 'utf8');
  if (!source.includes('<!-- public-head -->') || !source.includes('<div id="root"></div>')) throw new Error('Public render template markers are missing');
  const manifest = JSON.parse(await readFile(path.join(distDir, '.vite/manifest.json'), 'utf8'));
  const publicStyles = publicStylesFromManifest(manifest);
  const styleTags = publicStyles.map(file => `<link rel="stylesheet" href="/${escapeAttribute(file)}" />`).join('\n');
  const publicSource = source.replace('</head>', `${styleTags}\n</head>`);
  const renderDir = path.join(root, 'node_modules/.cache/data-explorer-public-render');
  await build({
    configFile: false,
    root,
    envDir: false,
    publicDir: false,
    plugins: [react()],
    resolve: { alias: { '@': path.join(root, 'src') } },
    build: {
      ssr: path.join(root, 'src/entry-public-server.tsx'),
      outDir: renderDir,
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { entryFileNames: 'public-render.mjs' } },
    },
  });
  const renderer = await import(pathToFileURL(path.join(renderDir, 'public-render.mjs')).href);
  const routes = renderer.listPublicRoutes();
  await writeFile(path.join(distDir, 'app.html'), source.replace('<!-- public-head -->', ''));
  for (const route of routes) {
    const rendered = await renderer.renderPublicPage(route);
    const file = route.path === '/' ? 'index.html' : `${route.path.slice(1)}.html`;
    const target = path.join(distDir, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, renderPage(publicSource, route, rendered));
  }
  await writeFile(path.join(distDir, 'public-routes.json'), `${JSON.stringify(routes.map(route => ({ path: route.path, lang: route.lang, title: route.title, canonical: route.canonical, ...(route.kind === 'docs' && route.dateModified ? { dateModified: route.dateModified } : {}) })))}\n`);
  await writeFile(path.join(distDir, 'sitemap.xml'), renderSitemap(routes));
  console.log(`Rendered ${routes.length} public pages with visible content and metadata.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await prerender(path.join(root, 'dist'));
}
