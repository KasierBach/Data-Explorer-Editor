import React, { useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/presentation/components/ui/dialog";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { Input } from "@/presentation/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/presentation/components/ui/select";
import { ArrowRight, AlertTriangle, Check, Link, ShieldCheck } from 'lucide-react';
import { useAppStore } from '@/core/services/store';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface ForeignKeyDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: ForeignKeyData) => void;
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    existingTables?: string[]; // List of all tables for validation or switching if needed
}

export interface ForeignKeyData {
    constraintName: string;
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    onDelete: 'NO ACTION' | 'CASCADE' | 'SET NULL' | 'RESTRICT';
    onUpdate: 'NO ACTION' | 'CASCADE' | 'SET NULL' | 'RESTRICT';
}

type ReferentialAction = ForeignKeyData['onDelete'];

export const ForeignKeyDialog: React.FC<ForeignKeyDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    sourceTable,
    sourceColumn,
    targetTable,
    targetColumn
}) => {
    const { lang } = useAppStore();
    const text = getWorkspaceText(lang).foreignKeyDialog;
    const [constraintName, setConstraintName] = useState('');
    const [onDelete, setOnDelete] = useState<ReferentialAction>('NO ACTION');
    const [onUpdate, setOnUpdate] = useState<ReferentialAction>('NO ACTION');

    // Render-time reset: when the dialog targets a different column pair,
    // discard stale form state before rendering instead of via an effect.
    const [lastKey, setLastKey] = useState('');
    const resetKey = `${sourceTable}.${sourceColumn}->${targetTable}.${targetColumn}`;
    if (isOpen && lastKey !== resetKey) {
        setLastKey(resetKey);
        setConstraintName('');
        setOnDelete('NO ACTION');
        setOnUpdate('NO ACTION');
    }

    const defaultConstraintName = useMemo(
        () => `FK_${sourceTable}_${targetTable}`,
        [sourceTable, targetTable],
    );

    const handleConfirm = () => {
        onConfirm({
            constraintName: constraintName || defaultConstraintName,
            sourceTable, // The table holding the FK
            sourceColumn,
            targetTable, // The table holding the PK
            targetColumn,
            onDelete,
            onUpdate
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto border-white/10 bg-card/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-[680px]">
                <DialogHeader className="border-b border-white/5 px-5 pb-5 pt-6 sm:px-7">
                    <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-blue-500/10 p-3 text-blue-400 ring-1 ring-blue-400/20">
                            <Link className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                            <DialogTitle className="text-lg sm:text-xl">{text.title}</DialogTitle>
                            <DialogDescription className="text-xs leading-relaxed sm:text-sm">
                                {text.description(sourceTable, targetTable)}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid gap-5 px-5 py-5 sm:gap-6 sm:px-7">
                    <div className="grid gap-2">
                        <Label htmlFor="constraintName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{text.constraintName}</Label>
                        <Input
                            id="constraintName"
                            value={constraintName}
                            placeholder={defaultConstraintName}
                            onChange={(e) => setConstraintName(e.target.value)}
                            className="h-11 bg-muted/30 font-mono text-sm"
                        />
                        <p className="text-[11px] text-muted-foreground/60">{defaultConstraintName}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-muted/15 p-4 sm:p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{text.relationship}</span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
                            <div className="space-y-3 rounded-xl border border-blue-400/15 bg-blue-500/[0.04] p-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-blue-400">
                                    <span>{text.childTable}</span>
                                </div>
                                <div className="rounded-lg border border-white/5 bg-background/50 p-3">
                                    <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">{text.table}</div>
                                    <div className="font-bold text-sm truncate" title={sourceTable}>{sourceTable}</div>
                                </div>
                                <div className="rounded-lg border border-white/5 bg-background/50 p-3">
                                    <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">{text.column}</div>
                                    <div className="font-mono text-sm truncate" title={sourceColumn}>{sourceColumn}</div>
                                </div>
                            </div>

                            <div className="space-y-3 rounded-xl border border-amber-400/15 bg-amber-500/[0.04] p-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-amber-500">
                                    <span>{text.parentTable}</span>
                                </div>
                                <div className="rounded-lg border border-white/5 bg-background/50 p-3">
                                    <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">{text.table}</div>
                                    <div className="font-bold text-sm truncate" title={targetTable}>{targetTable}</div>
                                </div>
                                <div className="rounded-lg border border-white/5 bg-background/50 p-3">
                                    <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">{text.column}</div>
                                    <div className="font-mono text-sm truncate" title={targetColumn}>{targetColumn}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{text.onDelete}</Label>
                            <Select value={onDelete} onValueChange={(v) => setOnDelete(v as ReferentialAction)}>
                                <SelectTrigger className="h-11 bg-muted/30">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NO ACTION">No Action</SelectItem>
                                    <SelectItem value="CASCADE">Cascade</SelectItem>
                                    <SelectItem value="SET NULL">Set Null</SelectItem>
                                    <SelectItem value="RESTRICT">Restrict</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{text.onUpdate}</Label>
                            <Select value={onUpdate} onValueChange={(v) => setOnUpdate(v as ReferentialAction)}>
                                <SelectTrigger className="h-11 bg-muted/30">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NO ACTION">No Action</SelectItem>
                                    <SelectItem value="CASCADE">Cascade</SelectItem>
                                    <SelectItem value="SET NULL">Set Null</SelectItem>
                                    <SelectItem value="RESTRICT">Restrict</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3.5">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                        <div className="text-xs leading-relaxed text-amber-100/75">
                            {text.warning}
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-white/5 px-5 py-4 sm:px-7">
                    <div className="mr-auto hidden items-center gap-2 text-[11px] text-muted-foreground/60 sm:flex">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>{text.schemaChange}</span>
                    </div>
                    <Button variant="ghost" onClick={onClose}>{text.cancel}</Button>
                    <Button onClick={handleConfirm} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
                        <Check className="w-4 h-4" />
                        {text.createRelationship}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
