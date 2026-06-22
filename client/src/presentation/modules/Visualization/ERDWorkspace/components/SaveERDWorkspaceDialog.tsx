import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { getWorkspaceText } from '@/core/utils/workspaceText';

export interface SaveErdWorkspaceFormValues {
    name: string;
    notes: string;
}

interface SaveErdWorkspaceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lang: 'vi' | 'en';
    initialValues: SaveErdWorkspaceFormValues;
    currentWorkspaceName?: string | null;
    onSubmit: (values: SaveErdWorkspaceFormValues) => Promise<void> | void;
}

export const SaveErdWorkspaceDialog: React.FC<SaveErdWorkspaceDialogProps> = ({
    open,
    onOpenChange,
    lang,
    initialValues,
    currentWorkspaceName,
    onSubmit,
}) => {
    const text = getWorkspaceText(lang).erd;
    const [form, setForm] = useState<SaveErdWorkspaceFormValues>(initialValues);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setForm(initialValues);
            setIsSaving(false);
            setError(null);
        }
    }, [initialValues, open]);

    const handleSubmit = async () => {
        if (!form.name.trim()) return;
        setIsSaving(true);
        setError(null);
        try {
            await onSubmit({
                name: form.name.trim(),
                notes: form.notes.trim(),
            });
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : text.saveDialogError);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {currentWorkspaceName
                            ? text.saveDialogUpdateTitle
                            : text.saveDialogCreateTitle}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {error && (
                        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>{text.saveDialogName}</Label>
                        <Input
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder={text.saveDialogNamePlaceholder}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>{text.saveDialogNotes}</Label>
                        <textarea
                            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={form.notes}
                            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                            placeholder={text.saveDialogNotesPlaceholder}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        {text.saveDialogCancel}
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSaving || !form.name.trim()}>
                        {isSaving
                            ? text.saveDialogSaving
                            : (currentWorkspaceName ? text.saveDialogUpdate : text.saveDialogSave)}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
