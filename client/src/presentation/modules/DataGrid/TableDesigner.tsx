import React, { useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { RefreshCw, Plus, Trash2, Save, Link as LinkIcon, ArrowRightLeft } from 'lucide-react';
import type { TableMetadata, TableColumn } from '@/core/domain/entities';
import type { SchemaOperation } from '@/core/domain/database-adapter.interface';


interface TableDesignerProps {
    tableName: string;
    metadata: TableMetadata;
    onSave: (operations: SchemaOperation[]) => void;
    onCancel: () => void;
    isReadOnly?: boolean;
    schemaChangesAllowed?: boolean;
}

export const TableDesigner: React.FC<TableDesignerProps> = ({ tableName, metadata, onSave, onCancel, isReadOnly = false, schemaChangesAllowed = true }) => {
    const [columns, setColumns] = useState<TableColumn[]>([...metadata.columns]);
    const [relationships, setRelationships] = useState<{ id: string, source: string, targetTable: string, targetColumn: string }[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const isBlocked = isReadOnly || !schemaChangesAllowed;

    const handleAddColumn = () => {
        setColumns([...columns, {
            name: `column_${columns.length + 1}`,
            type: 'varchar(255)',
            isNullable: true,
            isPrimaryKey: false,
            isForeignKey: false
        }]);
    };

    const handleAddRelationship = () => {
        setRelationships([
            ...relationships,
            { id: Date.now().toString(), source: columns[0]?.name || '', targetTable: '', targetColumn: '' }
        ]);
    };

    const handleRemoveRelationship = (id: string) => {
        setRelationships(relationships.filter(r => r.id !== id));
    };

    const handleUpdateRelationship = (id: string, updates: any) => {
        setRelationships(relationships.map(r => r.id === id ? { ...r, ...updates } : r));
    };

    const handleRemoveColumn = (index: number) => {
        setColumns(columns.filter((_, i) => i !== index));
    };

    const handleUpdateColumn = (index: number, updates: Partial<TableColumn>) => {
        const newCols = [...columns];
        newCols[index] = { ...newCols[index], ...updates };
        setColumns(newCols);
    };

    const handleSave = async () => {
        if (isBlocked) return;
        setIsSaving(true);
        const operations: SchemaOperation[] = [];

        const currentNames = columns.map(c => c.name);
        metadata.columns.forEach(col => {
            if (!currentNames.includes(col.name)) {
                operations.push({ type: 'drop_column', name: col.name });
            }
        });

        columns.forEach(col => {
            const original = metadata.columns.find(c => c.name === col.name);
            if (!original) {
                operations.push({ type: 'add_column', name: col.name, dataType: col.type, isNullable: col.isNullable });
            } else {
                if (original.type !== col.type) {
                    operations.push({ type: 'alter_column_type', name: col.name, newType: col.type });
                }
                if (original.isPrimaryKey !== col.isPrimaryKey) {
                    if (col.isPrimaryKey) operations.push({ type: 'add_pk', columns: [col.name] });
                    else operations.push({ type: 'drop_pk' });
                }
            }
        });

        await onSave(operations);
        setIsSaving(false);
    };

    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden">
            {/* FIXED HEADER */}
            <div className="flex items-center justify-between p-4 border-b bg-card/50 backdrop-blur-xl z-30">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <RefreshCw className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Table Designer</h3>
                        <p className="text-base font-bold text-foreground">{tableName}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={onCancel} className="h-9 px-4 text-xs font-semibold hover:bg-muted/50 rounded-lg transition-all">
                        Cancel
                    </Button>
                    <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving || isBlocked} className="h-9 px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all rounded-lg">
                        {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            {/* SMOOTH SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/10 hover:scrollbar-thumb-muted-foreground/20">
                <div className="p-6 max-w-6xl mx-auto space-y-10 pb-32">
                    {isBlocked && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-[11px] text-amber-500/80 leading-relaxed shadow-sm flex items-center gap-3 animate-in fade-in duration-500">
                             <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                             {isReadOnly ? 'Read-only connection: Design is locked.' : 'Schema changes disabled for this connection.'}
                        </div>
                    )}

                    {/* COLUMNS SECTION */}
                    <div className="space-y-4">
                        <div className="flex items-end justify-between px-1">
                            <div>
                                <h4 className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest pl-1">Column Definitions</h4>
                                <div className="h-0.5 w-12 bg-blue-500/50 mt-1 rounded-full" />
                            </div>
                            <Button variant="outline" size="sm" onClick={handleAddColumn} disabled={isBlocked} className="h-8 text-[11px] font-bold gap-1.5 border-dashed border-2 hover:bg-blue-500/5 hover:border-blue-500/50 hover:text-blue-500 transition-all rounded-lg">
                                <Plus className="w-3.5 h-3.5" /> Add Column
                            </Button>
                        </div>

                        <div className="border rounded-2xl overflow-hidden bg-card/30 shadow-2xl shadow-black/5 ring-1 ring-white/5">
                            <table className="w-full text-xs text-left border-collapse table-fixed">
                                <thead className="bg-muted/80 backdrop-blur-md border-b sticky top-0 z-20">
                                    <tr>
                                        <th className="p-3.5 font-bold border-r border-border/50 w-12 text-center text-muted-foreground/40 font-mono">#</th>
                                        <th className="p-3.5 font-bold border-r border-border/50">Column Name</th>
                                        <th className="p-3.5 font-bold border-r border-border/50 w-48">Type</th>
                                        <th className="p-3.5 font-bold border-r border-border/50 w-24 text-center">Null</th>
                                        <th className="p-3.5 font-bold border-r border-border/50 w-24 text-center text-yellow-500/80">PK</th>
                                        <th className="p-3.5 font-bold w-12 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                    {columns.map((col, idx) => (
                                        <tr key={idx} className="hover:bg-blue-500/[0.04] transition-colors group">
                                            <td className="p-3.5 text-center text-muted-foreground/30 border-r border-border/40 font-mono text-[10px]">
                                                {idx + 1}
                                            </td>
                                            <td className="p-1 px-2 border-r border-border/40">
                                                <input
                                                    className="w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/40 rounded-lg px-2 py-1.5 h-8 font-medium placeholder:text-muted-foreground/20 transition-all"
                                                    value={col.name}
                                                    placeholder="e.g. user_email"
                                                    onChange={(e) => handleUpdateColumn(idx, { name: e.target.value })}
                                                    disabled={isBlocked}
                                                />
                                            </td>
                                            <td className="p-1 px-2 border-r border-border/40 text-center">
                                                <select
                                                    className="w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-500/40 rounded-lg px-2 py-1.5 h-8 cursor-pointer text-muted-foreground/80 font-mono"
                                                    value={col.type}
                                                    onChange={(e) => handleUpdateColumn(idx, { type: e.target.value })}
                                                    disabled={isBlocked}
                                                >
                                                    <option value="varchar(255)">VARCHAR(255)</option>
                                                    <option value="text">TEXT</option>
                                                    <option value="integer">INTEGER</option>
                                                    <option value="bigint">BIGINT</option>
                                                    <option value="boolean">BOOLEAN</option>
                                                    <option value="timestamp">TIMESTAMP</option>
                                                    <option value="decimal(10,2)">DECIMAL(10,2)</option>
                                                    <option value="jsonb">JSONB</option>
                                                </select>
                                            </td>
                                            <td className="text-center border-r border-border/40">
                                                <input
                                                    type="checkbox"
                                                    className="rounded-md border-muted-foreground/20 bg-transparent text-blue-600 focus:ring-blue-500/40 w-4 h-4 cursor-pointer transition-all"
                                                    checked={col.isNullable}
                                                    onChange={(e) => handleUpdateColumn(idx, { isNullable: e.target.checked })}
                                                    disabled={isBlocked}
                                                />
                                            </td>
                                            <td className="text-center border-r border-border/40">
                                                <input
                                                    type="checkbox"
                                                    className="rounded-md border-muted-foreground/20 bg-transparent text-yellow-600 focus:ring-yellow-500/40 w-4 h-4 cursor-pointer transition-all"
                                                    checked={col.isPrimaryKey}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked;
                                                        if (isChecked) {
                                                            setColumns(columns.map((c, i) => ({ ...c, isPrimaryKey: i === idx })));
                                                        } else {
                                                            handleUpdateColumn(idx, { isPrimaryKey: false });
                                                        }
                                                    }}
                                                    disabled={isBlocked}
                                                />
                                            </td>
                                            <td className="text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="sm" onClick={() => handleRemoveColumn(idx)} disabled={isBlocked} className="h-8 w-8 p-0 text-muted-foreground/30 hover:text-white hover:bg-destructive rounded-full transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* RELATIONSHIPS SECTION */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border/50 pb-2 ml-1">
                            <LinkIcon className="w-4 h-4 text-blue-400" />
                            <h4 className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">Relationships</h4>
                        </div>
                        
                        {relationships.length === 0 ? (
                            <div className="text-center p-12 border-2 border-dashed rounded-3xl bg-muted/5 group hover:bg-blue-500/[0.02] transition-all cursor-pointer border-border/30" onClick={handleAddRelationship}>
                                <p className="text-[11px] text-muted-foreground/60 italic mb-4">No foreign keys defined for this table</p>
                                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleAddRelationship(); }} disabled={isBlocked} className="h-9 px-6 text-[11px] font-bold gap-2 border-dashed border-2 hover:bg-blue-500/5 hover:border-blue-500 hover:text-blue-500 transition-all rounded-xl">
                                    <Plus className="w-3.5 h-3.5" /> Define First Relationship
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {relationships.map((rel) => (
                                    <div key={rel.id} className="flex flex-wrap items-center gap-4 p-5 bg-card/60 border border-border/50 rounded-2xl group relative hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/[0.03] transition-all animate-in zoom-in-95 duration-200">
                                        <div className="flex flex-col gap-2 flex-1 min-w-[140px]">
                                            <label className="text-[9px] uppercase font-black text-muted-foreground/30 tracking-tighter ml-1">Local Column</label>
                                            <select 
                                                className="bg-muted/40 border border-border/50 rounded-xl px-3 h-10 text-[11px] font-medium outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer appearance-none"
                                                value={rel.source}
                                                onChange={(e) => handleUpdateRelationship(rel.id, { source: e.target.value })}
                                            >
                                                {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                            </select>
                                        </div>

                                        <div className="pt-6 text-muted-foreground/20">
                                            <ArrowRightLeft className="w-4 h-4" />
                                        </div>

                                        <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
                                            <label className="text-[9px] uppercase font-black text-muted-foreground/30 tracking-tighter ml-1">Referenced Table</label>
                                            <input 
                                                placeholder="e.g. users"
                                                className="bg-muted/40 border border-border/50 rounded-xl px-4 h-10 text-[11px] font-medium outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                value={rel.targetTable}
                                                onChange={(e) => handleUpdateRelationship(rel.id, { targetTable: e.target.value })}
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
                                            <label className="text-[9px] uppercase font-black text-muted-foreground/30 tracking-tighter ml-1">Referenced Column</label>
                                            <input 
                                                placeholder="e.g. id"
                                                className="bg-muted/40 border border-border/50 rounded-xl px-4 h-10 text-[11px] font-medium outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                value={rel.targetColumn}
                                                onChange={(e) => handleUpdateRelationship(rel.id, { targetColumn: e.target.value })}
                                            />
                                        </div>

                                        <div className="pt-6">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleRemoveRelationship(rel.id)}
                                                className="h-10 w-10 p-0 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={handleAddRelationship} disabled={isBlocked} className="h-10 text-[11px] font-bold gap-2 w-full border-dashed border-2 rounded-2xl hover:bg-blue-500/5 hover:text-blue-500 hover:border-blue-500/50 transition-all">
                                    <Plus className="w-3.5 h-3.5" /> New Foreign Key
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
