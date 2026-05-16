import { useState } from 'react';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { toast } from 'sonner';
import type { DatabaseValue, RowData, TableMetadata } from '@/core/domain/entities';
import type { SchemaOperation } from '@/core/domain/database-adapter.interface';

interface UseDataGridEditingParams {
    tableId: string;
    metadata: TableMetadata | undefined;
    dbName: string | undefined;
    schema: string;
    cleanTableName: string | undefined;
    pkField: string | undefined;
    refetch: () => void;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unexpected error';
}

function parseEditableValue(value: string): DatabaseValue {
    const trimmedValue = value.trim();
    const normalizedValue = trimmedValue.toLowerCase();

    if (normalizedValue === 'null') return null;
    if (normalizedValue === 'true') return true;
    if (normalizedValue === 'false') return false;
    if (trimmedValue !== '' && !Number.isNaN(Number(trimmedValue))) return Number(trimmedValue);

    return value;
}

export function useDataGridEditing({
    tableId, metadata, dbName, schema, cleanTableName, pkField, refetch,
}: UseDataGridEditingParams) {
    const { activeConnectionId, connections } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    const [isEditMode, setIsEditMode] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Record<string, RowData>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [isInserting, setIsInserting] = useState(false);
    const [newRowData, setNewRowData] = useState<Record<string, string>>({});

    const getAdapter = () => {
        if (!activeConnection) throw new Error("No active connection");
        return connectionService.getAdapter(activeConnection.id, activeConnection.type);
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
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSchema = async (operations: SchemaOperation[]) => {
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
        } catch (error) {
            toast.error(getErrorMessage(error));
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
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsSaving(false);
        }
    };

    const handleInsertRow = async () => {
        if (!activeConnection || !metadata) return;
        
        const data: RowData = {};
        Object.entries(newRowData).forEach(([col, v]) => {
            if (v.trim() === '') return;
            data[col] = parseEditableValue(v);
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
        } catch (error) {
            toast.error(getErrorMessage(error));
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
