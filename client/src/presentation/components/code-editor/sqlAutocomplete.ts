import type { languages, editor, Position, IRange } from 'monaco-editor';

export interface SchemaTable {
    name: string;
    schema?: string;
    columns?: SchemaColumn[];
}

export interface SchemaColumn {
    name: string;
    type: string;
    isPrimaryKey?: boolean;
}

export interface SchemaInfo {
    tables: SchemaTable[];
    schemas?: string[];
    databases?: string[];
}

const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN',
    'ON', 'AS', 'DISTINCT', 'ALL',
    'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'NEXT', 'ROWS', 'ONLY',
    'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
    'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ILIKE', 'BETWEEN', 'EXISTS', 'IS NULL', 'IS NOT NULL',
    'ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST',
    'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME',
    'TABLE', 'VIEW', 'INDEX', 'DATABASE', 'SCHEMA', 'SEQUENCE', 'TRIGGER', 'FUNCTION', 'PROCEDURE',
    'COLUMN', 'CONSTRAINT', 'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK', 'DEFAULT',
    'ADD', 'MODIFY', 'CASCADE', 'RESTRICT', 'REFERENCES',
    'IF EXISTS', 'IF NOT EXISTS',
    'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL',
    'VARCHAR', 'CHAR', 'TEXT', 'BOOLEAN', 'BOOL',
    'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'DOUBLE PRECISION',
    'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'INTERVAL',
    'JSON', 'JSONB', 'UUID', 'BYTEA', 'BLOB',
    'ARRAY',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    'COALESCE', 'NULLIF', 'CAST', 'CONVERT',
    'UPPER', 'LOWER', 'TRIM', 'SUBSTRING', 'CONCAT', 'LENGTH', 'REPLACE',
    'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME', 'EXTRACT',
    'ROUND', 'FLOOR', 'CEIL', 'ABS', 'MOD',
    'STRING_AGG', 'ARRAY_AGG', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD',
    'OVER', 'PARTITION BY', 'WINDOW',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'WITH', 'RECURSIVE',
    'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
    'EXPLAIN', 'ANALYZE', 'VACUUM', 'GRANT', 'REVOKE',
    'RETURNING', 'ON CONFLICT', 'DO NOTHING', 'DO UPDATE',
    'NOT NULL', 'NULL',
    'TRUE', 'FALSE',
];

function getWordBeforeCursor(model: editor.ITextModel, position: Position): { word: string; range: IRange } {
    const lineContent = model.getLineContent(position.lineNumber);
    const textBeforeCursor = lineContent.substring(0, position.column - 1);
    const match = textBeforeCursor.match(/[\w.]*$/);
    const word = match ? match[0] : '';
    const startCol = position.column - word.length;

    return {
        word,
        range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: startCol,
            endColumn: position.column,
        },
    };
}

function getTextBeforeCursor(model: editor.ITextModel, position: Position): string {
    const lines: string[] = [];
    for (let i = 1; i <= position.lineNumber; i++) {
        lines.push(
            i === position.lineNumber
                ? model.getLineContent(i).substring(0, position.column - 1)
                : model.getLineContent(i),
        );
    }
    return lines.join(' ');
}

