import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Layers, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Textarea } from '@/presentation/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/presentation/components/ui/dialog';
import { cn } from '@/lib/utils';

interface SqlSequenceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lang: 'vi' | 'en';
    initialSql: string;
    canRun?: boolean;
    onApply: (sql: string) => void;
    onRun: (sql: string) => void;
}

interface SqlBlock {
    id: string;
    sql: string;
}

const createBlock = (sql = ''): SqlBlock => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sql,
});

const moveBlock = <T,>(items: T[], fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
        return items;
    }

    const next = [...items];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    return next;
};

function reorderBlocks(blocks: SqlBlock[], draggedId: string, targetId: string) {
    const fromIndex = blocks.findIndex((block) => block.id === draggedId);
    const toIndex = blocks.findIndex((block) => block.id === targetId);
    return moveBlock(blocks, fromIndex, toIndex);
}

function buildSqlFromBlocks(blocks: SqlBlock[]) {
    return blocks
        .map((block) => block.sql.trim())
        .filter(Boolean)
        .join(';\n\n');
}

// ponytail: keep the splitter local so the dialog can reopen multi-statement SQL
// without introducing a shared package just for semicolon parsing.
function splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let index = 0; index < sql.length; index += 1) {
        const char = sql[index];
        const next = sql[index + 1];

        if (inLineComment) {
            current += char;
            if (char === '\n') {
                inLineComment = false;
            }
            continue;
        }

        if (inBlockComment) {
            current += char;
            if (char === '*' && next === '/') {
                current += next;
                inBlockComment = false;
                index += 1;
            }
            continue;
        }

        if (!inDoubleQuote && char === '\'' && sql[index - 1] !== '\\') {
            inSingleQuote = !inSingleQuote;
            current += char;
            continue;
        }

        if (!inSingleQuote && char === '"' && sql[index - 1] !== '\\') {
            inDoubleQuote = !inDoubleQuote;
            current += char;
            continue;
        }

        if (!inSingleQuote && !inDoubleQuote && char === '-' && next === '-') {
            inLineComment = true;
            current += char;
            continue;
        }

        if (!inSingleQuote && !inDoubleQuote && char === '/' && next === '*') {
            inBlockComment = true;
            current += char;
            continue;
        }

        if (!inSingleQuote && !inDoubleQuote && char === ';') {
            const trimmed = current.trim();
            if (trimmed) {
                statements.push(trimmed);
            }
            current = '';
            continue;
        }

        current += char;
    }

    const finalStatement = current.trim();
    if (finalStatement) {
        statements.push(finalStatement);
    }

    return statements;
}

function buildBlocksFromSql(sql: string) {
    const statements = splitSqlStatements(sql);
    if (statements.length > 0) {
        return statements.map((statement) => createBlock(statement));
    }
    return [createBlock(sql.trim())];
}

