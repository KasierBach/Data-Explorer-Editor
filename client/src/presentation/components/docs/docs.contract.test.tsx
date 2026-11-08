/// <reference types="node" />
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { DOCS_TOPICS } from '@/core/docs/docsCatalog';
import { DOCS_FACT_SOURCES } from '@/core/docs/docsFacts';
import { publicPath, resolvePublicRoute } from '@/core/seo/publicRoutes';
import { DOC_RENDERERS, DocContent } from './DocContent';
import { PublicNavigationContext } from '@/presentation/public/PublicNavigationContext';
import { PublicExperienceContext } from '@/presentation/public/PublicExperienceContext';

const root = path.resolve(process.cwd(), '..');
const newIds = ['first-query', 'sqlite', 'clickhouse', 'database-capabilities', 'operational-limits', 'data-migration', 'data-handling'];
function renderTopic(id: string, lang: 'vi' | 'en') {
  const wrapper = document.createElement('div');
  const route = resolvePublicRoute(publicPath(lang, `/docs/${id}`))!;
  wrapper.innerHTML = renderToStaticMarkup(<PublicNavigationContext.Provider value={route}><PublicExperienceContext.Provider value={{ lang, paused: true }}><DocContent sectionId={id} lang={lang} /></PublicExperienceContext.Provider></PublicNavigationContext.Provider>);
  return wrapper;
}
function codeLines(page: HTMLElement) {
  return Array.from(page.querySelectorAll('.doc-code-lines > p')).filter(line => !/^#\s/.test(line.textContent ?? '')).map(line => (line.textContent ?? '').trim());
}
function normalizeLink(href: string) {
  const url = new URL(href, 'https://data-explorer-editor.vercel.app');
  return { path: url.pathname, hash: url.hash, origin: url.origin };
}

describe('bilingual docs renderer contract', () => {
  it('maps every catalog ID exhaustively with no missing or extra renderer', () => {
    expect(Object.keys(DOC_RENDERERS).sort()).toEqual(DOCS_TOPICS.map(topic => topic.id).sort());
    expect(new Set(Object.keys(DOC_RENDERERS)).size).toBe(43);
  });

  it.each(DOCS_TOPICS.flatMap(topic => (['vi', 'en'] as const).map(lang => ({ id: topic.id, lang }))))('renders $id in $lang as one real H1 and meaningful content', ({ id, lang }) => {
    const page = renderTopic(id, lang);
    expect(page.querySelector('[data-doc-topic]')).toHaveAttribute('data-doc-topic', id);
    expect(page.querySelector('[data-doc-lang]')).toHaveAttribute('data-doc-lang', lang);
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.querySelector('h1')!.textContent!.trim().length).toBeGreaterThan(3);
    if (id === 'faq') {
      const questions = page.querySelectorAll('details > summary');
      expect(questions.length).toBeGreaterThan(0);
      for (const question of questions) expect(question.textContent!.trim().length).toBeGreaterThan(5);
    } else {
      expect(page.querySelectorAll('h2,h3').length).toBeGreaterThan(0);
    }
    if (newIds.includes(id)) expect(page.querySelectorAll('h2').length).toBeGreaterThan(0);
    expect(page.textContent!.length).toBeGreaterThan(350);
    expect(page.textContent).not.toMatch(/Coming Soon|Đang cập nhật|There is no mapped content|Phần này chưa có nội dung/);
    for (const heading of page.querySelectorAll('h1,h2,h3')) expect(heading.textContent!.trim()).not.toBe('');
    for (const anchor of page.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = anchor.getAttribute('href')!;
      if (/^(?:mailto:|tel:|#)/.test(href)) continue;
      const link = normalizeLink(href);
      if (link.origin !== 'https://data-explorer-editor.vercel.app') continue;
      if (/^\/(?:en\/)?docs(?:\/|$)/.test(link.path)) {
        const route = resolvePublicRoute(link.path);
        expect(route, `${id}:${lang} → ${href}`).not.toBeNull();
        expect(route!.lang, `${id}:${lang} → ${href}`).toBe(lang);
      }
    }
  });

  it.each(DOCS_TOPICS)('keeps code and callout coverage paired for $id', topic => {
    const vi = renderTopic(topic.id, 'vi'); const en = renderTopic(topic.id, 'en');
    expect(vi.querySelectorAll('h2').length).toBe(en.querySelectorAll('h2').length);
    expect(vi.querySelectorAll('.doc-code-block').length).toBe(en.querySelectorAll('.doc-code-block').length);
    expect(vi.querySelectorAll('.border-l-4').length).toBe(en.querySelectorAll('.border-l-4').length);
    expect(vi.textContent).not.toBe(en.textContent);
    if (newIds.includes(topic.id)) {
      expect(vi.querySelector('h1')!.textContent).not.toBe(en.querySelector('h1')!.textContent);
      expect(vi.querySelectorAll('.doc-code-block').length).toBeGreaterThan(0);
      expect(vi.querySelectorAll('.border-l-4').length).toBeGreaterThan(0);
      expect(codeLines(vi)).toEqual(codeLines(en));
      expect(vi.querySelectorAll('[data-doc-facts]').length).toBeGreaterThan(0);
    }
  });

  it('uses localized, registered links on every new page', () => {
    for (const id of newIds) for (const lang of ['vi', 'en'] as const) {
      const page = renderTopic(id, lang);
      const internal = Array.from(page.querySelectorAll<HTMLAnchorElement>('a[href]')).map(anchor => anchor.getAttribute('href')!).filter(href => href.startsWith('/'));
      expect(internal.length).toBeGreaterThan(0);
      for (const href of internal) {
        const route = resolvePublicRoute(normalizeLink(href).path);
        expect(route, `${id}:${lang} → ${href}`).not.toBeNull();
        expect(href).toBe(publicPath(lang, route!.basePath));
      }
    }
  });

  it('checks executable Redis examples rather than banning warning vocabulary', () => {
    for (const lang of ['vi', 'en'] as const) {
      const limits = renderTopic('operational-limits', lang);
      const examples = codeLines(limits).filter(line => /^(?:PING|SCAN|GET|MGET|KEYS|EVAL|FLUSH|SET|DEL|CONFIG|SCRIPT)\b/i.test(line));
      expect(examples).toContain('PING');
      expect(examples).toContain('SCAN 0 MATCH app:* COUNT 100');
      expect(examples.join('\n')).not.toMatch(/^(?:KEYS\s+\*|EVAL(?:_RO)?\s|FLUSHALL|FLUSHDB|SCRIPT|CONFIG|SET|DEL)\b/im);
      const redis = renderTopic('redis', lang);
      const lines = codeLines(redis);
      expect(lines.join('\n')).not.toMatch(/^(?:KEYS\s+\*|EVAL(?:_RO)?\s|FLUSHALL|FLUSHDB|SCRIPT)\b/im);
    }
  });

  it('keeps setup snippets free of fixed invalid encryption/refresh secrets', () => {
    for (const lang of ['vi', 'en'] as const) for (const id of ['installation', 'env-vars', 'deployment']) {
      const code = codeLines(renderTopic(id, lang)).join('\n');
      expect(code).not.toMatch(/(?:ENCRYPTION_KEY|JWT_REFRESH_SECRET)\s*=\s*(?:secret123|your-secret-key|change-me|super-secret-key)\b/i);
      expect(code).not.toMatch(/ENCRYPTION_KEY\s*=\s*[a-z0-9]{1,31}(?:\r?\n|$)/i);
    }
  });

  it('reuses the live assistant-model catalog without pulling server runtimes into docs', () => {
    const relative = 'client/src/presentation/components/docs/sections/DataHandlingSection.tsx';
    const file = ts.createSourceFile(relative, readFileSync(path.join(root, relative), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const imports = file.statements.filter(ts.isImportDeclaration).map(statement => (statement.moduleSpecifier as ts.StringLiteral).text);
    expect(imports).toContain('@/presentation/modules/Query/assistantModelCatalog');
    expect(file.text).toContain('getAssistantModelCatalog()');
    const models = ts.createSourceFile('models.ts', readFileSync(path.join(root, DOCS_FACT_SOURCES.aiModels), 'utf8'), ts.ScriptTarget.Latest, true);
    const importsModels = models.statements.filter(ts.isImportDeclaration).map(statement => (statement.moduleSpecifier as ts.StringLiteral).text);
    expect(importsModels.every(name => !/node:|server|@nestjs/.test(name))).toBe(true);
    const typeImport = models.statements.filter(ts.isImportDeclaration).find(statement => statement.importClause?.isTypeOnly);
    expect(typeImport?.getText()).toContain('CustomAiProvider');
  });
});
