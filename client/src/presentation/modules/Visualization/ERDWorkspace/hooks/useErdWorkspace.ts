import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ErdWorkspaceService, type SaveErdWorkspacePayload } from '@/core/services/ErdWorkspaceService';
import type { ErdWorkspaceEntity } from '@/core/domain/entities';
import { ApiError } from '@/core/services/api.service';

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
                ? (lang === 'vi' ? 'Kho workspace ERD chưa sẵn sàng' : 'ERD workspace storage is not ready yet')
                : (lang === 'vi' ? 'Không thể tải danh sách workspace ERD' : 'Failed to load ERD workspaces'),
            {
                description: isStorageUnavailable
                    ? (lang === 'vi'
                        ? 'Trang ERD vẫn dùng được, nhưng bạn cần sync schema backend để lưu workspace.'
                        : 'The ERD page still works, but the backend schema must be synced before workspaces can be saved.')
                    : (error instanceof Error ? error.message : undefined),
            },
        );
    }, [lang]);

    const saveWorkspace = useCallback(async (values: { name: string; notes: string }) => {
        if (!connectionId) {
            throw new Error(lang === 'vi' ? 'Chưa có connection để lưu workspace.' : 'No connection selected for this workspace.');
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
        toast.success(lang === 'vi' ? 'Đã lưu workspace ERD' : 'ERD workspace saved');
    }, [
        buildWorkspaceLayout,
        connectionId,
        currentWorkspaceId,
        lang,
        queryClient,
        selectedDatabase,
        setCurrentWorkspaceId,
        setCurrentWorkspaceName,
        setCurrentWorkspaceNotes,
    ]);

    const loadWorkspace = useCallback(async (workspace: ErdWorkspaceEntity) => {
        if (workspace.database !== selectedDatabase) {
            handleSetSelectedDatabase(workspace.database || undefined);
        }

        applyWorkspaceLayout(workspace.layout as Record<string, unknown>);
        setCurrentWorkspaceId(workspace.id);
        setCurrentWorkspaceName(workspace.name);
        setCurrentWorkspaceNotes(workspace.notes || '');
        toast.success(lang === 'vi' ? 'Đã mở workspace ERD' : 'ERD workspace loaded');
    }, [
        applyWorkspaceLayout,
        handleSetSelectedDatabase,
        lang,
        selectedDatabase,
        setCurrentWorkspaceId,
        setCurrentWorkspaceName,
        setCurrentWorkspaceNotes,
    ]);

    const deleteWorkspace = useCallback(async (workspace: ErdWorkspaceEntity) => {
        await ErdWorkspaceService.deleteWorkspace(workspace.id);
        if (workspace.id === currentWorkspaceId) {
            setCurrentWorkspaceId(null);
            setCurrentWorkspaceName(null);
            setCurrentWorkspaceNotes('');
        }
        await queryClient.invalidateQueries({ queryKey: ['erd-workspaces', connectionId] });
        toast.success(lang === 'vi' ? 'Đã xóa workspace ERD' : 'ERD workspace deleted');
    }, [
        connectionId,
        currentWorkspaceId,
        lang,
        queryClient,
        setCurrentWorkspaceId,
        setCurrentWorkspaceName,
        setCurrentWorkspaceNotes,
    ]);

    return {
        handleWorkspaceListError,
        saveWorkspace,
        loadWorkspace,
        deleteWorkspace,
    };
}
