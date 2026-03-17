import React, { useState, useEffect } from 'react';
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
import { Check, Link, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/core/services/store';

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
    const [constraintName, setConstraintName] = useState('');
    const [onDelete, setOnDelete] = useState<'NO ACTION' | 'CASCADE' | 'SET NULL' | 'RESTRICT'>('NO ACTION');
    const [onUpdate, setOnUpdate] = useState<'NO ACTION' | 'CASCADE' | 'SET NULL' | 'RESTRICT'>('NO ACTION');

    useEffect(() => {
        if (isOpen) {
            setConstraintName(`FK_${sourceTable}_${targetTable}_${Math.floor(Math.random() * 1000)}`);
        }
    }, [isOpen, sourceTable, targetTable]);

    const handleConfirm = () => {
        onConfirm({
            constraintName,
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
            <DialogContent className="sm:max-w-[600px] bg-card/95 backdrop-blur-xl border-white/10 shadow-2xl">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                            <Link className="h-5 w-5" />
                        </div>
                        <DialogTitle className="text-xl">{lang === 'vi' ? 'Tạo Liên kết Khóa ngoại' : 'Create Foreign Key Relationship'}</DialogTitle>
                    </div>
                    <DialogDescription>
                        {lang === 'vi' ? (
                            <>Xác định mối quan hệ giữa <span className="font-bold text-foreground">{sourceTable}</span> và <span className="font-bold text-foreground">{targetTable}</span>.</>
                        ) : (
                            <>Define the relationship between <span className="font-bold text-foreground">{sourceTable}</span> and <span className="font-bold text-foreground">{targetTable}</span>.</>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="constraintName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{lang === 'vi' ? 'Tên ràng buộc' : 'Constraint Name'}</Label>
                        <Input
                            id="constraintName"
                            value={constraintName}
                            onChange={(e) => setConstraintName(e.target.value)}
                            className="font-mono text-sm bg-muted/30"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-8 p-4 rounded-xl bg-muted/20 border border-white/5">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-blue-400">
                                <span>{lang === 'vi' ? 'Bảng Khóa ngoại (Con)' : 'Foreign Key Table (Child)'}</span>
                            </div>
                            <div className="p-3 bg-background/50 rounded-lg border border-white/5">
                                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">{lang === 'vi' ? 'Bảng' : 'Table'}</div>
                                <div className="font-bold text-sm truncate" title={sourceTable}>{sourceTable}</div>
                            </div>
                            <div className="p-3 bg-background/50 rounded-lg border border-white/5">
                                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">{lang === 'vi' ? 'Cột' : 'Column'}</div>
                                <div className="font-mono text-sm truncate" title={sourceColumn}>{sourceColumn}</div>
                            </div>
                        </div>

                        <div className="space-y-4 relative">
                            <div className="absolute top-1/2 -left-4 -translate-y-1/2 -translate-x-1/2 z-10 flex flex-col items-center justify-center text-muted-foreground/30">
                                <div className="w-8 h-px bg-current"></div>
                                <div className="text-[10px] font-black uppercase bg-card px-1">{lang === 'vi' ? 'Tham chiếu' : 'Refs'}</div>
                            </div>

                            <div className="flex items-center gap-2 text-sm font-semibold text-amber-500">
                                <span>{lang === 'vi' ? 'Bảng Khóa chính (Cha)' : 'Primary Key Table (Parent)'}</span>
                            </div>
                            <div className="p-3 bg-background/50 rounded-lg border border-white/5">
                                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">{lang === 'vi' ? 'Bảng' : 'Table'}</div>
                                <div className="font-bold text-sm truncate" title={targetTable}>{targetTable}</div>
                            </div>
                            <div className="p-3 bg-background/50 rounded-lg border border-white/5">
                                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">{lang === 'vi' ? 'Cột' : 'Column'}</div>
                                <div className="font-mono text-sm truncate" title={targetColumn}>{targetColumn}</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{lang === 'vi' ? 'Khi xóa' : 'On Delete'}</Label>
                            <Select value={onDelete} onValueChange={(v: any) => setOnDelete(v)}>
                                <SelectTrigger className="bg-muted/30">
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
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{lang === 'vi' ? 'Khi cập nhật' : 'On Update'}</Label>
                            <Select value={onUpdate} onValueChange={(v: any) => setOnUpdate(v)}>
                                <SelectTrigger className="bg-muted/30">
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

                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-yellow-200/80 leading-relaxed">
                            {lang === 'vi' ? 'Việc tạo mối quan hệ này sẽ thay đổi cấu trúc cơ sở dữ liệu của bạn. Hãy đảm bảo rằng dữ liệu hiện tại không vi phạm ràng buộc mới này, nếu không thao tác sẽ thất bại.' : 'Creating this relationship will modify your database schema. Ensure that existing data does not violate this new constraint, or the operation will fail.'}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>{lang === 'vi' ? 'Hủy' : 'Cancel'}</Button>
                    <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                        <Check className="w-4 h-4" />
                        {lang === 'vi' ? 'Tạo Liên kết' : 'Create Relationship'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
