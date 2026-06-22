import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ErdWorkspaceService, type SaveErdWorkspacePayload } from '@/core/services/ErdWorkspaceService';
import type { ErdWorkspaceEntity } from '@/core/domain/entities';
import { ApiError } from '@/core/services/api.service';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface UseErdWorkspaceOptions {
    connectionId: string;
    selectedDatabase?: string;
    currentWorkspaceId: string | null;
    setCurrentWorkspaceId: (id: string | null) => void;
    setCurrentWorkspaceName: (name: string | null) => void;
    setCurrentWorkspaceNotes: (notes: string) => void;
    buildWorkspaceLayout: () => Record<string, unknown>;
    applyWorkspaceLayout: (layout: Record<string, unknown> | null) => void;
    handleSetSelectedDatabase: (db: string | undefined) => void;
    lang: string;
}

export function useErdWorkspace({
    connectionId,
    selectedDatabase,
    currentWorkspaceId,
    setCurrentWorkspaceId,
    setCurrentWorkspaceName,
    setCurrentWorkspaceNotes,
    buildWorkspaceLayout,
    applyWorkspaceLayout,
    handleSetSelectedDatabase,
    lang,
}: UseErdWorkspaceOptions) {
    const text = getWorkspaceText(lang).erd;
    const queryClient = useQueryClient();
    const hasShownWorkspaceWarning = useRef(false);

    const handleWorkspaceListError = useCallback((error: unknown) => {
        console.error('[ERD] Failed to load saved workspaces', error);

        if (hasShownWorkspaceWarning.current) return;
        hasShownWorkspaceWarning.current = true;

        const isStorageUnavailable =
            error instanceof ApiError &&
            (error.reason === 'ERD_WORKSPACE_STORAGE_UNAVAILABLE' || error.statusCode === 503);

        toast.error(
            isStorageUnavailable
                ? text.storageNotReady
                : text.loadFailed,
            {
                description: isStorageUnavailable
                    ? text.storageDescription
                    : (error instanceof Error ? error.message : undefined),
            },
        );
    }, [text]);

    const saveWorkspace = useCallback(async (values: { name: string; notes: string }) => {
        if (!connectionId) {
            throw new Error(text.noConnectionToSave);
        }

        const payload: Partial<SaveErdWorkspacePayload> = {
            name: values.name,
            notes: values.notes,
            connectionId,
            database: selectedDatabase,
            layout: buildWorkspaceLayout(),
        };

        const workspace = currentWorkspaceId
            ? await ErdWorkspaceService.updateWorkspace(currentWorkspaceId, payload)
            : await ErdWorkspaceService.createWorkspace(payload as SaveErdWorkspacePayload);

        setCurrentWorkspaceId(workspace.id);
        setCurrentWorkspaceName(workspace.name);
        setCurrentWorkspaceNotes(workspace.notes || '');

        await queryClient.invalidateQueries({ queryKey: ['erd-workspaces', connectionId] });
        toast.success(text.saved);
    }, [
        buildWorkspaceLayout,
        connectionId,
        currentWorkspaceId,
        queryClient,
        selectedDatabase,
        setCurrentWorkspaceId,
        setCurrentWorkspaceName,
        setCurrentWorkspaceNotes,
        text,
    ]);

    const loadWorkspace = useCallback(async (workspace: ErdWorkspaceEntity) => {
        if (workspace.database !== selectedDatabase) {
            handleSetSelectedDatabase(workspace.database || undefined);
        }

        applyWorkspaceLayout(workspace.layout as Record<string, unknown>);
        setCurrentWorkspaceId(workspace.id);
        setCurrentWorkspaceName(workspace.name);
        setCurrentWorkspaceNotes(workspace.notes || '');
        toast.success(text.loaded);
    }, [
        applyWorkspaceLayout,
        handleSetSelectedDatabase,
        selectedDatabase,
        setCurrentWorkspaceId,
        setCurrentWorkspaceName,
        setCurrentWorkspaceNotes,
        text,
    ]);

    const deleteWorkspace = useCallback(async (workspace: ErdWorkspaceEntity) => {
        await ErdWorkspaceService.deleteWorkspace(workspace.id);
        if (workspace.id === currentWorkspaceId) {
            setCurrentWorkspaceId(null);
            setCurrentWorkspaceName(null);
            setCurrentWorkspaceNotes('');
        }
        await queryClient.invalidateQueries({ queryKey: ['erd-workspaces', connectionId] });
        toast.success(text.deleted);
    }, [
        connectionId,
        currentWorkspaceId,
        queryClient,
        setCurrentWorkspaceId,
        setCurrentWorkspaceName,
        setCurrentWorkspaceNotes,
        text,
    ]);

    return {
        handleWorkspaceListError,
        saveWorkspace,
        loadWorkspace,
        deleteWorkspace,
    };
}
