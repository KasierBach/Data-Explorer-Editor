import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { queryService } from '@/core/services/QueryService';

interface CreateDatabaseDialogProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string | null;
    onSuccess: () => void;
}

export const CreateDatabaseDialog: React.FC<CreateDatabaseDialogProps> = ({
    isOpen,
    onClose,
    connectionId,
    onSuccess
}) => {
    const [dbName, setDbName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async () => {
        if (!dbName.trim()) {
            toast.error("Database name is required");
            return;
        }
        if (!connectionId) return;

        setIsLoading(true);
        try {
            await queryService.createDatabase(connectionId, dbName);
            toast.success(`Database ${dbName} created successfully`);
            setDbName('');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error("Failed to create database", {
                description: error.message
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-500" />
                        Create New Database
                    </DialogTitle>
                    <DialogDescription>
                        Enter a unique name for the new database.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Database Name</Label>
                        <Input
                            id="name"
                            value={dbName}
                            onChange={(e) => setDbName(e.target.value)}
                            placeholder="my_new_database"
                            className="col-span-3"
                            disabled={isLoading}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={isLoading} className="gap-2">
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
