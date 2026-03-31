import { useState } from 'react';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { toast } from 'sonner';
import type { TableMetadata } from '@/core/domain/entities';

interface UseDataGridEditingParams {
    tableId: string;
    metadata: TableMetadata | undefined;
    dbName: string | undefined;
    schema: string;
    cleanTableName: string | undefined;
    pkField: string | undefined;
    refetch: () => void;
}

export function useDataGridEditing({
    tableId, metadata, dbName, schema, cleanTableName, pkField, refetch,
}: UseDataGridEditingParams) {
    const { activeConnectionId, connections } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    const [isEditMode, setIsEditMode] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, any>>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [isInserting, setIsInserting] = useState(false);
    const [newRowData, setNewRowData] = useState<Record<string, string>>({});

    const getAdapter = () => {
        if (!activeConnection) throw new Error("No active connection");
        return connectionService.getAdapter(activeConnection.id, activeConnection.type as any);
    };

    const handleCellChange = (rowId: string, colName: string, value: string) => {
        setPendingChanges(prev => ({
            ...prev,
            [rowId]: { ...(prev[rowId] || {}), [colName]: value },
        }));
    };

    const handleSaveData = async () => {
        if (!activeConnection || !pkField) return;
        setIsSaving(true);
        try {
            const adapter = getAdapter();
            for (const rowId of Object.keys(pendingChanges)) {
                await adapter.updateRow({
                    database: dbName,
                    schema,
                    table: cleanTableName || tableId,
                    pkColumn: pkField,
                    pkValue: isNaN(Number(rowId)) ? rowId : Number(rowId),
                    updates: pendingChanges[rowId],
                });
            }
            setPendingChanges({});
            setIsEditMode(false);
            refetch();
            toast.success('Changes saved');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSchema = async (operations: any[]) => {
        if (!activeConnection || !metadata) return;
        setIsSaving(true);
        try {
            const adapter = getAdapter();
            await adapter.updateSchema({
                database: dbName,
                schema,
                table: cleanTableName || tableId,
                operations,
            });
            refetch();
            toast.success('Schema updated');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRows = async () => {
        if (!activeConnection || !metadata || selectedRows.size === 0 || !pkField) return;
        if (!confirm(`Delete ${selectedRows.size} row(s)? This cannot be undone.`)) return;

        setIsSaving(true);
        try {
            const adapter = getAdapter();
            await adapter.deleteRows({
                database: dbName,
                schema,
                table: cleanTableName || tableId,
                pkColumn: pkField,
                pkValues: [...selectedRows].map(v => isNaN(Number(v)) ? v : Number(v)),
            });
            setSelectedRows(new Set());
            toast.success(`${selectedRows.size} row(s) deleted`);
            refetch();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleInsertRow = async () => {
        if (!activeConnection || !metadata) return;
        
        const data: Record<string, any> = {};
        Object.entries(newRowData).forEach(([col, v]) => {
            if (v.trim() === '') return;
            if (v.toLowerCase() === 'null') data[col] = null;
            else if (v.toLowerCase() === 'true') data[col] = true;
            else if (v.toLowerCase() === 'false') data[col] = false;
            else if (!isNaN(Number(v))) data[col] = Number(v);
            else data[col] = v;
        });

        if (Object.keys(data).length === 0) { 
            toast.error('Enter at least one value'); 
            return; 
        }

        setIsSaving(true);
        try {
            const adapter = getAdapter();
            await adapter.insertRow({
                database: dbName,
                schema,
                table: cleanTableName || tableId,
                data,
            });
            setNewRowData({});
            setIsInserting(false);
            toast.success('Row inserted successfully');
            refetch();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleEditMode = () => {
        if (isEditMode) {
            setPendingChanges({});
            setIsEditMode(false);
        } else {
            setIsEditMode(true);
        }
    };

    const toggleRowSelection = (pkValue: string) => {
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(pkValue)) next.delete(pkValue);
            else next.add(pkValue);
            return next;
        });
    };

    const toggleInsertMode = () => {
        setIsInserting(!isInserting);
        setNewRowData({});
    };

    return {
        isEditMode,
        pendingChanges,
        isSaving,
        selectedRows,
        isInserting,
        newRowData,
        setNewRowData,
        handleCellChange,
        handleSaveData,
        handleSaveSchema,
        handleDeleteRows,
        handleInsertRow,
        toggleEditMode,
        toggleRowSelection,
        toggleInsertMode,
    };
}
