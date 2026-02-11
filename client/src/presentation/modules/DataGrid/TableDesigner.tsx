import React, { useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { RefreshCw, Plus, Trash2, Save, X, Link as LinkIcon } from 'lucide-react';
import type { TableMetadata, TableColumn } from '@/core/domain/entities';

interface TableDesignerProps {
    tableName: string;
    metadata: TableMetadata;
    onSave: (operations: any[]) => void;
    onCancel: () => void;
}

export const TableDesigner: React.FC<TableDesignerProps> = ({ tableName, metadata, onSave, onCancel }) => {
    const [columns, setColumns] = useState<TableColumn[]>([...metadata.columns]);
    const [isSaving, setIsSaving] = useState(false);

    const handleAddColumn = () => {
        setColumns([...columns, {
            name: `new_column_${columns.length + 1}`,
            type: 'varchar(255)',
            isNullable: true,
            isPrimaryKey: false,
            isForeignKey: false
        }]);
    };

    const handleRemoveColumn = (index: number) => {
        setColumns(columns.filter((_, i) => i !== index));
    };

    const handleUpdateColumn = (index: number, updates: any) => {
        const newCols = [...columns];
        newCols[index] = { ...newCols[index], ...updates };
        setColumns(newCols);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const operations: any[] = [];

        // 1. Identify dropped columns
        const currentNames = columns.map(c => c.name);

        metadata.columns.forEach(col => {
            if (!currentNames.includes(col.name)) {
                operations.push({ type: 'drop_column', name: col.name });
            }
        });

        // 2. Identify new or changed columns
        columns.forEach(col => {
            const original = metadata.columns.find(c => c.name === col.name);
            if (!original) {
                operations.push({
                    type: 'add_column',
                    name: col.name,
                    dataType: col.type,
                    isNullable: col.isNullable
                });
            } else {
                if (original.type !== col.type) {
                    operations.push({ type: 'alter_column_type', name: col.name, newType: col.type });
                }
                if (original.isPrimaryKey !== col.isPrimaryKey) {
                    if (col.isPrimaryKey) {
                        operations.push({ type: 'add_pk', columns: [col.name] });
                    } else {
                        operations.push({ type: 'drop_pk' });
                    }
                }
            }
        });

        await onSave(operations);
        setIsSaving(false);
    };

    return (
        <div className="flex flex-col h-full bg-background p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Table Designer: {tableName}
                </h3>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 text-xs gap-1.5">
                        <X className="w-3.5 h-3.5" /> Cancel
                    </Button>
                    <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving} className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700">
                        {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted/50 border-b">
                        <tr>
                            <th className="p-2 px-3 font-semibold border-r w-10"></th>
                            <th className="p-2 px-3 font-semibold border-r">Column Name</th>
                            <th className="p-2 px-3 font-semibold border-r">Data Type</th>
                            <th className="p-2 px-3 font-semibold border-r w-24 text-center">Nullable</th>
                            <th className="p-2 px-3 font-semibold border-r w-24 text-center">PK</th>
                            <th className="p-2 px-3 font-semibold w-16 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {columns.map((col, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                                <td className="p-2 px-3 text-center text-muted-foreground border-r font-mono text-[10px]">
                                    {idx + 1}
                                </td>
                                <td className="p-1 px-2 border-r">
                                    <input
                                        className="w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-primary rounded px-1 -mx-1 py-0.5 h-7"
                                        value={col.name}
                                        onChange={(e) => handleUpdateColumn(idx, { name: e.target.value })}
                                    />
                                </td>
                                <td className="p-1 px-2 border-r">
                                    <select
                                        className="w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-primary rounded px-1 -mx-1 py-0.5 h-7 cursor-pointer"
                                        value={col.type}
                                        onChange={(e) => handleUpdateColumn(idx, { type: e.target.value })}
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
                                <td className="p-1 px-2 border-r text-center">
                                    <input
                                        type="checkbox"
                                        checked={col.isNullable}
                                        onChange={(e) => handleUpdateColumn(idx, { isNullable: e.target.checked })}
                                    />
                                </td>
                                <td className="p-1 px-2 border-r text-center">
                                    <input
                                        type="checkbox"
                                        checked={col.isPrimaryKey}
                                        onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            // Ensure only one PK for now (simplified)
                                            if (isChecked) {
                                                setColumns(columns.map((c, i) => ({ ...c, isPrimaryKey: i === idx })));
                                            } else {
                                                handleUpdateColumn(idx, { isPrimaryKey: false });
                                            }
                                        }}
                                    />
                                </td>
                                <td className="p-1 px-2 text-center">
                                    <Button variant="ghost" size="sm" onClick={() => handleRemoveColumn(idx)} className="h-7 w-7 p-0 text-destructive hover:text-white hover:bg-destructive">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="p-2 bg-muted/10 border-t">
                    <Button variant="outline" size="sm" onClick={handleAddColumn} className="h-8 text-xs gap-1.5 w-full border-dashed">
                        <Plus className="w-3.5 h-3.5" /> Add New Column
                    </Button>
                </div>
            </div>

            <div className="mt-8 space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                    <LinkIcon className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-xs font-bold uppercase text-muted-foreground">Relationships (Foreign Keys)</h4>
                </div>
                <div className="text-center p-8 border-2 border-dashed rounded-lg bg-muted/5">
                    <p className="text-xs text-muted-foreground italic mb-2">FK configuration coming in next phase.</p>
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 opacity-50" disabled>
                        <Plus className="w-3.5 h-3.5" /> Add Relationship
                    </Button>
                </div>
            </div>
        </div>
    );
};
