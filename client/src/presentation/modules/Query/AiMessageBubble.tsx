import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { ChevronDown, Play, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { AiMessage } from '@/core/services/store';
import { useAppStore } from '@/core/services/store';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiMessageBubbleProps {
    msg: AiMessage;
    onInsertQuery: (sql: string) => void;
    onRunQuery: (sql: string) => void;
}

export const AiMessageBubble: React.FC<AiMessageBubbleProps> = ({ msg, onInsertQuery, onRunQuery }) => {
    const { user, activeConnectionId, connections } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const isNoSql = activeConnection?.type === 'mongodb' || activeConnection?.type === 'mongodb+srv';

    return (
        <div className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
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

            <div className={`max-w-[85%] rounded-lg p-2.5 text-xs leading-relaxed select-text cursor-text ${msg.role === 'user'
                ? 'bg-violet-500/20 text-foreground'
                : msg.error
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-muted/30 text-foreground/80 border border-border/30'
                }`}>
                {msg.role === 'ai' && msg.modelInfo && !msg.error && (
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-violet-300">
                            {msg.modelInfo.provider || 'ai'}
                        </span>
                        {msg.modelInfo.model && <span>{msg.modelInfo.model}</span>}
                    </div>
                )}

                {msg.role === 'user' ? (
                    <div className="flex flex-col gap-2">
                        {/* Render Images if present */}
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
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0 prose-td:border prose-th:border prose-table:border-collapse prose-table:w-full prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2 prose-a:text-violet-400 select-text">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            skipHtml
                            components={{
                                a: ({ node, className, ...props }: any) => <a className={className || "text-violet-400 hover:underline"} {...props} target="_blank" rel="noopener noreferrer" />,
                                code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                        <SyntaxHighlighter
                                            {...props}
                                            style={vscDarkPlus as any}
                                            language={match[1]}
                                            PreTag="div"
                                            className="rounded-md my-2"
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    );
                                }
                            }}
                        >
                            {msg.content}
                        </ReactMarkdown>
                    </div>
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
                                <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted/50" onClick={() => navigator.clipboard.writeText(msg.sql!)} title={isNoSql ? 'Copy MQL' : 'Copy SQL'}>
                                    <Copy className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                        <pre className={cn("p-2 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap", isNoSql ? "text-emerald-400" : "text-cyan-400")}>{msg.sql}</pre>
                    </div>
                )}
            </div>
        </div>
    );
};
