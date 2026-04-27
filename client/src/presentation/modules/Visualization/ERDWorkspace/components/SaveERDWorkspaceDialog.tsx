import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';

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
        } catch (err: any) {
            setError(err.message || (lang === 'vi' ? 'Không thể lưu workspace ERD' : 'Failed to save ERD workspace'));
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
                            ? (lang === 'vi' ? 'Cập nhật workspace ERD' : 'Update ERD workspace')
                            : (lang === 'vi' ? 'Lưu workspace ERD' : 'Save ERD workspace')}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {error && (
                        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>{lang === 'vi' ? 'Tên workspace' : 'Workspace name'}</Label>
                        <Input
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder={lang === 'vi' ? 'VD: Payments schema map' : 'e.g. Payments schema map'}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>{lang === 'vi' ? 'Ghi chú' : 'Notes'}</Label>
                        <textarea
                            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={form.notes}
                            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                            placeholder={lang === 'vi' ? 'Mô tả ngắn để lần sau mở lại dễ hiểu hơn.' : 'Add some context so this layout is easier to revisit later.'}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        {lang === 'vi' ? 'Hủy' : 'Cancel'}
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSaving || !form.name.trim()}>
                        {isSaving
                            ? (lang === 'vi' ? 'Đang lưu...' : 'Saving...')
                            : (currentWorkspaceName ? (lang === 'vi' ? 'Cập nhật' : 'Update') : (lang === 'vi' ? 'Lưu workspace' : 'Save workspace'))}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
