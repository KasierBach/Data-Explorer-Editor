/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { DOCS_CATALOG, DOCS_TOPICS, getDocTopic } from './docsCatalog';

const root = path.resolve(process.cwd(), '..');
const legacyIds = ['introduction', 'ui-tour', 'installation', 'prerequisites', 'env-vars', 'postgres', 'mysql', 'mariadb', 'cockroach', 'mssql', 'mongodb', 'nosql-studio', 'aggregation-builder', 'nosql-insights', 'editor', 'tabs', 'results', 'export', 'ai-service', 'sql-generation', 'vision', 'explain', 'erd', 'charts', 'team-workspace', 'authentication', 'billing', 'architecture', 'tech-stack', 'redis', 'security', 'deployment', 'testing', 'clean-code', 'lifecycle', 'faq'];
const newIds = ['first-query', 'sqlite', 'clickhouse', 'database-capabilities', 'operational-limits', 'data-migration', 'data-handling'];

describe('pure public docs catalog', () => {
  it('preserves all legacy IDs/order and adds exactly the seven approved topics', () => {
    const ids = DOCS_TOPICS.map(topic => topic.id);
    expect(ids).toHaveLength(43);
    expect(new Set(ids).size).toBe(43);
    expect(ids.filter(id => !newIds.includes(id))).toEqual(legacyIds);
    expect(ids.filter(id => !legacyIds.includes(id)).sort()).toEqual([...newIds].sort());
    expect(new Set(DOCS_CATALOG.map(section => section.id)).size).toBe(DOCS_CATALOG.length);
  });

  it('supplies real bilingual metadata and exact editable section paths', () => {
    for (const section of DOCS_CATALOG) {
      expect(section.title.trim()).not.toBe('');
      expect(section.titleEn.trim()).not.toBe('');
      expect(section.items.length).toBeGreaterThan(0);
    }
    for (const topic of DOCS_TOPICS) {
      expect(topic.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(topic.title.trim()).not.toBe('');
      expect(topic.titleEn.trim()).not.toBe('');
      expect(topic.description.length).toBeGreaterThan(35);
      expect(topic.descriptionEn.length).toBeGreaterThan(35);
      expect(topic.description).not.toBe(topic.descriptionEn);
      expect(topic.updatedAt).toBe('2026-11-07');
      expect(topic.sourcePath).toMatch(/^client\/src\/presentation\/components\/docs\/sections\/[A-Z][A-Za-z]+Section\.tsx$/);
      expect(existsSync(path.join(root, topic.sourcePath)), topic.sourcePath).toBe(true);
      expect(getDocTopic(topic.id)).toBe(topic);
    }
    expect(getDocTopic('not-a-doc')).toBeUndefined();
    expect(getDocTopic('editor/subpage')).toBeUndefined();
  });

  it('keeps metadata independent of presentation, Node and server modules', () => {
    for (const relative of ['client/src/core/docs/docsCatalog.ts', 'client/src/core/docs/docsFacts.ts', 'client/src/core/productRelease.ts']) {
      const source = ts.createSourceFile(relative, readFileSync(path.join(root, relative), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const imports = source.statements.filter(ts.isImportDeclaration);
      expect(imports, relative).toHaveLength(0);
      expect(source.statements.some(ts.isExportDeclaration), relative).toBe(false);
      expect(source.text, relative).not.toMatch(/require\(|process\.|window\.|document\./);
    }
  });
});
