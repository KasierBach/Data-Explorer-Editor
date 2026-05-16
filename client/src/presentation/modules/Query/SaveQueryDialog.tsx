import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/presentation/components/ui/select';
import type { SavedQuery } from '@/core/services/store';

export interface SaveQueryFormValues {
    name: string;
    visibility: 'private' | 'workspace';
    organizationId: string;
    folderId: string;
    tags: string;
    description: string;
}

export interface WorkspaceOption {
    id: string;
    name: string;
}

const EMPTY_WORKSPACE_OPTIONS: WorkspaceOption[] = [];

interface SaveQueryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lang: 'vi' | 'en';
    initialValues: SaveQueryFormValues;
    currentQuery?: SavedQuery | null;
    workspaceOptions?: WorkspaceOption[];
    onSubmit: (values: SaveQueryFormValues) => Promise<void> | void;
}

export const SaveQueryDialog: React.FC<SaveQueryDialogProps> = ({
    open,
    onOpenChange,
    lang,
    initialValues,
    currentQuery,
    workspaceOptions = EMPTY_WORKSPACE_OPTIONS,
    onSubmit,
}) => {
    const [form, setForm] = useState<SaveQueryFormValues>(initialValues);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const canShareToWorkspace = workspaceOptions.length > 0;

    useEffect(() => {
        if (open) {
            const fallbackWorkspaceId = initialValues.organizationId || workspaceOptions[0]?.id || '';
            const nextVisibility = canShareToWorkspace ? initialValues.visibility : 'private';
            setForm({
                ...initialValues,
                visibility: nextVisibility,
                organizationId: nextVisibility === 'workspace' ? fallbackWorkspaceId : '',
            });
            setIsSaving(false);
            setError(null);
        }
    }, [open, initialValues, canShareToWorkspace, workspaceOptions]);

    const handleVisibilityChange = (value: SaveQueryFormValues['visibility']) => {
        setForm((prev) => ({
            ...prev,
            visibility: value,
            organizationId: value === 'workspace' ? (prev.organizationId || workspaceOptions[0]?.id || '') : '',
        }));
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) return;
        if (form.visibility === 'workspace' && !form.organizationId) return;
        setIsSaving(true);
        try {
            await onSubmit({
                ...form,
                name: form.name.trim(),
                folderId: form.folderId.trim(),
                tags: form.tags,
                description: form.description.trim(),
            });
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save query');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {currentQuery
                            ? (lang === 'vi' ? 'Cập nhật saved query' : 'Update saved query')
                            : (lang === 'vi' ? 'Lưu saved query' : 'Save query')}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {error && (
                        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                            {error}
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <Label>{lang === 'vi' ? 'Tên hiển thị' : 'Display name'}</Label>
                        <Input
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder={lang === 'vi' ? 'VD: Revenue by week' : 'e.g. Revenue by week'}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>{lang === 'vi' ? 'Quyền hiển thị' : 'Visibility'}</Label>
                            <Select
                                value={form.visibility}
                                onValueChange={handleVisibilityChange}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="private">{lang === 'vi' ? 'Riêng tư' : 'Private'}</SelectItem>
                                    {canShareToWorkspace && (
                                        <SelectItem value="workspace">{lang === 'vi' ? 'Toàn workspace' : 'Workspace-wide'}</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            {form.visibility === 'workspace' && canShareToWorkspace ? (
                                <>
                                    <Label>{lang === 'vi' ? 'Workspace / Team' : 'Workspace / Team'}</Label>
                                    <Select
                                        value={form.organizationId}
                                        onValueChange={(value) => setForm((prev) => ({ ...prev, organizationId: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={lang === 'vi' ? 'Chọn workspace' : 'Choose workspace'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {workspaceOptions.map((workspace) => (
                                                <SelectItem key={workspace.id} value={workspace.id}>
                                                    {workspace.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </>
                            ) : (
                                <>
                                    <Label>{lang === 'vi' ? 'Folder / Group' : 'Folder / Group'}</Label>
                                    <Input
                                        value={form.folderId}
                                        onChange={(e) => setForm((prev) => ({ ...prev, folderId: e.target.value }))}
                                        placeholder={lang === 'vi' ? 'analytics, ops, growth...' : 'analytics, ops, growth...'}
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    {form.visibility === 'workspace' && canShareToWorkspace && (
                        <div className="space-y-1.5">
                            <Label>{lang === 'vi' ? 'Folder / Group' : 'Folder / Group'}</Label>
                            <Input
                                value={form.folderId}
                                onChange={(e) => setForm((prev) => ({ ...prev, folderId: e.target.value }))}
                                placeholder={lang === 'vi' ? 'analytics, ops, growth...' : 'analytics, ops, growth...'}
                            />
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label>{lang === 'vi' ? 'Tags (phân tách bằng dấu phẩy)' : 'Tags (comma-separated)'}</Label>
                        <Input
                            value={form.tags}
                            onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                            placeholder={lang === 'vi' ? 'dashboard, churn, monthly' : 'dashboard, churn, monthly'}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>{lang === 'vi' ? 'Mô tả' : 'Description'}</Label>
                        <textarea
                            className="w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={form.description}
                            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder={lang === 'vi' ? 'Mô tả ngắn để đồng đội hiểu query này dùng làm gì.' : 'Short context so teammates know what this query is for.'}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        {lang === 'vi' ? 'Hủy' : 'Cancel'}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSaving || !form.name.trim() || (form.visibility === 'workspace' && !form.organizationId)}
                    >
                        {isSaving
                            ? (lang === 'vi' ? 'Đang lưu...' : 'Saving...')
                            : (currentQuery ? (lang === 'vi' ? 'Cập nhật' : 'Update') : (lang === 'vi' ? 'Lưu query' : 'Save query'))}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
