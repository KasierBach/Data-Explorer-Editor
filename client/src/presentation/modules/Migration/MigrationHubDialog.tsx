import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, Loader2, CheckCircle2, XCircle, Database, ArrowRight } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { useAppStore } from '@/core/services/store';
import { migrationService, type MigrationJob, type StartMigrationPayload } from '@/core/services/MigrationService';

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

    // Prefill source from props
    useEffect(() => {
        if (sourceConnectionId) setSrcConnId(sourceConnectionId);
        if (sourceSchema) setSrcSchema(sourceSchema);
        if (sourceTable) setSrcTable(sourceTable);
    }, [sourceConnectionId, sourceSchema, sourceTable]);

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
        } catch (err: any) {
            setJob({ id: '', status: 'failed', processedRows: 0, error: err.message });
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
    const canStart = srcConnId && srcTable && tgtConnId && tgtTable && !isRunning && !isStarting && !sourceBlocked && !targetBlocked && !sameEndpoint;

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
