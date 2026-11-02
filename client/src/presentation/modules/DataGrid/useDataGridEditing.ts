import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { toast } from 'sonner';
import type { DatabaseValue, RowData, TableMetadata } from '@/core/domain/entities';
import type { SchemaOperation, RowIdentity } from '@/core/domain/database-adapter.interface';
import { getDataGridText } from './dataGridI18n';
import { getRowIdentity, rowIdentityKey } from './rowIdentity';

interface UseDataGridEditingParams {
    tableId: string;
    metadata: TableMetadata | undefined;
    dbName: string | undefined;
    schema: string;
    cleanTableName: string | undefined;
    rows: RowData[];
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
    tableId, metadata, dbName, schema, cleanTableName, rows, refetch,
}: UseDataGridEditingParams) {
    const { activeConnectionId, connections, lang } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const text = getDataGridText(lang);

    const [isEditMode, setIsEditMode] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Record<string, RowData>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [isInserting, setIsInserting] = useState(false);
    const [newRowData, setNewRowData] = useState<Record<string, string>>({});
    const scope = JSON.stringify([activeConnectionId,dbName,schema,tableId]);
    const identities = useRef(new Map<string,RowIdentity>());
    const operationGeneration = useRef(0);
    const saving = useRef(false);
    const identityByKey = useMemo(()=>{
        const map = new Map<string,RowIdentity>();
        for (const row of rows) {
            const identity = getRowIdentity(row,metadata);
            if (identity) map.set(`${scope}:${rowIdentityKey(identity)}`,identity);
        }
        return map;
    },[rows,metadata,scope]);
    const getRowKey = useCallback((row:RowData)=>{
        const identity=getRowIdentity(row,metadata);
        return identity ? `${scope}:${rowIdentityKey(identity)}` : undefined;
    },[metadata,scope]);
    const mutationDisabledReason = !['postgres','cockroach','mysql','mariadb','sqlite','mssql'].includes(activeConnection?.type ?? '')
        ? text.unsupportedRowEditing
        : !metadata?.columns.some(column=>column.isPrimaryKey) || rows.some(row=>!getRowIdentity(row,metadata))
            ? text.rowIdentityUnavailable : undefined;
    useEffect(()=>{
        operationGeneration.current++;
        saving.current=false;
        identities.current.clear();
        setPendingChanges({});
        setSelectedRows(new Set());
        setIsEditMode(false);
        setIsSaving(false);
    },[scope]);
    const rememberIdentity = useCallback((rowId:string)=>{
        if (saving.current) return false;
        const identity=identityByKey.get(rowId);
        if (mutationDisabledReason || !identity) {
            toast.error(mutationDisabledReason ?? text.invalidRowIdentity);
            return false;
        }
        identities.current.set(rowId,identity);
        return true;
    },[identityByKey,mutationDisabledReason,text.invalidRowIdentity]);
    const savedIdentity = useCallback((rowId:string)=>{
        const identity=identities.current.get(rowId);
        if (!rowId.startsWith(`${scope}:`) || !identity) throw new Error(text.invalidRowIdentity);
        return identity;
    },[scope,text.invalidRowIdentity]);

    const getAdapter = useCallback(() => {
        if (!activeConnection) throw new Error("No active connection");
        return connectionService.getAdapter(activeConnection.id, activeConnection.type);
    }, [activeConnection]);

    const handleCellChange = useCallback((rowId: string, colName: string, value: string) => {
        if (!rememberIdentity(rowId)) return;
        setPendingChanges(prev => ({
            ...prev,
            [rowId]: { ...(prev[rowId] || {}), [colName]: value },
        }));
    }, [rememberIdentity]);

    const applyPendingChangesBatch = useCallback((updatesByRow: Record<string, RowData>) => {
        if (!Object.keys(updatesByRow).every(rememberIdentity)) return;
        setPendingChanges(prev => {
            const next = { ...prev };

            for (const [rowId, updates] of Object.entries(updatesByRow)) {
                next[rowId] = {
                    ...(next[rowId] || {}),
                    ...updates,
                };
            }

            return next;
        });
    }, [rememberIdentity]);

    const handleSaveData = useCallback(async () => {
        if (saving.current || !activeConnection || mutationDisabledReason || !Object.keys(pendingChanges).length) return;
        saving.current=true;
        const generation=operationGeneration.current;
        setIsSaving(true);
        let savedCount=0;
        try {
            const adapter = getAdapter();
            const targets=Object.keys(pendingChanges).map(rowId=>({rowId,identity:savedIdentity(rowId)}));
            for (const {rowId,identity} of targets) {
                if (generation !== operationGeneration.current) return;
                const result=await adapter.updateRow({
                    database: dbName,
                    schema,
                    table: cleanTableName || tableId,
                    pkColumn: identity[0].column,
                    pkValue: identity[0].value,
                    identity,
                    updates: pendingChanges[rowId],
                });
                if (generation !== operationGeneration.current) return;
                if (result.success === false || result.rowCount !== 1) throw new Error(text.rowMutationConflict);
                savedCount++;
                setPendingChanges(previous=>{const next={...previous};delete next[rowId];return next;});
            }
            setPendingChanges({});
            setIsEditMode(false);
            toast.success(text.changesSaved);
        } catch (error) {
            if (generation === operationGeneration.current) toast.error(getErrorMessage(error));
        } finally {
            if (generation === operationGeneration.current) {
                if (savedCount) refetch();
                saving.current=false;
                setIsSaving(false);
            }
        }
    }, [activeConnection, mutationDisabledReason, savedIdentity, getAdapter, dbName, schema, cleanTableName, tableId, pendingChanges, refetch, text]);

    const handleSaveSchema = useCallback(async (operations: SchemaOperation[]) => {
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
            toast.success(text.schemaUpdated);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsSaving(false);
        }
    }, [activeConnection, metadata, getAdapter, dbName, schema, cleanTableName, tableId, refetch, text]);

    const handleDeleteRows = useCallback(async () => {
        if (saving.current || !activeConnection || !metadata || selectedRows.size === 0 || mutationDisabledReason) return;
        if (!confirm(text.deleteConfirm(selectedRows.size))) return;
        saving.current=true;
        const generation=operationGeneration.current;
        setIsSaving(true);
        try {
            const adapter = getAdapter();
            const targets=[...selectedRows].map(savedIdentity);
            const result=await adapter.deleteRows({
                database: dbName,
                schema,
                table: cleanTableName || tableId,
                pkColumn: targets[0][0].column,
                pkValues: targets.map(identity=>identity[0].value),
                identities: targets,
            });
            if (generation !== operationGeneration.current) return;
            if (result.success === false || result.rowCount !== targets.length) throw new Error(text.rowMutationConflict);
            setSelectedRows(new Set());
            toast.success(text.delete(selectedRows.size));
            refetch();
        } catch (error) {
            if (generation === operationGeneration.current) toast.error(getErrorMessage(error));
        } finally {
            if (generation === operationGeneration.current) {saving.current=false;setIsSaving(false);}
        }
    }, [activeConnection, metadata, selectedRows, mutationDisabledReason, savedIdentity, getAdapter, dbName, schema, cleanTableName, tableId, refetch, text]);

    const handleInsertRow = useCallback(async () => {
        if (!activeConnection || !metadata) return;
        
        const data: RowData = {};
        Object.entries(newRowData).forEach(([col, v]) => {
            if (v.trim() === '') return;
            data[col] = parseEditableValue(v);
        });

        if (Object.keys(data).length === 0) { 
            toast.error(text.enterAtLeastOneValue); 
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
            toast.success(text.rowInserted);
            refetch();
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsSaving(false);
        }
    }, [activeConnection, metadata, newRowData, getAdapter, dbName, schema, cleanTableName, tableId, refetch, text]);

    const toggleEditMode = useCallback(() => {
        if (saving.current) return;
        if (isEditMode) {
            setPendingChanges({});
            setIsEditMode(false);
        } else {
            if (mutationDisabledReason) {toast.error(mutationDisabledReason);return;}
            setIsEditMode(true);
        }
    }, [isEditMode,mutationDisabledReason]);

    const toggleRowSelection = useCallback((pkValue: string) => {
        if (!rememberIdentity(pkValue)) return;
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(pkValue)) next.delete(pkValue);
            else next.add(pkValue);
            return next;
        });
    }, [rememberIdentity]);

    const toggleInsertMode = useCallback(() => {
        setIsInserting(prev => !prev);
        setNewRowData({});
    }, []);

    return useMemo(() => ({
        getRowKey,
        mutationDisabledReason,
        isEditMode,
        pendingChanges,
        isSaving,
        selectedRows,
        isInserting,
        newRowData,
        setNewRowData,
        handleCellChange,
        applyPendingChangesBatch,
        handleSaveData,
        handleSaveSchema,
        handleDeleteRows,
        handleInsertRow,
        toggleEditMode,
        toggleRowSelection,
        toggleInsertMode,
    }), [
        getRowKey,
        mutationDisabledReason,
        isEditMode, 
        pendingChanges, 
        isSaving, 
        selectedRows, 
        isInserting, 
        newRowData, 
        handleCellChange, 
        applyPendingChangesBatch,
        handleSaveData, 
        handleSaveSchema, 
        handleDeleteRows, 
        handleInsertRow, 
        toggleEditMode, 
        toggleRowSelection, 
        toggleInsertMode
    ]);
}