export const SqlSequenceDialog: React.FC<SqlSequenceDialogProps> = ({
    open,
    onOpenChange,
    lang,
    initialSql,
    canRun = true,
    onApply,
    onRun,
}) => {
    const [blocks, setBlocks] = useState<SqlBlock[]>(() => buildBlocksFromSql(initialSql));
    const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
    const [dropTargetBlockId, setDropTargetBlockId] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setBlocks(buildBlocksFromSql(initialSql));
        setDraggingBlockId(null);
        setDropTargetBlockId(null);
    }, [initialSql, open]);

    const sequenceSql = useMemo(() => buildSqlFromBlocks(blocks), [blocks]);
    const blockCount = blocks.filter((block) => block.sql.trim()).length;

    const updateBlock = (blockId: string, sql: string) => {
        setBlocks((current) => current.map((block) => (
            block.id === blockId ? { ...block, sql } : block
        )));
    };

    const addBlock = () => {
        setBlocks((current) => [...current, createBlock('')]);
    };

    const removeBlock = (blockId: string) => {
        setBlocks((current) => {
            if (current.length === 1) {
                return [createBlock('')];
            }
            return current.filter((block) => block.id !== blockId);
        });
    };

    const nudgeBlock = (fromIndex: number, offset: number) => {
        setBlocks((current) => moveBlock(current, fromIndex, fromIndex + offset));
    };

    const handleApply = () => {
        if (!sequenceSql.trim()) return;
        onApply(sequenceSql);
        onOpenChange(false);
    };

    const handleRun = () => {
        if (!sequenceSql.trim()) return;
        onRun(sequenceSql);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[calc(100vw-1rem)] h-[85vh] max-h-[calc(100dvh-10rem)] overflow-hidden flex flex-col sm:top-[calc(50%+0.75rem)] sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        {lang === 'vi' ? 'Chuỗi SQL' : 'SQL Sequence'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {lang === 'vi'
                            ? 'Sắp xếp lại từng khối SQL và chạy tuần tự theo thứ tự bạn chọn.'
                            : 'Reorder SQL blocks and run them sequentially in the order you choose.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-xs text-muted-foreground">
                        {lang === 'vi'
                            ? 'Kéo từng khối để đổi thứ tự, hoặc dùng nút lên xuống.'
                            : 'Drag blocks to reorder, or use the up/down buttons.'}
                    </div>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={addBlock}>
                        <Plus className="w-3.5 h-3.5" />
                        {lang === 'vi' ? 'Thêm bước' : 'Add step'}
                    </Button>
                </div>

                <div className="flex-1 min-h-0 overflow-auto space-y-3 pr-1">
                    {blocks.map((block, index) => (
                        <div
                            key={block.id}
                            className={cn(
                                'rounded-xl border bg-muted/20 p-3 space-y-2 transition-colors',
                                dropTargetBlockId === block.id && 'border-blue-500/50 bg-blue-500/5'
                            )}
                            onDragOver={(event) => {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'move';
                                if (draggingBlockId && draggingBlockId !== block.id) {
                                    setDropTargetBlockId(block.id);
                                }
                            }}
                            onDragLeave={() => {
                                if (dropTargetBlockId === block.id) {
                                    setDropTargetBlockId(null);
                                }
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                if (!draggingBlockId || draggingBlockId === block.id) {
                                    setDropTargetBlockId(null);
                                    return;
                                }
                                setBlocks((current) => reorderBlocks(current, draggingBlockId, block.id));
                                setDraggingBlockId(null);
                                setDropTargetBlockId(null);
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    draggable
                                    className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-background/80 hover:text-foreground active:cursor-grabbing"
                                    onDragStart={(event) => {
                                        event.dataTransfer.effectAllowed = 'move';
                                        event.dataTransfer.setData('text/plain', block.id);
                                        setDraggingBlockId(block.id);
                                    }}
                                    onDragEnd={() => {
                                        setDraggingBlockId(null);
                                        setDropTargetBlockId(null);
                                    }}
                                    title={lang === 'vi' ? 'Kéo để đổi thứ tự' : 'Drag to reorder'}
                                >
                                    <GripVertical className="w-4 h-4" />
                                </button>

                                <div className="text-xs font-medium text-muted-foreground">
                                    {(lang === 'vi' ? 'Bước' : 'Step')} {index + 1}
                                </div>

                                <div className="ml-auto flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => nudgeBlock(index, -1)}
                                        disabled={index === 0}
                                        title={lang === 'vi' ? 'Đưa lên' : 'Move up'}
                                    >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => nudgeBlock(index, 1)}
                                        disabled={index === blocks.length - 1}
                                        title={lang === 'vi' ? 'Đưa xuống' : 'Move down'}
                                    >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-red-500 hover:text-red-600"
                                        onClick={() => removeBlock(block.id)}
                                        title={lang === 'vi' ? 'Xóa bước' : 'Delete step'}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <Textarea
                                value={block.sql}
                                onChange={(event) => updateBlock(block.id, event.target.value)}
                                placeholder={lang === 'vi' ? 'Nhập SQL cho bước này...' : 'Enter SQL for this step...'}
                                className="min-h-[140px] font-mono text-xs"
                                rows={6}
                            />
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between gap-2 border-t pt-3 flex-wrap">
                    <div className="text-xs text-muted-foreground">
                        {blockCount} {lang === 'vi' ? 'bước có nội dung' : 'non-empty steps'}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            {lang === 'vi' ? 'Đóng' : 'Close'}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleApply} disabled={!sequenceSql.trim()}>
                            {lang === 'vi' ? 'Áp vào editor' : 'Apply to editor'}
                        </Button>
                        <Button type="button" size="sm" className="gap-1.5" onClick={handleRun} disabled={!sequenceSql.trim() || !canRun}>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            {lang === 'vi' ? 'Chạy tuần tự' : 'Run sequence'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
