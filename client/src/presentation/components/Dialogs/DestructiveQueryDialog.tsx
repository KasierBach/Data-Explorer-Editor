import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { apiService } from '@/core/services/api.service';
import { useAppStore } from '@/core/services/store';
import { resolveAiSelection, useAiPreferences } from '@/core/services/aiPreferences';
import { AlertCircle, FileWarning, Loader2, Sparkles } from 'lucide-react';

type ImpactScope = 'rows' | 'object' | 'database' | 'instance' | 'unknown';
type DestructiveReason =
    | 'unbounded_row_mutation'
    | 'destructive_schema_change'
    | 'schema_contract_change'
    | 'opaque_execution';

type DialogAnalysis = {
    severity?: 'none' | 'medium' | 'high';
    keywords?: string[];
    affectedObject?: string | null;
    objectType?: string | null;
    impactScope?: ImpactScope;
    reason?: DestructiveReason;
    summary?: string;
    reviewChecklist?: string[];
    statement?: string;
    statementIndex?: number;
    statementCount?: number;
    flaggedStatements?: number;
};

type AiWarningResponse = {
    message?: string;
    explanation?: string;
};

export function DestructiveQueryDialog() {
    const {
        destructiveConfirm,
        closeDestructiveConfirm,
        lang,
        activeConnectionId,
        activeDatabase,
        aiModel,
        aiRoutingMode,
    } = useAppStore();
    const [aiExplanation, setAiExplanation] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [isExplaining, setIsExplaining] = useState(false);
    const preferences = useAiPreferences();
    const assistantSelection = preferences.assistantModel || aiModel;
    const resolvedExplain = resolveAiSelection(preferences.explainModel, assistantSelection, preferences.customProviders);

    const analysis = (destructiveConfirm?.analysis || {}) as DialogAnalysis;
    const isOpen = destructiveConfirm?.isOpen ?? false;

    useEffect(() => {
        if (!isOpen) return;
        setAiExplanation(null);
        setAiError(null);
        setIsExplaining(false);
    }, [analysis.statement, isOpen]);

    const content = useMemo(() => ({
        vi: {
            highSeverity: 'CẢNH BÁO NGHIÊM TRỌNG',
            reviewRequired: 'XÁC NHẬN THAY ĐỔI',
            descHigh: 'Câu truy vấn này có thể xóa dữ liệu hoặc phá vỡ phần phụ thuộc hiện có.',
            descMedium: 'Câu truy vấn này thay đổi contract/schema hoặc chạy lệnh khó dự đoán nên cần review trước khi chạy.',
            severityLabel: 'Mức độ',
            actionLabel: 'Hành động',
            objectTypeLabel: 'Loại đối tượng',
            targetLabel: 'Đối tượng',
            statementLabel: 'Bước bị gắn cờ',
            flaggedCountLabel: 'Số bước cần chú ý',
            scopeLabel: 'Phạm vi',
            reasonLabel: 'Lý do',
            checklistTitle: 'Checklist nên review',
            sqlPreview: 'SQL sắp chạy',
            aiExplain: 'AI phân tích thêm',
            aiLoading: 'AI đang phân tích...',
            aiTitle: 'Phân tích bổ sung',
            aiError: 'Không thể lấy giải thích AI lúc này.',
            aiFallback: 'AI không trả về giải thích bổ sung.',
            confirmHigh: 'Tôi đã review, vẫn chạy',
            confirmMedium: 'Review xong, tiếp tục',
            cancel: 'Hủy',
            severityHigh: 'Nghiêm trọng',
            severityMedium: 'Ảnh hưởng cấu trúc',
            scopeRows: 'Nhiều dòng dữ liệu',
            scopeObject: 'Một object hoặc schema contract',
            scopeDatabase: 'Schema hoặc database',
            scopeInstance: 'Phiên hoặc toàn instance',
            scopeUnknown: 'Chưa xác định',
            objectUnknown: 'Không xác định',
            sequenceStepValue: (index: number, count: number) => `Bước ${index}/${count}`,
            flaggedCountValue: (count: number) => `${count} bước`,
            detailRow: (action: string, target: string | null) => `${action} có thể quét rộng${target ? ` trên ${target}` : ''} vì thiếu bộ lọc WHERE an toàn.`,
            detailSchemaDestructive: (action: string, objectType: string | null, target: string | null) => `${action} có thể xóa hoặc ghi đè ${objectType ? objectType.toLowerCase() : 'object'}${target ? ` ${target}` : ''} và làm hỏng phần phụ thuộc.`,
            detailSchemaContract: (action: string, objectType: string | null, target: string | null) => `${action} thay đổi contract của ${objectType ? objectType.toLowerCase() : 'object'}${target ? ` ${target}` : ''}, có thể làm query, job hoặc tool khác lệch theo.`,
            detailOpaque: (action: string, target: string | null) => `${action} chạy logic khó dự đoán${target ? ` qua ${target}` : ''}, nên cần review side effect trước.`,
            checklistRow: [
                'Chạy SELECT trước để xem đúng tập dòng bị ảnh hưởng.',
                'Xác nhận bộ lọc không quá rộng hoặc mang tính mặc định.',
                'Nếu là dữ liệu dùng chung, nên có transaction hoặc backup.',
            ],
            checklistSchemaDestructive: [
                'Kiểm tra view, saved query, dashboard và job đang phụ thuộc.',
                'Chuẩn bị rollback hoặc backup trước khi chạy.',
                'Nếu database dùng chung, nên lên lịch đổi có kiểm soát.',
            ],
            checklistSchemaContract: [
                'Rà lại query, ORM mapping và migration liên quan.',
                'Kiểm tra các công cụ hoặc UI đang dựa vào tên hoặc shape cũ.',
                'Nếu là môi trường dùng chung, nên chạy trong khung bảo trì.',
            ],
            checklistOpaque: [
                'Mở procedure hoặc script gốc ra để review nội dung trước.',
                'Xác nhận rõ object và side effect mà lệnh có thể chạm vào.',
                'Nếu có thể, hãy test trước trên database không production.',
            ],
            aiPrompt: 'Khong sinh SQL moi. Hay phan tich ngan gon nhung ky ve rui ro cua cau SQL nay: no co the anh huong den dau, dieu gi can kiem tra truoc khi chay, va cach giam rui ro. Neu day la chuoi nhieu buoc, hay chi ro buoc dang bi gan co va nguy co neu toan bo chuoi tiep tuc chay. Tra loi bang tieng Viet, tap trung vao canh bao va checklist thuc te.',
        },
        en: {
            highSeverity: 'HIGH SEVERITY WARNING',
            reviewRequired: 'REVIEW BEFORE RUNNING',
            descHigh: 'This statement can remove data or break existing dependencies.',
            descMedium: 'This statement changes a schema contract or runs opaque logic, so it should be reviewed before execution.',
            severityLabel: 'Severity',
            actionLabel: 'Operation',
            objectTypeLabel: 'Object type',
            targetLabel: 'Target',
            statementLabel: 'Flagged step',
            flaggedCountLabel: 'Flagged steps',
            scopeLabel: 'Scope',
            reasonLabel: 'Why flagged',
            checklistTitle: 'Review checklist',
            sqlPreview: 'SQL preview',
            aiExplain: 'Ask AI for a deeper review',
            aiLoading: 'AI is reviewing...',
            aiTitle: 'Extra analysis',
            aiError: 'Could not load the AI explanation right now.',
            aiFallback: 'AI did not return extra guidance.',
            confirmHigh: 'I reviewed this, run anyway',
            confirmMedium: 'Reviewed, continue',
            cancel: 'Cancel',
            severityHigh: 'High impact',
            severityMedium: 'Contract change',
            scopeRows: 'Many data rows',
            scopeObject: 'A database object or contract',
            scopeDatabase: 'Schema or database',
            scopeInstance: 'Session or instance',
            scopeUnknown: 'Unknown scope',
            objectUnknown: 'Unknown',
            sequenceStepValue: (index: number, count: number) => `Statement ${index}/${count}`,
            flaggedCountValue: (count: number) => `${count} steps`,
            detailRow: (action: string, target: string | null) => `${action} can touch a broad set of rows${target ? ` in ${target}` : ''} because the WHERE filter is missing or effectively wide open.`,
            detailSchemaDestructive: (action: string, objectType: string | null, target: string | null) => `${action} can remove or overwrite ${objectType ? objectType.toLowerCase() : 'an object'}${target ? ` ${target}` : ''} and break dependencies.`,
            detailSchemaContract: (action: string, objectType: string | null, target: string | null) => `${action} changes the contract of ${objectType ? objectType.toLowerCase() : 'an object'}${target ? ` ${target}` : ''}, so dependent queries or tools may drift.`,
            detailOpaque: (action: string, target: string | null) => `${action} runs opaque logic${target ? ` through ${target}` : ''}, so the side effects should be reviewed first.`,
            checklistRow: [
                'Preview the target rows with a SELECT first.',
                'Confirm the filter is narrow enough for the intended change.',
                'Use a transaction or backup path on shared data.',
            ],
            checklistSchemaDestructive: [
                'Check views, saved queries, dashboards, and jobs that depend on this object.',
                'Make sure rollback or backup steps are ready.',
                'Coordinate the change if the database is shared.',
            ],
            checklistSchemaContract: [
                'Review dependent queries, ORM mappings, and migrations.',
                'Check tooling or UI that expects the old name or shape.',
                'Prefer a maintenance window on shared environments.',
            ],
            checklistOpaque: [
                'Review the underlying procedure or script body first.',
                'Confirm the touched objects and expected side effects.',
                'Test in a non-production database first when possible.',
            ],
            aiPrompt: 'Do not generate new SQL. Give a concise but serious risk review of this SQL: what it may affect, what should be checked before execution, and how to reduce risk. If this belongs to a multi-step SQL sequence, identify the flagged step and note the risk of continuing the full sequence. Answer in English and focus on practical warnings plus a checklist.',
        },
    }), []);

    if (!destructiveConfirm) return null;

    const t = content[lang] || content.en;
    const isHighSeverity = analysis.severity === 'high';
    const operation = analysis.keywords?.join(', ') || 'SQL';
    const target = analysis.affectedObject || t.objectUnknown;
    const objectType = analysis.objectType || t.objectUnknown;
    const hasSequenceContext = (analysis.statementCount ?? 0) > 1;
    const flaggedStatementCount = analysis.flaggedStatements ?? 1;
    const scope = analysis.impactScope === 'rows'
        ? t.scopeRows
        : analysis.impactScope === 'object'
            ? t.scopeObject
            : analysis.impactScope === 'database'
                ? t.scopeDatabase
                : analysis.impactScope === 'instance'
                    ? t.scopeInstance
                    : t.scopeUnknown;
    const fallbackDetail = analysis.reason === 'unbounded_row_mutation'
        ? t.detailRow(operation, analysis.affectedObject || null)
        : analysis.reason === 'destructive_schema_change'
            ? t.detailSchemaDestructive(operation, analysis.objectType || null, analysis.affectedObject || null)
            : analysis.reason === 'opaque_execution'
                ? t.detailOpaque(operation, analysis.affectedObject || null)
                : analysis.reason === 'schema_contract_change'
                    ? t.detailSchemaContract(operation, analysis.objectType || null, analysis.affectedObject || null)
                    : '';
    const detail = analysis.summary || fallbackDetail;
    const fallbackChecklist = analysis.reason === 'unbounded_row_mutation'
        ? t.checklistRow
        : analysis.reason === 'destructive_schema_change'
            ? t.checklistSchemaDestructive
            : analysis.reason === 'opaque_execution'
                ? t.checklistOpaque
                : t.checklistSchemaContract;
    const checklist = lang === 'en' && analysis.reviewChecklist?.length
        ? analysis.reviewChecklist
        : fallbackChecklist;
    const detailToneClass = isHighSeverity
        ? 'border-destructive/20 bg-destructive/10 text-destructive'
        : 'border-amber-500/20 bg-amber-500/10 text-amber-100';
    const titleToneClass = isHighSeverity ? 'text-destructive' : 'text-amber-300';
    const canExplainWithAi = !!activeConnectionId && !!analysis.statement;

    const handleConfirm = () => {
        closeDestructiveConfirm(true);
    };

    const handleCancel = () => {
        closeDestructiveConfirm(false);
    };

    const handleExplainWithAi = async () => {
        if (!activeConnectionId || !analysis.statement || isExplaining) return;

        setIsExplaining(true);
        setAiError(null);

        try {
            const result = await apiService.post<AiWarningResponse>('/ai/generate-sql', {
                connectionId: activeConnectionId,
                database: activeDatabase || undefined,
                prompt: t.aiPrompt,
                context: [
                    `SQL:\n${analysis.statement}`,
                    `Severity: ${analysis.severity || 'unknown'}`,
                    `Operation: ${operation}`,
                    `Object type: ${analysis.objectType || 'unknown'}`,
                    `Target: ${analysis.affectedObject || 'unknown'}`,
                    `Scope: ${analysis.impactScope || 'unknown'}`,
                    hasSequenceContext
                        ? `Sequence step: ${analysis.statementIndex || 1}/${analysis.statementCount || 1}`
                        : null,
                    hasSequenceContext
                        ? `Flagged steps: ${flaggedStatementCount}`
                        : null,
                    `Why flagged: ${detail}`,
                ].filter(Boolean).join('\n\n'),
                model: resolvedExplain.model,
                mode: isHighSeverity ? 'planning' : 'fast',
                routingMode: aiRoutingMode,
                providerOverride: resolvedExplain.providerOverride,
            });

            setAiExplanation(result.message?.trim() || result.explanation?.trim() || t.aiFallback);
        } catch {
            setAiError(t.aiError);
        } finally {
            setIsExplaining(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
            <DialogContent className="max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-8rem)] overflow-y-auto sm:top-[calc(50%+0.75rem)] sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className={`flex items-center gap-2 ${titleToneClass}`}>
                        {isHighSeverity ? (
                            <AlertCircle className="h-5 w-5" />
                        ) : (
                            <FileWarning className="h-5 w-5" />
                        )}
                        <span>{isHighSeverity ? t.highSeverity : t.reviewRequired}</span>
                    </DialogTitle>
                    <DialogDescription>
                        {isHighSeverity ? t.descHigh : t.descMedium}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    <div className={`rounded-md border p-4 text-sm ${detailToneClass}`}>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
                            <span className="font-semibold">{t.severityLabel}</span>
                            <span>{isHighSeverity ? t.severityHigh : t.severityMedium}</span>

                            <span className="font-semibold">{t.actionLabel}</span>
                            <span className="break-words uppercase">{operation}</span>

                            <span className="font-semibold">{t.objectTypeLabel}</span>
                            <span className="break-words uppercase">{objectType}</span>

                            <span className="font-semibold">{t.targetLabel}</span>
                            <span className="break-words">{target}</span>

                            {hasSequenceContext && analysis.statementIndex && analysis.statementCount && (
                                <>
                                    <span className="font-semibold">{t.statementLabel}</span>
                                    <span>{t.sequenceStepValue(analysis.statementIndex, analysis.statementCount)}</span>

                                    <span className="font-semibold">{t.flaggedCountLabel}</span>
                                    <span>{t.flaggedCountValue(flaggedStatementCount)}</span>
                                </>
                            )}

                            <span className="font-semibold">{t.scopeLabel}</span>
                            <span>{scope}</span>

                            <span className="font-semibold">{t.reasonLabel}</span>
                            <span className="break-words normal-case">{detail}</span>
                        </div>
                    </div>

                    <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                        <p className="mb-3 text-sm font-semibold text-foreground">{t.checklistTitle}</p>
                        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                            {checklist.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>

                    {analysis.statement && (
                        <div className="rounded-md border border-border/70 bg-background/60 p-4">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                {t.sqlPreview}
                            </p>
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-foreground">
                                {analysis.statement}
                            </pre>
                        </div>
                    )}

                    {(aiExplanation || aiError) && (
                        <div className="rounded-md border border-border/70 bg-muted/30 p-4 text-sm text-foreground">
                            <p className="mb-2 font-semibold">{t.aiTitle}</p>
                            <p className="whitespace-pre-wrap leading-6 text-muted-foreground">
                                {aiExplanation || aiError}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:justify-between">
                    {canExplainWithAi ? (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleExplainWithAi()}
                            disabled={isExplaining}
                            className="gap-2 sm:mr-auto"
                        >
                            {isExplaining ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                            {isExplaining ? t.aiLoading : t.aiExplain}
                        </Button>
                    ) : <div className="hidden sm:block" />}
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button type="button" variant="outline" onClick={handleCancel}>
                            {t.cancel}
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleConfirm}>
                            {isHighSeverity ? t.confirmHigh : t.confirmMedium}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


