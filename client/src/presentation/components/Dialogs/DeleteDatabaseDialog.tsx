import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { queryService } from '@/core/services/QueryService';

interface DeleteDatabaseDialogProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string | null;
    databaseName: string | null;
    onSuccess: () => void;
}

export const DeleteDatabaseDialog: React.FC<DeleteDatabaseDialogProps> = ({
    isOpen,
    onClose,
    connectionId,
    databaseName,
    onSuccess
}) => {
    const [confirmName, setConfirmName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleDelete = async () => {
        if (confirmName !== databaseName) {
            toast.error("Database name does not match");
            return;
        }
        if (!connectionId || !databaseName) return;

        setIsLoading(true);
        try {
            await queryService.dropDatabase(connectionId, databaseName);
            toast.success(`Database ${databaseName} deleted successfully`);
            setConfirmName('');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error("Failed to delete database", {
                description: error.message
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] border-red-500/20">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-500">
                        <Trash2 className="w-5 h-5" />
                        Delete Database
                    </DialogTitle>
                    <DialogDescription>
                        This action cannot be undone. This will permanently delete the
                        <span className="font-bold text-foreground"> {databaseName} </span>
                        database and all its data.
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 flex gap-3 items-start my-2">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-red-500/90">
                        Please type <span className="font-bold select-all">{databaseName}</span> to confirm.
                    </div>
                </div>

                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Input
                            value={confirmName}
                            onChange={(e) => setConfirmName(e.target.value)}
                            placeholder={databaseName || ''}
                            className="col-span-3 border-red-500/30 focus-visible:ring-red-500/30"
                            disabled={isLoading}
                            onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isLoading || confirmName !== databaseName}
                        className="gap-2 bg-red-600 hover:bg-red-700"
                    >
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Delete Forever
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
