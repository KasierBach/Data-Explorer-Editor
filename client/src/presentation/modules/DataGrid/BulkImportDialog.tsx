import React, { useState, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/presentation/components/ui/dialog";
import { Button } from '@/presentation/components/ui/button';
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { queryService } from '@/core/services/QueryService';
import { useAppStore } from '@/core/services/store';
import { toast } from 'sonner';
import type { RowData } from '@/core/domain/entities';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface BulkImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tableId: string;
    schema?: string;
    onSuccess: () => void;
    importAllowed?: boolean;
    readOnly?: boolean;
}

export const BulkImportDialog: React.FC<BulkImportDialogProps> = ({
    open,
    onOpenChange,
    tableId,
    schema,
    onSuccess,
    importAllowed = true,
    readOnly = false,
}) => {
    const { activeConnectionId, lang } = useAppStore();
    const text = getWorkspaceText(lang).bulkImportDialog;
    const [file, setFile] = useState<File | null>(null);
    const [data, setData] = useState<RowData[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const processFile = (selectedFile: File) => {
        if (!selectedFile.name.endsWith('.csv')) {
            toast.error(text.csvOnly);
            return;
        }
        
        setFile(selectedFile);
        setError(null);
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const csv = event.target?.result as string;
            const lines = csv.split('\n').filter(l => l.trim());
            if (lines.length < 2) {
                setError(text.invalidCsv);
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const rows = lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const obj: RowData = {};
                headers.forEach((h, i) => {
                    obj[h] = values[i];
                });
                return obj;
            });

            setData(rows);
        };
        reader.readAsText(selectedFile);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) processFile(selectedFile);
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) processFile(droppedFile);
    };

    const handleImport = async () => {
        if (!activeConnectionId || data.length === 0) return;
        if (!importAllowed || readOnly) return;

        setIsImporting(true);
        setError(null);

        try {
            await queryService.importData({
                connectionId: activeConnectionId,
                schema: schema || 'public',
                table: tableId,
                data: data
            });

            toast.success(text.importSuccess(data.length));
            onSuccess();
            onOpenChange(false);
            setFile(null);
            setData([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : text.fallbackImportError);
            toast.error(text.importFailed);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        {text.title}
                    </DialogTitle>
                </DialogHeader>

                <div 
                    className={`py-10 flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-all duration-200 ${
                        isDragging 
                            ? 'border-primary bg-primary/5 scale-[1.02]' 
                            : 'border-muted-foreground/20 bg-muted/10'
                    }`}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                >
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".csv" 
                        className="hidden" 
                    />
                    
                    {!file ? (
                        <div className="flex flex-col items-center gap-3">
                            <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                                <Upload className="w-8 h-8" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium">
                                    {isDragging 
                                        ? text.dropHere
                                        : text.dragHere}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {text.browseHint}
                                </p>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-2"
                            >
                                {text.selectFile}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 rounded-full border border-green-500/20 text-xs font-semibold">
                                <Check className="w-4 h-4" />
                                {file.name}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {text.rowsReady(data.length)}
                            </p>
                            <Button variant="ghost" size="sm" className="text-xs h-8 mt-2" onClick={() => { setFile(null); setData([]); }}>
                                {text.changeFile}
                            </Button>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md flex items-start gap-2 text-red-600 text-xs mt-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {(!importAllowed || readOnly) && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-500 text-xs mt-2">
                        {readOnly
                            ? text.readOnlyBlocked
                            : text.disabledBlocked}
                    </div>
                )}

                <DialogFooter className="mt-4">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        {text.cancel}
                    </Button>
                    <Button 
                        disabled={!file || isImporting || !importAllowed || readOnly} 
                        onClick={handleImport}
                    >
                        {isImporting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {text.startImport}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
