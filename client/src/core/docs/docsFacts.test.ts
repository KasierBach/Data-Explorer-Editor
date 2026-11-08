/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { DATABASE_CAPABILITIES, DOCS_FACTS, DOCS_FACT_SOURCES } from './docsFacts';

const root = path.resolve(process.cwd(), '..');
type SourceKey = keyof typeof DOCS_FACT_SOURCES;
const cache = new Map<SourceKey, ts.SourceFile>();
function source(key: SourceKey) {
  let file = cache.get(key);
  if (!file) {
    const relative = DOCS_FACT_SOURCES[key];
    file = ts.createSourceFile(relative, readFileSync(path.join(root, relative), 'utf8'), ts.ScriptTarget.Latest, true, relative.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    cache.set(key, file);
  }
  return file;
}
function nodes<T extends ts.Node>(key: SourceKey, predicate: (node: ts.Node) => node is T): T[] {
  const result: T[] = [];
  const visit = (node: ts.Node) => { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); };
  visit(source(key));
  return result;
}
function one<T>(values: T[], label: string): T {
  expect(values, `Source binding must resolve uniquely: ${label}`).toHaveLength(1);
  return values[0];
}
function unwrap(node: ts.Expression): ts.Expression {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) return unwrap(node.expression);
  return node;
}
/** Literal arithmetic only. No eval/transpilation/import of decorators, Nest or drivers. */
function literal(node: ts.Expression): unknown {
  const value = unwrap(node);
  if (ts.isNumericLiteral(value)) return Number(value.text.replaceAll('_', ''));
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(value)) return value.elements.map(element => literal(element as ts.Expression));
  if (ts.isObjectLiteralExpression(value)) return Object.fromEntries(value.properties.filter(ts.isPropertyAssignment).map(property => [property.name.getText().replace(/^['"]|['"]$/g, ''), literal(property.initializer)]));
  if (ts.isNewExpression(value) && value.arguments?.length === 1 && ['Set', 'Map'].includes(value.expression.getText())) return literal(value.arguments[0]);
  if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.AsteriskToken) {
    const left = literal(value.left); const right = literal(value.right);
    if (typeof left === 'number' && typeof right === 'number') return left * right;
  }
  throw new Error(`Unsupported literal source expression: ${value.getText()}`);
}
function binding(key: SourceKey, name: string) {
  const declarations = nodes(key, (node): node is ts.VariableDeclaration | ts.PropertyDeclaration => (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) && node.name.getText() === name);
  const declaration = one(declarations, `${key}.${name}`);
  expect(declaration.initializer, `${key}.${name} initializer`).toBeDefined();
  return literal(declaration.initializer!);
}
function method(key: SourceKey, name: string) {
  return one(nodes(key, (node): node is ts.MethodDeclaration | ts.FunctionDeclaration => (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name?.getText() === name), `${key}.${name}`).getText();
}
function property(key: SourceKey, className: string, name: string) {
  const declaration = one(nodes(key, (node): node is ts.ClassDeclaration => ts.isClassDeclaration(node) && node.name?.text === className), `${key}.${className}`);
  return one(declaration.members.filter((node): node is ts.PropertyDeclaration => ts.isPropertyDeclaration(node) && node.name.getText() === name), `${className}.${name}`);
}
function decoratorArgument(key: SourceKey, className: string, name: string, decorator: string) {
  const target = property(key, className, name);
  const decorators = ts.getDecorators(target) ?? [];
  const call = one(decorators.map(item => item.expression).filter((expression): expression is ts.CallExpression => ts.isCallExpression(expression) && expression.expression.getText() === decorator), `${className}.${name}@${decorator}`);
  return literal(call.arguments[0]);
}
function stringArrayInMethod(key: SourceKey, name: string, expectedMember: string) {
  const text = method(key, name);
  const file = ts.createSourceFile('method.ts', `class Contract { ${text} }`, ts.ScriptTarget.Latest, true);
  const arrays: string[][] = [];
  const visit = (node: ts.Node) => {
    if (ts.isArrayLiteralExpression(node) && node.elements.every(ts.isStringLiteral)) arrays.push(node.elements.map(element => (element as ts.StringLiteral).text));
    ts.forEachChild(node, visit);
  };
  visit(file);
  return one(arrays.filter(items => items.includes(expectedMember)), `${name} array with ${expectedMember}`);
}
function arrayProperty(key: SourceKey, name: string, field: string) {
  const declaration = one(nodes(key, (node): node is ts.VariableDeclaration => ts.isVariableDeclaration(node) && node.name.getText() === name), `${key}.${name}`);
  const array = unwrap(declaration.initializer!) as ts.ArrayLiteralExpression;
  expect(ts.isArrayLiteralExpression(array), `${key}.${name} array`).toBe(true);
  return array.elements.map(element => {
    const object = unwrap(element as ts.Expression) as ts.ObjectLiteralExpression;
    const member = one(object.properties.filter((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText() === field), `${name}.${field}`);
    return literal(member.initializer);
  });
}
function numberProperty(key: SourceKey, name: string) {
  return nodes(key, (node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText() === name && ts.isNumericLiteral(unwrap(node.initializer))).map(node => literal(node.initializer));
}

// These tests compare docs to actual source bindings and enforcement shapes, not to other docs values.
describe('source-backed documentation facts', () => {
  it('points to real repository source files', () => {
    for (const relative of Object.values(DOCS_FACT_SOURCES)) expect(existsSync(path.join(root, relative)), relative).toBe(true);
  });

  it('matches the exact factory registrations, aliases and UI-routing gaps', () => {
    const registration = one(nodes('strategies', (node): node is ts.BinaryExpression => ts.isBinaryExpression(node) && node.left.getText() === 'this.strategies'), 'factory registration');
    const map = unwrap(registration.right) as ts.NewExpression;
    const pairs = map.arguments![0] as ts.ArrayLiteralExpression;
    const actual = pairs.elements.map(element => {
      const pair = element as ts.ArrayLiteralExpression;
      return [literal(pair.elements[0] as ts.Expression), pair.elements[1].getText()];
    });
    expect(actual).toEqual(DATABASE_CAPABILITIES.map(engine => [engine.type, engine.strategy]));
    const dtoTypes = decoratorArgument('connectionTypes', 'CreateConnectionDto', 'type', 'IsIn') as string[];
    expect(dtoTypes.filter(type => type !== 'mock').sort()).toEqual(DATABASE_CAPABILITIES.map(engine => engine.type).sort());
    const sqlTypes = binding('selector', 'SQL_TYPES') as string[];
    const noSqlTypes = binding('selector', 'NOSQL_TYPES') as string[];
    expect(sqlTypes).toEqual(DATABASE_CAPABILITIES.filter(engine => engine.selector === 'sql').map(engine => engine.type));
    expect(noSqlTypes).toEqual(DATABASE_CAPABILITIES.filter(engine => engine.selector === 'nosql').map(engine => engine.type));
    expect(sqlTypes).not.toContain('sqlite');
    expect(source('connectionDialog').text).toMatch(/value:\s*'sqlite'/);
    const mongoGate = one(nodes('noSqlWorkspace', (node): node is ts.VariableDeclaration => ts.isVariableDeclaration(node) && node.name.getText() === 'isNoSql'), 'NoSqlMainContent.isNoSql').initializer!.getText();
    expect(mongoGate).toContain("'mongodb'");
    expect(mongoGate).toContain("'mongodb+srv'");
    expect(mongoGate).not.toContain("'redis'");
  });

  it('matches SQL DTOs, private service bounds and statement limits', () => {
    const sql = DOCS_FACTS.sql;
    expect(decoratorArgument('sqlQueryDto', 'CreateQueryDto', 'sql', 'MaxLength')).toBe(sql.maxCharacters);
    expect(decoratorArgument('sqlQueryDto', 'CreateQueryDto', 'limit', 'Max')).toBe(sql.rawResultRows);
    expect(binding('sqlGuard', 'MAX_SQL_STATEMENTS')).toBe(sql.maxStatements);
    expect(binding('queryService', 'DEFAULT_QUERY_LIMIT')).toBe(sql.rawResultRows);
    expect(binding('queryService', 'DEFAULT_TABLE_WINDOW_LIMIT')).toBe(sql.tablePageDefault);
    expect(binding('queryService', 'MAX_TABLE_WINDOW_LIMIT')).toBe(sql.tablePageMax);
    expect(binding('queryService', 'MAX_ACTIVE_PER_USER')).toBe(sql.concurrentPerUser);
    const timeout = method('queryService', 'getQueryTimeoutMs');
    expect(timeout).toMatch(new RegExp(`QUERY_TIMEOUT_MS\\s*\\|\\|\\s*${sql.timeoutDefaultMs.toLocaleString('en-US').replaceAll(',', '_')}`));
    expect(timeout).toContain(`Math.min(raw, ${sql.timeoutMaxMs.toLocaleString('en-US').replaceAll(',', '_')})`);
    expect(method('queryService', 'registerActiveQuery')).toContain('userActive.length >= this.MAX_ACTIVE_PER_USER');
    expect(method('queryService', 'withQueryTimeout')).toContain('entry');
    expect(method('queryService', 'withQueryTimeout')).toContain('.cancel()');
  });

  it('matches verified row-update/delete allowlists and cancellation availability', () => {
    const rowTypes = stringArrayInMethod('queryService', 'prepareRowMutation', 'sqlite');
    expect(rowTypes).toEqual(DOCS_FACTS.sql.rowUpdateDeleteTypes);
    const clientLists = nodes('rowEditing', ts.isArrayLiteralExpression).filter(node => node.elements.every(ts.isStringLiteral)).map(node => node.elements.map(element => (element as ts.StringLiteral).text));
    expect(clientLists).toContainEqual([...rowTypes]);
    expect(method('queryService', 'prepareRowMutation')).toContain("!['main', 'public'].includes(target.schema)");
    for (const engine of DATABASE_CAPABILITIES) {
      const key = engine.type === 'cockroach' ? 'postgres' : engine.type === 'mariadb' ? 'mysql' : engine.type.startsWith('mongodb') ? 'mongo' : engine.type;
      const cancel = method(key as SourceKey, 'cancelActiveQuery');
      if (engine.cancellation === 'unavailable') expect(cancel, engine.type).toMatch(/return false;/);
      else { expect(cancel, engine.type).toMatch(/cancel|Cancel/); expect(cancel, engine.type).not.toMatch(/\{\s*(?:\/\/[^\n]*\n\s*)?return false;\s*\}$/); }
    }
    expect(method('clickhouse', 'runStatementsInTransaction')).toContain('for (const statement of statements)');
    expect(method('clickhouse', 'runStatementsInTransaction')).not.toMatch(/\bBEGIN\b|\bROLLBACK\b/);
    expect(method('sqlite', 'createPool')).toContain("connectionConfig.database || ':memory:'");
  });

  it('matches MongoDB sanitizer, result and sample/cache contracts', () => {
    const mongo = DOCS_FACTS.mongo;
    for (const [name, expected] of [['MAX_DEPTH', mongo.nestingDepth], ['MAX_ARRAY_LENGTH', mongo.arrayItems], ['MAX_OBJECT_KEYS', mongo.objectKeys], ['MAX_PIPELINE_STAGES', mongo.pipelineStages]] as const) expect(binding('mongoSanitizer', name)).toBe(expected);
    expect(binding('mongoSanitizer', 'allowedActions')).toEqual(mongo.actions);
    expect(binding('mongo', 'DEFAULT_RESULT_LIMIT')).toBe(mongo.findAggregateResultRows);
    const execution = method('mongo', 'executeQuery');
    expect(execution).toContain(`maxTimeMS: ${mongo.maxTimeMs}`);
    expect(execution.match(/\.maxTimeMS\(30000\)/g)).toHaveLength(2);
    expect(binding('mongoSampler', 'DEFAULT_SCHEMA_SAMPLE_SIZE')).toBe(mongo.schemaSampleDefault);
    expect(binding('mongoSampler', 'MAX_SCHEMA_SAMPLE_SIZE')).toBe(mongo.schemaSampleMax);
    expect(numberProperty('mongoSamplerUi', 'sampleSize')).toContain(mongo.schemaSampleDefault);
    const sample = method('mongoSampler', 'analyzeSchema');
    expect(sample).toContain('Object.keys(doc).forEach');
    expect(sample).toContain(`meta.sampleValues.length < ${mongo.sampleValuesPerField}`);
    expect(sample).toContain(`this.redisService.set(cacheKey, stats, ${mongo.schemaCacheSeconds})`);
    expect(sample).toContain('this.MAX_SCHEMA_SAMPLE_SIZE');
  });

  it('matches Redis work bounds and fixed EVAL_RO with no unsafe fallback', () => {
    const redis = DOCS_FACTS.redis;
    for (const [name, value] of [['MAX_SCAN_COUNT', redis.maxScanCount], ['MAX_COLLECTION_ITEMS', redis.maxCollectionItems], ['MAX_SCAN_ITERATIONS', redis.maxScanIterations], ['MAX_SCAN_WORK_KEYS', redis.maxScanWorkKeys], ['MAX_RESULT_BYTES', redis.resultSafetyBytes]] as const) expect(binding('redis', name)).toBe(value);
    const run = method('redis', 'runReadOnlyScript');
    expect(run).toContain('client.eval_ro(');
    expect(run).toContain(`Redis ${redis.minimumMajorVersion}+ ${redis.scriptCommand}`);
    expect(run).not.toMatch(/client\.eval\(/);
    expect(method('redis', 'scanKeys')).toContain('iterations >= MAX_SCAN_ITERATIONS || workKeys >= MAX_SCAN_WORK_KEYS');
    expect(method('redis', 'scanKeys')).toContain('keyBytes > MAX_RESULT_BYTES');
    expect(method('redis', 'scanKeys')).toContain("fromStart && cursor === '0'");
  });

  it('matches AI request budgets without inventing a global prompt or retention cap', () => {
    const ai = DOCS_FACTS.ai;
    const constants = binding('aiConstants', 'AI_CONSTANTS') as Record<string, number>;
    expect(constants.CHAT_HISTORY_MAX_MESSAGES).toBe(ai.historyMessages);
    expect(constants.CHAT_HISTORY_MAX_CHARACTERS).toBe(ai.historyCharacters);
    expect(binding('aiSchema', 'MAX_DETAILED_TABLES')).toBe(ai.detailedSchemaTables);
    expect(binding('aiSchema', 'MAX_SCHEMA_CONTEXT_CHARACTERS')).toBe(ai.schemaCharacters);
    expect(binding('aiAttachments', 'MAX_NATIVE_PDF_BYTES')).toBe(ai.nativePdfBytes);
    expect(property('aiDto', 'GenerateSqlDto', 'image').type?.getText()).toBe('string');
    expect(property('aiDto', 'GenerateSqlDto', 'document').type?.getText()).toBe('AiDocumentDto');
    expect(ai.imagesPerRequest).toBe(1); expect(ai.nativePdfsPerRequest).toBe(1);
    expect(source('aiAttachments').text).toContain('if (!imageData)');
    expect(source('aiAttachments').text).toContain("if (!document && att.mimeType === 'application/pdf' && att.rawData)");
    const textClips = nodes('aiAttachments', ts.isCallExpression).filter(call => ts.isPropertyAccessExpression(call.expression) && call.expression.getText() === 'text.slice').map(call => call.arguments.map(argument => literal(argument)));
    expect(textClips).toContainEqual([0, ai.extractedTextCharacters]);
    expect(source('requestBody').text).toContain("bodyParser.json({ limit: '10mb' })");
    expect(ai.bodyBytes).toBe(10 * 1024 * 1024);
  });

  it('matches visualizer, dashboard picker and independently enforced snapshot limits', () => {
    const viz = DOCS_FACTS.visualization;
    expect(arrayProperty('chartTypes', 'CHART_TYPES', 'id')).toEqual(viz.chartTypes);
    expect(binding('chartInput', 'MAX_CHART_ROWS')).toBe(viz.chartInputRows);
    expect(arrayProperty('dashboardTypes', 'CHART_OPTIONS', 'value')).toEqual(viz.dashboardTypes);
    expect(decoratorArgument('dashboardDto', 'AddDashboardWidgetDto', 'dataSnapshot', 'ArrayMaxSize')).toBe(viz.snapshotRows);
    expect(source('dashboardSnapshot').text).toContain(`.slice(0, ${viz.snapshotRows})`);
    expect(binding('dashboardService', 'MAX_DASHBOARD_SNAPSHOT_BYTES')).toBe(viz.snapshotBytes);
    expect(source('dashboardService').text).toMatch(/Buffer\.byteLength\([\s\S]*?MAX_DASHBOARD_SNAPSHOT_BYTES/);
  });

  it('matches the permissive TLS default and current engine/form differences', () => {
    const tls = DOCS_FACTS.tls;
    expect(method('networkTls', 'allowInsecureDatabaseTls')).toContain(`process.env.ALLOW_INSECURE_DATABASE_TLS !== '${tls.strictEnvironmentValue}'`);
    expect(tls.insecureAllowedUnlessExplicitlyFalse).toBe(true);
    expect(method('clickhouse', 'createPool')).toContain('!isLocalDatabaseHost(host) && !allowInsecureDatabaseTls()');
    expect(method('clickhouse', 'createPool')).toContain(`useSecureTransport ? ${tls.clickhouseHttpsPort} : ${tls.clickhouseHttpPort}`);
    expect(source('connectionDialog').text).toContain(`setPort('${tls.clickhouseFormPort}')`);
    expect(method('postgres', 'createPool')).toContain('rejectUnauthorized: !allowInsecureDatabaseTls()');
    expect(method('mysql', 'createPool')).toContain('connectionConfig.tls === false');
    expect(method('redis', 'createPool')).toContain('connectionConfig.tls');
    expect(source('connectionDialog').text).toMatch(/type === 'redis' \|\| type === 'mysql' \|\| type === 'mariadb'/);
    expect(source('connectionDialog').text).not.toMatch(/searchParams\.get\(['"](?:sslmode|tls|ssl|encrypt)['"]\)/i);
  });

  it('matches secret stripping, chat cascades and actual cleanup targets', () => {
    const handling = DOCS_FACTS.dataHandling;
    for (const field of handling.strippedConnectionFields) {
      expect(source('browserStore').text).toContain(`delete safeConnection.${field}`);
      expect(method('connections', 'sanitizeConnection')).toContain(field);
    }
    const partialize = one(nodes('browserStore', (node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText() === 'partialize'), 'store.partialize');
    const props: string[] = [];
    const visit = (node: ts.Node) => { if (ts.isPropertyAssignment(node)) props.push(node.name.getText()); ts.forEachChild(node, visit); };
    visit(partialize.initializer);
    expect(props).toContain('tabs');
    expect(props).not.toContain('queryHistory'); expect(props).not.toContain('nosqlResult'); expect(props).not.toContain('nosqlSchemaStats');
    expect(partialize.getText()).toMatch(/messages:\s*\[\]/);
    expect(method('aiPreferences', 'serializePreferences')).toMatch(/apiKey:\s*""/);
    expect(method('aiProviders', 'toPublic')).toContain('const { apiKey, ...metadata } = provider');
    const schema = readFileSync(path.join(root, DOCS_FACT_SOURCES.metastore), 'utf8');
    const chat = schema.match(/model AiChat \{([\s\S]*?)\n\}/)![1];
    const message = schema.match(/model AiMessage \{([\s\S]*?)\n\}/)![1];
    expect(chat).toMatch(/user\s+User\s+@relation\([^\n]+onDelete: Cascade/);
    expect(message).toMatch(/chat\s+AiChat\s+@relation\([^\n]+onDelete: Cascade/);
    expect(message).toMatch(/attachments\s+Json\?/);
    expect(method('chatStorage', 'deleteChat')).toContain('this.prisma.aiChat.delete');
    expect(method('userDeletion', 'deleteAccount')).toContain('this.prisma.user.delete');
    const cleanup = method('retention', 'runCleanup');
    expect(cleanup).toContain(`'AUDIT_RETENTION_DAYS', ${handling.auditRetentionDefaultDays}`);
    expect(cleanup).toMatch(new RegExp(`'PAYMENT_PAYLOAD_RETENTION_DAYS',\\s*${handling.paymentPayloadRetentionDefaultDays}`));
    expect(cleanup).toContain('auditDays === 0'); expect(cleanup).toContain('rawPayload: Prisma.DbNull');
    expect(cleanup).not.toMatch(/aiChat|aiMessage|attachment|backup/i);
    expect(handling.chatAutomaticExpiry).toBe(false); expect(handling.backupExpiryDefinedByApplication).toBe(false);
  });

  it('preserves evidence for export-policy and migration-replay caveats', () => {
    expect(source('resultExport').text).toContain('new Blob([csv]');
    expect(source('resultExport').text).not.toContain('allowImportExport');
    const gridControls = nodes('gridPolicy', ts.isJsxOpeningElement);
    const downloadControls = gridControls.filter(node => /onClick=\{\(\) => export(?:CSV|JSON|SQL)\(exportCtx\)\}/.test(node.getText()));
    expect(downloadControls).toHaveLength(6);
    for (const control of downloadControls) expect(control.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText() === 'disabled')).toBe(false);
    const importControls = gridControls.filter(node => node.getText().includes('setIsImportDialogOpen(true)'));
    expect(importControls.length).toBeGreaterThan(0);
    for (const control of importControls) expect(control.getText()).toContain('disabled={importExportDisabled}');
    const authorize = method('migration', 'authorizeMigrationEndpoints');
    expect(authorize).toContain('permission: Permission.READ'); expect(authorize).toContain('permission: Permission.WRITE');
    expect(method('connections', 'getMigrationConnection')).toContain('connection.allowImportExport === false');
    expect(method('connections', 'getMigrationConnection')).toContain('options.write && connection.readOnly');
    const retry = method('migrationRetry', 'isRetryableMigrationBatchError');
    expect(retry).toContain("detail?.code === 'EREQUEST' && detail.number === 8003");
    expect(retry).toContain("detail?.code === 'SQLITE_ERROR'");
    expect(retry).not.toMatch(/return[\s\S]*timeout|return[\s\S]*disconnect/i);
    expect(source('migration').text).toContain('attempts: 1');
    expect(source('migration').text).toContain('Inspect the target before starting another transfer.');
    expect(method('migration', 'reauthorizeMigrationContext')).toContain('assertMigrationEndpointUnchanged');
  });
});
