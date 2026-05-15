import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { AlertCircle, FileWarning } from 'lucide-react';
import { useAppStore } from '@/core/services/store';

export function DestructiveQueryDialog() {
    const { destructiveConfirm, closeDestructiveConfirm, lang } = useAppStore();

    if (!destructiveConfirm) return null;

    const { isOpen, analysis } = destructiveConfirm;

    const handleConfirm = () => {
        closeDestructiveConfirm(true);
    };

    const handleCancel = () => {
        closeDestructiveConfirm(false);
    };

    const isHighSeverity = analysis?.severity === 'high';
    const keywords = analysis?.keywords?.join(', ') || 'destructive operation';
    const target = analysis?.affectedObject || (lang === 'vi' ? 'không xác định' : 'unknown object');

    // Bilingual content
    const content = {
        vi: {
            highSeverity: 'CẢNH BÁO TỚI HẠN',
            warning: 'CẢNH BÁO',
            title: 'Hành động Nguy hiểm',
            desc: 'Câu truy vấn của bạn chứa hành động có thể phá hủy dữ liệu.',
            keywordsLabel: 'Hành động:',
            targetLabel: 'Đối tượng ảnh hưởng:',
            warningMsg: 'Hành động này có thể sửa đổi hoặc xóa vĩnh viễn dữ liệu. Bạn có chắc chắn muốn tiếp tục không?',
            cancel: 'Hủy',
            confirm: 'Vẫn Tiếp Tục'
        },
        en: {
            highSeverity: 'HIGH SEVERITY',
            warning: 'WARNING',
            title: 'Destructive Operation Detected',
            desc: 'Your query contains operations that may destroy data.',
            keywordsLabel: 'Operations:',
            targetLabel: 'Affected Object:',
            warningMsg: 'This action may permanently modify or delete data. Are you sure you want to proceed?',
            cancel: 'Cancel',
            confirm: 'Proceed Anyway'
        }
    };

    const t = content[lang] || content.en;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
            <DialogContent className="max-w-[calc(100vw-1rem)] border-red-500/20 sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        {isHighSeverity ? (
                            <AlertCircle className="h-5 w-5" />
                        ) : (
                            <FileWarning className="h-5 w-5" />
                        )}
                        <span>{isHighSeverity ? t.highSeverity : t.warning}</span>
                    </DialogTitle>
                    <DialogDescription>
                        {t.desc}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 py-4">
                    <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
                        <div className="grid grid-cols-1 gap-2 font-mono sm:grid-cols-[130px_1fr]">
                            <span className="font-semibold">{t.keywordsLabel}</span>
                            <span className="break-words uppercase">{keywords}</span>
                            
                            <span className="font-semibold">{t.targetLabel}</span>
                            <span className="break-words uppercase">{target}</span>
                        </div>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                        {t.warningMsg}
                    </p>
                </div>

                <DialogFooter className="sm:justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleCancel}>
                        {t.cancel}
                    </Button>
                    <Button type="button" variant="destructive" onClick={handleConfirm}>
                        {t.confirm}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
