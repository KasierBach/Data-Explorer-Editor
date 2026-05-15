import type { languages, editor, Position, IRange } from 'monaco-editor';

// ─── Schema info types ───

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

// ─── SQL Keywords ───

const SQL_KEYWORDS = [
    // DML
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN',
    'ON', 'AS', 'DISTINCT', 'ALL',
    // Clauses
    'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'NEXT', 'ROWS', 'ONLY',
    'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
    'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ILIKE', 'BETWEEN', 'EXISTS', 'IS NULL', 'IS NOT NULL',
    'ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST',
    // DDL
    'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME',
    'TABLE', 'VIEW', 'INDEX', 'DATABASE', 'SCHEMA', 'SEQUENCE', 'TRIGGER', 'FUNCTION', 'PROCEDURE',
    'COLUMN', 'CONSTRAINT', 'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK', 'DEFAULT',
    'ADD', 'MODIFY', 'CASCADE', 'RESTRICT', 'REFERENCES',
    'IF EXISTS', 'IF NOT EXISTS',
    // Data types
    'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL',
    'VARCHAR', 'CHAR', 'TEXT', 'BOOLEAN', 'BOOL',
    'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'DOUBLE PRECISION',
    'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'INTERVAL',
    'JSON', 'JSONB', 'UUID', 'BYTEA', 'BLOB',
    'ARRAY',
    // Aggregates & Functions
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    'COALESCE', 'NULLIF', 'CAST', 'CONVERT',
    'UPPER', 'LOWER', 'TRIM', 'SUBSTRING', 'CONCAT', 'LENGTH', 'REPLACE',
    'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME', 'EXTRACT',
    'ROUND', 'FLOOR', 'CEIL', 'ABS', 'MOD',
    'STRING_AGG', 'ARRAY_AGG', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD',
    'OVER', 'PARTITION BY', 'WINDOW',
    // Control
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'WITH', 'RECURSIVE',
    // Transaction
    'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
    // Other
    'EXPLAIN', 'ANALYZE', 'VACUUM', 'GRANT', 'REVOKE',
    'RETURNING', 'ON CONFLICT', 'DO NOTHING', 'DO UPDATE',
    'NOT NULL', 'NULL',
    'TRUE', 'FALSE',
];

// ─── Helper: get the word before cursor ───

function getWordBeforeCursor(model: editor.ITextModel, position: Position): { word: string; range: IRange } {
    const lineContent = model.getLineContent(position.lineNumber);
    const textBeforeCursor = lineContent.substring(0, position.column - 1);

    // Find the current "word" (including dots for schema.table)
    const match = textBeforeCursor.match(/[\w.]*$/);
    const word = match ? match[0] : '';

    const startCol = position.column - word.length;
    const range: IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: startCol,
        endColumn: position.column,
    };

    return { word, range };
}

// ─── Helper: get the full text before cursor ───

function getTextBeforeCursor(model: editor.ITextModel, position: Position): string {
    const lines: string[] = [];
    for (let i = 1; i <= position.lineNumber; i++) {
        if (i === position.lineNumber) {
            lines.push(model.getLineContent(i).substring(0, position.column - 1));
        } else {
            lines.push(model.getLineContent(i));
        }
    }
    return lines.join(' ');
}

