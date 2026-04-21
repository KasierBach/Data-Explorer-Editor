import { useState, useCallback } from 'react';
import { SavedQueryService } from '@/core/services/SavedQueryService';
import { useAppStore, type SavedQuery } from '@/core/services/store';
import { toast } from 'sonner';

interface SaveQueryFormValues {
    name: string;
    visibility: 'private' | 'public';
    folderId: string;
    tags: string;
    description: string;
}

export function useQuerySave() {
    const { saveQuery, savedQueries } = useAppStore();
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [currentSavedQueryId, setCurrentSavedQueryId] = useState<string | null>(null);
    const [saveDialogInitialValues, setSaveDialogInitialValues] = useState<SaveQueryFormValues>({
        name: '',
        visibility: 'private',
        folderId: '',
        tags: '',
        description: '',
    });

    const openSaveDialog = useCallback((query: string, existingId?: string) => {
        const existing = existingId ? savedQueries.find(q => q.id === existingId) : null;
        
        setSaveDialogInitialValues({
            name: existing?.name || '',
            visibility: (existing?.visibility as 'private' | 'public') || 'private',
            folderId: existing?.folderId || '',
            tags: existing?.tags?.join(', ') || '',
            description: existing?.description || '',
        });
        setCurrentSavedQueryId(existingId || null);
        setIsSaveDialogOpen(true);
    }, [savedQueries]);

    const handleSave = useCallback(async (query: string, values: SaveQueryFormValues) => {
        try {
            const savedQuery = await SavedQueryService.create({
                name: values.name,
                sql: query,
                visibility: values.visibility,
                folderId: values.folderId || undefined,
                tags: values.tags ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
                description: values.description || undefined,
            });
            
            saveQuery(savedQuery as SavedQuery);
            setCurrentSavedQueryId(savedQuery.id);
            toast.success('Query saved successfully');
            setIsSaveDialogOpen(false);
            return savedQuery;
        } catch (error) {
            toast.error('Failed to save query');
            throw error;
        }
    }, [saveQuery]);

    const closeSaveDialog = useCallback(() => {
        setIsSaveDialogOpen(false);
    }, []);

    return {
        isSaveDialogOpen,
        currentSavedQueryId,
        saveDialogInitialValues,
        openSaveDialog,
        handleSave,
        closeSaveDialog,
        setCurrentSavedQueryId,
    };
}
