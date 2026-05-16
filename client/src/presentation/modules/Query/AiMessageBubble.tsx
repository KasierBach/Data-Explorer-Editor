import React, { Suspense, useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { 
    ChevronDown, Play, Copy, Database, LineChart, Wrench, 
    Pencil, Trash2, Check, X as CloseIcon, RotateCcw
} from 'lucide-react';
import type { AiMessage } from '@/core/services/store';
import { useAppStore } from '@/core/services/store';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const AiMarkdownContent = React.lazy(() => import('./AiMarkdownContent').then((module) => ({ default: module.AiMarkdownContent })));

type FieldSizingStyle = React.CSSProperties & {
    fieldSizing?: 'content';
};

interface AiMessageBubbleProps {
    msg: AiMessage;
    onInsertQuery: (sql: string) => void;
    onRunQuery: (sql: string) => void;
    onRegenerate?: (messageId: string) => void;
    onEditSubmit?: (messageId: string, newContent: string) => void;
}

export const AiMessageBubble: React.FC<AiMessageBubbleProps> = React.memo(({ 
    msg, onInsertQuery, onRunQuery, onRegenerate, onEditSubmit 
}) => {
    const { user, activeConnectionId, connections, deleteAiMessage, activeAiChatId } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const isNoSql = activeConnection?.type === 'mongodb' || activeConnection?.type === 'mongodb+srv';

    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(msg.content);

    const handleEditSave = () => {
        if (editContent.trim() && editContent !== msg.content) {
            onEditSubmit?.(msg.id, editContent);
        }
        setIsEditing(false);
    };

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            console.error('Failed to copy', e);
        }
    };

    const handleDelete = async () => {
        if (activeAiChatId && window.confirm('Xóa tin nhắn này?')) {
            try {
                await deleteAiMessage(activeAiChatId, msg.id);
            } catch (e) {
                console.error("Failed to delete", e);
            }
        }
    };

    const recommendationMeta: Record<string, { label: string; icon: React.ElementType; tone: string }> = {
        query_fix: { label: 'Query Fix', icon: Wrench, tone: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/10' },
        index_suggestion: { label: 'Index', icon: Database, tone: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10' },
        schema_suggestion: { label: 'Schema', icon: Database, tone: 'text-amber-300 border-amber-500/20 bg-amber-500/10' },
        chart_suggestion: { label: 'Chart', icon: LineChart, tone: 'text-fuchsia-300 border-fuchsia-500/20 bg-fuchsia-500/10' },
    };

    return (
        <div className={cn(
            "group/bubble flex items-start gap-3",
            msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
        )}>
            {/* Avatar */}
            <div className="shrink-0 pt-0.5">
                {msg.role === 'user' ? (
                    <div className="h-7 w-7 rounded-full bg-muted border border-border/50 overflow-hidden relative flex items-center justify-center">
                        {user?.avatarUrl ? (
                            <>
                                <img 
                                    src={user.avatarUrl} 
                                    className="h-full w-full object-cover relative z-10" 
                                    alt="User"
                                    onError={(e) => (e.target as HTMLImageElement).classList.add('hidden')}
                                />
                                <div className="absolute inset-0 flex items-center justify-center text-blue-500 font-bold text-[10px] z-0">
                                    {(user.firstName || user.name || user.email || 'U').charAt(0).toUpperCase()}
                                </div>
                            </>
                        ) : (
                            <span className="text-blue-500 font-bold text-[10px]">
                                {(user?.firstName || user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="h-7 w-7 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-violet-500" />
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-1 max-w-[85%]">
                <div className={cn(
                    "relative rounded-xl p-2.5 text-xs leading-relaxed select-text cursor-text transition-all",
                    msg.role === 'user'
                        ? 'bg-violet-500/20 text-foreground border border-violet-500/10 shadow-sm'
                        : msg.error
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-muted/30 text-foreground/80 border border-border/30'
                )}>
                    {msg.role === 'ai' && msg.modelInfo && !msg.error && (
                        <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-violet-300">
                                {msg.modelInfo.provider || 'ai'}
                            </span>
                            {msg.modelInfo.model && <span>{msg.modelInfo.model}</span>}
                        </div>
                    )}

                    {msg.role === 'ai' && msg.thought && (
                        <div className="mb-3">
                            <details className="group/thought">
                                <summary className="flex items-center gap-1 cursor-pointer select-none text-[10.5px] text-muted-foreground/60 font-medium list-none py-1 hover:text-muted-foreground/80 transition-colors [&::-webkit-details-marker]:hidden">
                                    <ChevronDown className="w-3.5 h-3.5 group-open/thought:rotate-180 transition-transform duration-200" />
                                    <span>Reasoning</span>
                                </summary>
                                <div className="ml-1.5 mt-1 pl-3 border-l-[1.5px] border-muted-foreground/20 text-[10.5px] text-muted-foreground/50 italic leading-relaxed">
                                    {msg.thought}
                                </div>
                            </details>
                        </div>
                    )}

                    {isEditing ? (
                        <div className="flex flex-col gap-2 w-full">
                            <textarea
                                aria-label="Edit message"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full bg-background/40 border border-violet-500/40 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-violet-500/50 resize-none min-h-[100px]"
                                autoFocus
                                style={{ fieldSizing: "content" } satisfies FieldSizingStyle}
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-medium hover:bg-muted/50" onClick={() => setIsEditing(false)}>
                                    <CloseIcon className="w-3.5 h-3.5 mr-1.5" /> Hủy
                                </Button>
                                <Button variant="default" size="sm" className="h-8 px-4 text-xs font-semibold bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-500/20" onClick={handleEditSave}>
                                    <Check className="w-3.5 h-3.5 mr-1.5" /> Lưu & Gửi
                                </Button>
                            </div>
                        </div>
                    ) : msg.role === 'user' ? (
                        <div className="flex flex-col gap-2">
                            {msg.attachments?.filter(a => a.type === 'image' && a.preview).length ? (
                                <div className="flex flex-wrap gap-2">
                                    {msg.attachments.filter(a => a.type === 'image' && a.preview).map((img, i) => (
                                        <div key={i} className="relative rounded-md overflow-hidden border border-border/10">
                                            <img src={img.preview} alt={img.label} className="max-w-[240px] max-h-[160px] object-cover" />
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            {msg.content && <div className="whitespace-pre-wrap">{msg.content}</div>}
                        </div>
                    ) : (
                        <Suspense fallback={<div className="whitespace-pre-wrap">{msg.content}</div>}>
                            <AiMarkdownContent content={msg.content} />
                        </Suspense>
                    )}

                    {msg.sql && (
                        <div className="mt-2 rounded-md overflow-hidden border border-border/50 bg-background/50">
                            <div className="flex items-center justify-between px-2 py-1 bg-muted/20 border-b border-border/30">
                                <span className="text-[9px] text-muted-foreground font-mono">{isNoSql ? 'MQL' : 'SQL'}</span>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-green-500/20" onClick={() => onInsertQuery(msg.sql!)} title="Insert vào Editor">
                                        <ChevronDown className="w-3 h-3 text-green-400" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-blue-500/20" onClick={() => { onInsertQuery(msg.sql!); onRunQuery(msg.sql!); }} title="Chạy ngay">
                                        <Play className="w-3 h-3 text-blue-400" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted/50" onClick={() => handleCopy(msg.sql!)} title={isNoSql ? 'Copy MQL' : 'Copy SQL'} aria-label="Copy SQL">
                                        <Copy className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                            <pre className={cn("p-2 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap", isNoSql ? "text-emerald-400" : "text-cyan-400")}>{msg.sql}</pre>
                        </div>
                    )}

                    {msg.recommendations && msg.recommendations.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {msg.recommendations.map((recommendation, index) => {
                                const meta = recommendationMeta[recommendation.type] || recommendationMeta.query_fix;
                                const Icon = meta.icon;

                                return (
                                    <div key={`${recommendation.type}-${index}`} className="rounded-lg border border-border/40 bg-background/40 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", meta.tone)}>
                                                        <Icon className="h-3 w-3" />
                                                        {meta.label}
                                                    </span>
                                                </div>
                                                <div className="mt-2 font-medium text-foreground">{recommendation.title}</div>
                                                <div className="mt-1 text-[11px] text-muted-foreground">{recommendation.summary}</div>
                                                {recommendation.fields && recommendation.fields.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {recommendation.fields.map((field) => (
                                                            <span key={field} className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                                                                {field}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {recommendation.chartType && (
                                                    <div className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                                                        Suggested chart: {recommendation.chartType}
                                                    </div>
                                                )}
                                            </div>

                                            {recommendation.sql && (
                                                <div className="flex gap-1 shrink-0">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-green-500/20" onClick={() => onInsertQuery(recommendation.sql!)} title="Insert into editor">
                                                        <ChevronDown className="w-3 h-3 text-green-400" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-blue-500/20" onClick={() => { onInsertQuery(recommendation.sql!); onRunQuery(recommendation.sql!); }} title="Run suggestion">
                                                        <Play className="w-3 h-3 text-blue-400" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted/50" onClick={() => handleCopy(recommendation.sql!)} title="Copy suggestion" aria-label="Copy suggestion SQL">
                                                        <Copy className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className={cn(
                    "flex items-center gap-0.5 mt-1 transition-opacity duration-200",
                    "opacity-0 group-hover/bubble:opacity-100",
                    msg.role === 'user' ? "justify-end mr-1" : "justify-start ml-1"
                )}>
                    {msg.role === 'user' && !isEditing && !!onEditSubmit && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground/60 hover:text-foreground" onClick={() => { setIsEditing(true); setEditContent(msg.content); }} title="Chỉnh sửa" aria-label="Edit message">
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground/60 hover:text-foreground" onClick={() => handleCopy(msg.content)} title="Sao chép" aria-label="Copy message">
                        <Copy className="w-3.5 h-3.5" />
                    </Button>
                    {msg.role === 'ai' && !msg.error && onRegenerate && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground/60 hover:text-foreground" onClick={() => onRegenerate(msg.id)} title="Thử lại" aria-label="Regenerate message">
                            <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-red-500/10 text-muted-foreground/60 hover:text-red-400" onClick={handleDelete} title="Xóa" aria-label="Delete message">
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
});