function extractReferencedTables(textBefore: string): string[] {
    const tables: string[] = [];
    const patterns = [
        /(?:FROM|JOIN)\s+["'`[]?(\w+)["'`\]]?/gi,
        /(?:UPDATE)\s+["'`[]?(\w+)["'`\]]?/gi,
        /(?:INSERT\s+INTO)\s+["'`[]?(\w+)["'`\]]?/gi,
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(textBefore)) !== null) {
            tables.push(match[1].toLowerCase());
        }
    }

    return [...new Set(tables)];
}

type CompletionContext = 'keyword' | 'table' | 'column' | 'schema' | 'general';

function detectContext(textBefore: string): CompletionContext {
    if (/(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+\w*$/i.test(textBefore.trim())) {
        return 'table';
    }

    if (/\w+\.\w*$/i.test(textBefore.trim())) {
        return 'column';
    }

    if (/(?:SELECT|WHERE|AND|OR|ON|SET|BY|HAVING)\s+\w*$/i.test(textBefore.trim())) {
        return 'column';
    }

    if (/(?:SELECT)\s/i.test(textBefore) && !/(?:FROM)\s/i.test(textBefore)) {
        return 'column';
    }

    return 'general';
}

export function createSqlCompletionProvider(
    schemaInfo: SchemaInfo,
    monacoInstance: typeof import('monaco-editor'),
): languages.CompletionItemProvider {
    return {
        triggerCharacters: ['.', ' '],

        provideCompletionItems(model, position) {
            const { word, range } = getWordBeforeCursor(model, position);
            const textBefore = getTextBeforeCursor(model, position);
            const context = detectContext(textBefore);
            const suggestions: languages.CompletionItem[] = [];
            const CompletionItemKind = monacoInstance.languages.CompletionItemKind;

            if (word.includes('.')) {
                const parts = word.split('.');
                const tableName = parts[0].toLowerCase();
                const columnPrefix = parts[1]?.toLowerCase() || '';
                const table = schemaInfo.tables.find(
                    t => t.name.toLowerCase() === tableName,
                );

                if (table?.columns) {
                    for (const col of table.columns) {
                        if (!columnPrefix || col.name.toLowerCase().startsWith(columnPrefix)) {
                            suggestions.push({
                                label: col.name,
                                kind: CompletionItemKind.Field,
                                detail: `${col.type}${col.isPrimaryKey ? ' PK' : ''}`,
                                insertText: col.name,
                                range,
                                sortText: '0' + col.name,
                            });
                        }
                    }
                }

                if (suggestions.length > 0) {
                    return { suggestions };
                }
            }

            const lowerWord = word.toLowerCase();

            if (context !== 'table') {
                for (const kw of SQL_KEYWORDS) {
                    if (!lowerWord || kw.toLowerCase().startsWith(lowerWord)) {
                        suggestions.push({
                            label: kw,
                            kind: CompletionItemKind.Keyword,
                            detail: 'SQL Keyword',
                            insertText: kw,
                            range,
                            sortText: '2' + kw,
                        });
                    }
                }
            }

            if (context === 'table' || context === 'column' || context === 'general') {
                for (const table of schemaInfo.tables) {
                    if (!lowerWord || table.name.toLowerCase().startsWith(lowerWord)) {
                        const colCount = table.columns?.length || 0;
                        suggestions.push({
                            label: table.name,
                            kind: CompletionItemKind.Struct,
                            detail: `Table${colCount ? ` (${colCount} columns)` : ''}`,
                            documentation: table.columns
                                ? table.columns.map(c => `${c.isPrimaryKey ? 'PK ' : ''}${c.name}: ${c.type}`).join('\n')
                                : undefined,
                            insertText: table.name,
                            range,
                            sortText: '1' + table.name,
                        });
                    }
                }
            }

            if (context === 'column' || context === 'general') {
                const refTables = extractReferencedTables(textBefore);

                for (const refName of refTables) {
                    const table = schemaInfo.tables.find(
                        t => t.name.toLowerCase() === refName,
                    );
                    if (table?.columns) {
                        for (const col of table.columns) {
                            if (!lowerWord || col.name.toLowerCase().startsWith(lowerWord)) {
                                const isDuplicate = suggestions.find(
                                    s => s.label === col.name && s.kind === CompletionItemKind.Field,
                                );
                                if (!isDuplicate) {
                                    suggestions.push({
                                        label: col.name,
                                        kind: CompletionItemKind.Field,
                                        detail: `${col.type} (${table.name})${col.isPrimaryKey ? ' PK' : ''}`,
                                        insertText: col.name,
                                        range,
                                        sortText: '0' + col.name,
                                    });
                                }
                            }
                        }
                    }
                }
            }

            if (schemaInfo.schemas && (context === 'table' || context === 'general')) {
                for (const schema of schemaInfo.schemas) {
                    if (!lowerWord || schema.toLowerCase().startsWith(lowerWord)) {
                        suggestions.push({
                            label: schema,
                            kind: CompletionItemKind.Module,
                            detail: 'Schema',
                            insertText: schema,
                            range,
                            sortText: '1' + schema,
                        });
                    }
                }
            }

            if (schemaInfo.databases && context === 'general') {
                for (const db of schemaInfo.databases) {
                    if (!lowerWord || db.toLowerCase().startsWith(lowerWord)) {
                        suggestions.push({
                            label: db,
                            kind: CompletionItemKind.Class,
                            detail: 'Database',
                            insertText: db,
                            range,
                            sortText: '3' + db,
                        });
                    }
                }
            }

            return { suggestions };
        },
    };
}