function shouldShowAiGhostText(textBeforeCursor: string): boolean {
    const trimmed = textBeforeCursor.trimEnd();
    if (trimmed.length < 3) {
        return false;
    }

    const lastChar = textBeforeCursor.slice(-1);
    if (lastChar && /[A-Za-z0-9_]/.test(lastChar)) {
        return false;
    }

    return /[\s,([=<>:+\-*/]$/.test(lastChar) || lastChar === '';
}

// ─── Helper: extract table names from SQL text ───

function extractReferencedTables(textBefore: string): string[] {
    const tables: string[] = [];

    // Match FROM table, JOIN table patterns
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

// ─── Context detection ───

type CompletionContext = 'keyword' | 'table' | 'column' | 'schema' | 'general';

function detectContext(textBefore: string): CompletionContext {

    // After FROM, JOIN → suggest tables
    if (/(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+\w*$/i.test(textBefore.trim())) {
        return 'table';
    }

    // After schema. → suggest tables
    if (/\w+\.\w*$/i.test(textBefore.trim())) {
        return 'column'; // Could be schema.table or table.column
    }

    // After SELECT, WHERE, SET, ON, AND, OR, ORDER BY, GROUP BY → suggest columns
    if (/(?:SELECT|WHERE|AND|OR|ON|SET|BY|HAVING)\s+\w*$/i.test(textBefore.trim())) {
        return 'column';
    }

    // After SELECT ... (before FROM) → columns
    if (/(?:SELECT)\s/i.test(textBefore) && !/(?:FROM)\s/i.test(textBefore)) {
        return 'column';
    }

    return 'general';
}

// ─── Main: create completion provider ───

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

            // ─── Check if user typed "tableName." → suggest columns ───
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
                                detail: `${col.type}${col.isPrimaryKey ? ' 🔑 PK' : ''}`,
                                insertText: col.name,
                                range,
                                sortText: '0' + col.name, // Columns first
                            });
                        }
                    }
                }

                // If we found column suggestions, return them exclusively
                if (suggestions.length > 0) {
                    return { suggestions };
                }
            }

            const lowerWord = word.toLowerCase();

            // ─── SQL Keywords ───
            if (context !== 'table') {
                for (const kw of SQL_KEYWORDS) {
                    if (!lowerWord || kw.toLowerCase().startsWith(lowerWord)) {
                        suggestions.push({
                            label: kw,
                            kind: CompletionItemKind.Keyword,
                            detail: 'SQL Keyword',
                            insertText: kw,
                            range,
                            sortText: '2' + kw, // Keywords after tables/columns
                        });
                    }
                }
            }

            // ─── Table names ───
            if (context === 'table' || context === 'column' || context === 'general') {
                for (const table of schemaInfo.tables) {
                    if (!lowerWord || table.name.toLowerCase().startsWith(lowerWord)) {
                        const colCount = table.columns?.length || 0;
                        suggestions.push({
                            label: table.name,
                            kind: CompletionItemKind.Struct,
                            detail: `Table${colCount ? ` (${colCount} columns)` : ''}`,
                            documentation: table.columns
                                ? table.columns.map(c => `${c.isPrimaryKey ? '🔑 ' : ''}${c.name}: ${c.type}`).join('\n')
                                : undefined,
                            insertText: table.name,
                            range,
                            sortText: '1' + table.name, // Tables before keywords
                        });
                    }
                }
            }

            // ─── Column names (from all referenced tables) ───
            if (context === 'column' || context === 'general') {
                const refTables = extractReferencedTables(textBefore);

                for (const refName of refTables) {
                    const table = schemaInfo.tables.find(
                        t => t.name.toLowerCase() === refName,
                    );
                    if (table?.columns) {
                        for (const col of table.columns) {
                            if (!lowerWord || col.name.toLowerCase().startsWith(lowerWord)) {
                                // Avoid duplicates
                                if (!suggestions.find(s => s.label === col.name && s.kind === CompletionItemKind.Field)) {
                                    suggestions.push({
                                        label: col.name,
                                        kind: CompletionItemKind.Field,
                                        detail: `${col.type} (${table.name})${col.isPrimaryKey ? ' 🔑' : ''}`,
                                        insertText: col.name,
                                        range,
                                        sortText: '0' + col.name, // Columns first
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // ─── Schema names ───
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

            // ─── Database names ───
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

// ─── AI Inline Completion (Ghost Text) ───

let autocompleteTimeout: ReturnType<typeof setTimeout> | null = null;
let currentRequestId = 0;

export function createAiInlineCompletionProvider(
    activeConnectionId: string | null,
    activeDatabase: string | undefined,
    aiService: any,
): languages.InlineCompletionsProvider {
    return {
        provideInlineCompletions: async (model, position, _context, token) => {
            if (!activeConnectionId) return { items: [] };

            const lineContent = model.getLineContent(position.lineNumber);
            if (lineContent.trim().length < 3) return { items: [] };

            // Only suppress Ghost Text when cursor is RIGHT AFTER "keyword " (keyword + space)
            // This lets the standard popup show table/column names instead.
            // But if user is mid-typing (no trailing space), let everything work normally.
            const textBeforeCursor = lineContent.substring(0, position.column - 1);
            if (!shouldShowAiGhostText(textBeforeCursor)) {
                return { items: [] };
            }
            const endsWithSpace = textBeforeCursor.endsWith(' ');
            
            if (endsWithSpace) {
                const trimmed = textBeforeCursor.trimEnd().toUpperCase();
                const lastWord = trimmed.split(/\s+/).pop() || '';
                const popupKeywords = [
                    'SELECT', 'FROM', 'WHERE', 'JOIN', 'UPDATE', 'INSERT', 'INTO',
                    'SET', 'DELETE', 'ORDER', 'GROUP', 'AND', 'OR', 'ON', 'BY',
                    'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'HAVING', 'AS',
                    'TABLE', 'IN', 'VALUES', 'LIKE', 'BETWEEN', 'NOT', 'IS',
                ];
                if (popupKeywords.includes(lastWord)) {
                    return { items: [] };
                }
            }

            // 1. Clear the previous timeout if user is still typing
            if (autocompleteTimeout) {
                clearTimeout(autocompleteTimeout);
            }

            // Generate a unique ID for this request
            currentRequestId++;
            const requestId = currentRequestId;

            // 2. Wrap the API call in a Promise that resolves after a delay (Debounce)
            return new Promise<{ items: any[] }>((resolve) => {
                autocompleteTimeout = setTimeout(async () => {
                    // If this request is no longer the latest one or was cancelled, abort
                    if (requestId !== currentRequestId || token.isCancellationRequested) {
                        resolve({ items: [] });
                        return;
                    }

                    const beforeCursor = model.getValueInRange({
                        startLineNumber: 1,
                        startColumn: 1,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column,
                    });

                    const afterCursor = model.getValueInRange({
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: model.getLineCount(),
                        endColumn: model.getLineMaxColumn(model.getLineCount()),
                    });

                    console.log(`[AI Autocomplete] Requesting for: "${beforeCursor.slice(-50)}"`);

                    try {
                        const completion = await aiService.getAutocomplete({
                            connectionId: activeConnectionId,
                            database: activeDatabase,
                            beforeCursor,
                            afterCursor,
                        });

                        // Double check after await, to make sure it's still relevant
                        if (requestId !== currentRequestId || token.isCancellationRequested) {
                            resolve({ items: [] });
                            return;
                        }

                        if (!completion) {
                            console.log('[AI Autocomplete] No completion received from server.');
                            resolve({ items: [] });
                            return;
                        }

                        console.log(`[AI Autocomplete] Got prediction: "${completion}"`);

                        resolve({
                            items: [
                                {
                                    insertText: completion,
                                    range: {
                                        startLineNumber: position.lineNumber,
                                        startColumn: position.column,
                                        endLineNumber: position.lineNumber,
                                        endColumn: position.column,
                                    },
                                },
                            ],
                        });
                    } catch (err) {
                        console.error('[AI Autocomplete] Fetch error:', err);
                        resolve({ items: [] });
                    }
                }, 800); // 800ms delay — give popup time to appear first
            });
        },
        disposeInlineCompletions: () => {
            if (autocompleteTimeout) {
                clearTimeout(autocompleteTimeout);
            }
        },
    };
}
