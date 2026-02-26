import { useState } from 'react';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { getQuotedIdentifier } from '@/core/utils/id-parser';
import { toast } from 'sonner';
import type { TableMetadata } from '@/core/domain/entities';

interface UseDataGridEditingParams {
    tableId: string;
    metadata: TableMetadata | undefined;
    dbName: string | undefined;
    schema: string;
    cleanTableName: string | undefined;
    dialect: 'mysql' | 'postgres';
    pkField: string | undefined;
    refetch: () => void;
}

export function useDataGridEditing({
    tableId, metadata, dbName, schema, cleanTableName, dialect, pkField, refetch,
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
            const qSchema = getQuotedIdentifier(schema, dialect);
            const qTable = getQuotedIdentifier(cleanTableName || tableId, dialect);
            const qPk = getQuotedIdentifier(pkField, dialect);
            const pkValues = [...selectedRows].map(v => isNaN(Number(v)) ? `'${v}'` : v).join(', ');
            const sql = `DELETE FROM ${qSchema}.${qTable} WHERE ${qPk} IN (${pkValues});`;
            await adapter.executeQuery(sql, dbName ? { database: dbName } : undefined);
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
        const nonEmptyCols = Object.entries(newRowData).filter(([, v]) => v.trim() !== '');
        if (nonEmptyCols.length === 0) { toast.error('Enter at least one value'); return; }

        setIsSaving(true);
        try {
            const adapter = getAdapter();
            const qSchema = getQuotedIdentifier(schema, dialect);
            const qTable = getQuotedIdentifier(cleanTableName || tableId, dialect);
            const colNames = nonEmptyCols.map(([col]) => getQuotedIdentifier(col, dialect)).join(', ');
            const values = nonEmptyCols.map(([, v]) => {
                if (v.toLowerCase() === 'null') return 'NULL';
                if (v.toLowerCase() === 'true') return 'TRUE';
                if (v.toLowerCase() === 'false') return 'FALSE';
                if (!isNaN(Number(v))) return v;
                return `'${v.replace(/'/g, "''")}'`;
            }).join(', ');

            const sql = `INSERT INTO ${qSchema}.${qTable} (${colNames}) VALUES (${values});`;
            await adapter.executeQuery(sql, dbName ? { database: dbName } : undefined);
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
