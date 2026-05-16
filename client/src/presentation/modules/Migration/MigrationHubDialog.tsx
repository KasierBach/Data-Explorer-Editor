import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, Loader2, CheckCircle2, XCircle, Database, ArrowRight, AlertTriangle, RefreshCw, GitCompareArrows } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { useAppStore } from '@/core/services/store';
import { migrationService, type MigrationJob, type MigrationReviewSummary, type StartMigrationPayload } from '@/core/services/MigrationService';

interface MigrationHubDialogProps {
    isOpen: boolean;
    onClose: () => void;
    /** Pre-filled source info from the current DataGrid context */
    sourceConnectionId?: string;
    sourceSchema?: string;
    sourceTable?: string;
}

export const MigrationHubDialog: React.FC<MigrationHubDialogProps> = ({
    isOpen,
    onClose,
    sourceConnectionId,
    sourceSchema,
    sourceTable,
}) => {
    const { connections } = useAppStore();

    // Source state
    const [srcConnId, setSrcConnId] = useState(sourceConnectionId || '');
    const [srcSchema, setSrcSchema] = useState(sourceSchema || '');
    const [srcTable, setSrcTable] = useState(sourceTable || '');

    // Target state
    const [tgtConnId, setTgtConnId] = useState('');
    const [tgtSchema, setTgtSchema] = useState('');
    const [tgtTable, setTgtTable] = useState('');

    // Job tracking
    const [job, setJob] = useState<MigrationJob | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [review, setReview] = useState<MigrationReviewSummary | null>(null);
    const [isReviewing, setIsReviewing] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);

    // Prefill source from props
    useEffect(() => {
        if (sourceConnectionId) setSrcConnId(sourceConnectionId);
        if (sourceSchema) setSrcSchema(sourceSchema);
        if (sourceTable) setSrcTable(sourceTable);
    }, [sourceConnectionId, sourceSchema, sourceTable]);

    useEffect(() => {
        if (!isOpen) {
            setReview(null);
            setReviewError(null);
            setIsReviewing(false);
            setJob(null);
            return;
        }

        const normalizedSourceSchema = srcSchema.trim();
        const normalizedTargetSchema = tgtSchema.trim();
        const normalizedSourceTable = srcTable.trim();
        const normalizedTargetTable = tgtTable.trim();
        const sameEndpoint = !!srcConnId && !!tgtConnId &&
            srcConnId === tgtConnId &&
            normalizedSourceSchema === normalizedTargetSchema &&
            normalizedSourceTable !== '' &&
            normalizedSourceTable === normalizedTargetTable;

        if (!srcConnId || !normalizedSourceTable || !tgtConnId || !normalizedTargetTable || sameEndpoint) {
            setReview(null);
            setReviewError(null);
            setIsReviewing(false);
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(() => {
            if (cancelled) return;
            setIsReviewing(true);
            setReviewError(null);

            void migrationService.previewMigration({
                sourceConnectionId: srcConnId,
                sourceSchema: normalizedSourceSchema,
                sourceTable: normalizedSourceTable,
                targetConnectionId: tgtConnId,
                targetSchema: normalizedTargetSchema,
                targetTable: normalizedTargetTable,
            }).then((summary) => {
                if (!cancelled) {
                    setReview(summary);
                }
            }).catch((error) => {
                if (!cancelled) {
                    setReview(null);
                    setReviewError(error instanceof Error ? error.message : 'Failed to preview migration');
                }
            }).finally(() => {
                if (!cancelled) {
                    setIsReviewing(false);
                }
            });
        }, 450);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [isOpen, srcConnId, srcSchema, srcTable, tgtConnId, tgtSchema, tgtTable]);

    const handleStart = useCallback(async () => {
        if (!srcConnId || !srcTable || !tgtConnId || !tgtTable) return;

        setIsStarting(true);
        try {
            const payload: StartMigrationPayload = {
                sourceConnectionId: srcConnId,
                sourceSchema: srcSchema,
                sourceTable: srcTable,
                targetConnectionId: tgtConnId,
                targetSchema: tgtSchema,
                targetTable: tgtTable,
            };

            const { jobId } = await migrationService.startMigration(payload);

            // Subscribe to SSE progress
            migrationService.subscribeToProgress(
                jobId,
                (updatedJob) => setJob(updatedJob),
                (errMsg) => setJob(prev => {
                    // Only set error from SSE closure if we don't have a terminal status yet
                    if (prev && (prev.status === 'completed' || prev.status === 'failed')) {
                        return prev;
                    }
                    return prev ? { ...prev, status: 'failed', error: errMsg } : null;
                }),
            );
        } catch (err) {
            setJob({ id: '', status: 'failed', processedRows: 0, error: err instanceof Error ? err.message : 'Migration failed' });
        } finally {
            setIsStarting(false);
        }
    }, [srcConnId, srcSchema, srcTable, tgtConnId, tgtSchema, tgtTable]);

    if (!isOpen) return null;

    const srcConn = connections.find(c => c.id === srcConnId);
    const tgtConn = connections.find(c => c.id === tgtConnId);
    const isRunning = job?.status === 'running';
    const isCompleted = job?.status === 'completed';
    const isFailed = job?.status === 'failed';
    const normalizedSourceSchema = srcSchema.trim();
    const normalizedTargetSchema = tgtSchema.trim();
    const normalizedSourceTable = srcTable.trim();
    const normalizedTargetTable = tgtTable.trim();
    const sameEndpoint = !!srcConnId && !!tgtConnId &&
        srcConnId === tgtConnId &&
        normalizedSourceSchema === normalizedTargetSchema &&
        normalizedSourceTable !== '' &&
        normalizedSourceTable === normalizedTargetTable;
    const sourceBlocked = !!srcConn && (srcConn.allowQueryExecution === false);
    const targetBlocked = !!tgtConn && (
        tgtConn.readOnly ||
        tgtConn.allowImportExport === false ||
        tgtConn.allowSchemaChanges === false ||
        tgtConn.allowQueryExecution === false
    );
    const canStart = srcConnId && srcTable && tgtConnId && tgtTable && !isRunning && !isStarting && !sourceBlocked && !targetBlocked && !sameEndpoint && !isReviewing && review?.canProceed === true;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-xl shadow-2xl w-[600px] max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 shrink-0">
                    <div className="flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                        <h2 className="text-base font-semibold">Data Transfer Hub</h2>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Stream data between databases — supports SQL ↔ NoSQL (millions of rows)
                    </p>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                    {/* Source & Target Side by Side */}
                    <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-start">
                        {/* Source */}
                        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                                <Database className="w-3.5 h-3.5" />
                                SOURCE
                            </div>
                            <select
                                value={srcConnId}
                                onChange={(e) => setSrcConnId(e.target.value)}
                                className="w-full h-8 text-xs rounded border bg-background px-2 focus:ring-1 focus:ring-indigo-500"
                                disabled={isRunning}
                            >
                                <option value="">Select connection...</option>
                                {connections.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                placeholder="Schema (e.g. public)"
                                value={srcSchema}
                                onChange={(e) => setSrcSchema(e.target.value)}
                                className="w-full h-8 text-xs rounded border bg-background px-2 focus:ring-1 focus:ring-indigo-500"
                                disabled={isRunning}
                            />
                            <input
                                type="text"
                                placeholder="Table name"
                                value={srcTable}
                                onChange={(e) => setSrcTable(e.target.value)}
                                className="w-full h-8 text-xs rounded border bg-background px-2 focus:ring-1 focus:ring-indigo-500"
                                disabled={isRunning}
                            />
                        </div>

                        {/* Arrow */}
                        <div className="flex items-center justify-center pt-8">
                            <div className="p-2 rounded-full bg-indigo-500/20 border border-indigo-500/30">
                                <ArrowRight className="w-4 h-4 text-indigo-400" />
                            </div>
                        </div>

                        {/* Target */}
                        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-400">
                                <Database className="w-3.5 h-3.5" />
                                TARGET
                            </div>
                            <select
                                value={tgtConnId}
                                onChange={(e) => setTgtConnId(e.target.value)}
                                className="w-full h-8 text-xs rounded border bg-background px-2 focus:ring-1 focus:ring-blue-500"
                                disabled={isRunning}
                            >
                                <option value="">Select connection...</option>
                                {connections.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                placeholder="Schema (e.g. public)"
                                value={tgtSchema}
                                onChange={(e) => setTgtSchema(e.target.value)}
                                className="w-full h-8 text-xs rounded border bg-background px-2 focus:ring-1 focus:ring-blue-500"
                                disabled={isRunning}
                            />
                            <input
                                type="text"
                                placeholder="Table name"
                                value={tgtTable}
                                onChange={(e) => setTgtTable(e.target.value)}
                                className="w-full h-8 text-xs rounded border bg-background px-2 focus:ring-1 focus:ring-blue-500"
                                disabled={isRunning}
                            />
                        </div>
                    </div>

                    {/* Info Banner */}
                    {srcConn && tgtConn && (
                        <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-2.5 border flex items-center gap-2">
                            <span className="font-medium text-foreground">{srcConn.name}</span>
                            <span className="text-muted-foreground">({srcConn.type})</span>
                            <ArrowRight className="w-3 h-3 text-indigo-400" />
                            <span className="font-medium text-foreground">{tgtConn.name}</span>
                            <span className="text-muted-foreground">({tgtConn.type})</span>
                        </div>
                    )}

                    {(sourceBlocked || targetBlocked) && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-400">
                            {sourceBlocked
                                ? 'Source connection must allow query execution before transfer can start.'
                                : 'Target connection must allow query execution, schema changes, and import/export to receive transferred data.'}
                        </div>
                    )}

                    {(reviewError || review || isReviewing) && (
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                            <div className="flex items-center gap-2">
                                <GitCompareArrows className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Migration review
                                </span>
                                {isReviewing && <RefreshCw className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                            </div>

                            {reviewError && (
                                <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                                    {reviewError}
                                </div>
                            )}

                            {review && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div className="rounded-md border border-border/60 bg-background p-3 text-xs">
                                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Source</div>
                                            <div className="mt-1 font-medium">{review.source.connectionName}</div>
                                            <div className="text-muted-foreground">{review.source.schema}.{review.source.table}</div>
                                            <div className="mt-1 text-[11px] text-muted-foreground">
                                                {review.source.columnCount} columns · {review.source.indexCount} indices
                                                {review.source.rowCount !== null && ` · ${review.source.rowCount.toLocaleString()} rows`}
                                            </div>
                                        </div>
                                        <div className="rounded-md border border-border/60 bg-background p-3 text-xs">
                                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</div>
                                            <div className="mt-1 font-medium">{review.target.connectionName}</div>
                                            <div className="text-muted-foreground">{review.target.schema}.{review.target.table}</div>
                                            <div className="mt-1 text-[11px] text-muted-foreground">
                                                {review.target.columnCount} columns · {review.target.indexCount} indices
                                                {review.target.rowCount !== null && ` · ${review.target.rowCount.toLocaleString()} rows`}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                                        {[
                                            ['Added columns', review.estimatedImpact.addedColumns],
                                            ['Removed columns', review.estimatedImpact.removedColumns],
                                            ['Changed columns', review.estimatedImpact.changedColumns],
                                            ['Added indices', review.estimatedImpact.addedIndices],
                                            ['Removed indices', review.estimatedImpact.removedIndices],
                                            ['Changed indices', review.estimatedImpact.changedIndices],
                                        ].map(([label, value]) => (
                                            <div key={label as string} className="rounded-md border border-border/60 bg-background px-2 py-2 text-center">
                                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label as string}</div>
                                                <div className="mt-1 text-base font-semibold">{value as number}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {review.blockers.length > 0 && (
                                        <div className="space-y-2 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                                            <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-red-200">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                Blockers
                                            </div>
                                            <ul className="space-y-1">
                                                {review.blockers.map((blocker) => (
                                                    <li key={blocker}>• {blocker}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {review.warnings.length > 0 && (
                                        <div className="space-y-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                                            <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-amber-200">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                Warnings
                                            </div>
                                            <ul className="space-y-1">
                                                {review.warnings.map((warning) => (
                                                    <li key={warning}>• {warning}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Column diff</div>
                                        <div className="max-h-36 space-y-1 overflow-auto">
                                            {review.columnDiffs.slice(0, 8).map((diff) => (
                                                <div key={diff.name} className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-xs">
                                                    <div className="min-w-0">
                                                        <div className="font-medium">{diff.name}</div>
                                                        <div className="text-muted-foreground">
                                                            {diff.changes.length > 0 ? diff.changes.join(' · ') : 'No structural change'}
                                                        </div>
                                                    </div>
                                                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                                        {diff.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-xs text-muted-foreground">
                                        <div className="text-[10px] uppercase tracking-wider">Rollback caveats</div>
                                        <ul className="space-y-1">
                                            {review.rollbackCaveats.map((caveat) => (
                                                <li key={caveat}>• {caveat}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {sameEndpoint && (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                            Source and target cannot point to the same table or collection.
                        </div>
                    )}

                    {/* Progress */}
                    {job && (
                        <div className="rounded-lg border p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                {isRunning && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                                {isCompleted && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                {isFailed && <XCircle className="w-4 h-4 text-red-500" />}
                                <span className="text-xs font-medium capitalize">
                                    {job.status === 'running' ? 'Transferring...' :
                                     job.status === 'completed' ? 'Transfer Complete!' :
                                     job.status === 'failed' ? 'Transfer Failed' : job.status}
                                </span>
                            </div>

                            {/* Progress Bar */}
                            {isRunning && (
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 animate-pulse"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            )}

                            <div className="text-xs text-muted-foreground">
                                <span className="font-mono text-foreground">
                                    {job.processedRows.toLocaleString()}
                                </span>
                                {' '}rows transferred
                            </div>

                            {job.stage && (
                                <div className="text-[11px] text-muted-foreground">
                                    Stage: <span className="font-medium text-foreground capitalize">{job.stage}</span>
                                    {typeof job.batchesProcessed === 'number' && (
                                        <span> · Batches: <span className="font-medium text-foreground">{job.batchesProcessed}</span></span>
                                    )}
                                </div>
                            )}

                            {job.error && (
                                <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                                    {job.error}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t flex justify-end gap-2 bg-muted/20 shrink-0">
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
                        {isCompleted || isFailed ? 'Close' : 'Cancel'}
                    </Button>
                    {!isCompleted && (
                        <Button
                            size="sm"
                            onClick={handleStart}
                            disabled={!canStart}
                            className="h-8 text-xs gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg"
                        >
                            {isStarting || isRunning ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Processing...</>
                            ) : (
                                <><ArrowRightLeft className="w-3 h-3" /> Start Transfer</>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
