import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { ChevronDown, Play, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { AiMessage } from '@/core/services/store';

interface AiMessageBubbleProps {
    msg: AiMessage;
    onInsertSql: (sql: string) => void;
    onRunSql: (sql: string) => void;
}

export const AiMessageBubble: React.FC<AiMessageBubbleProps> = ({ msg, onInsertSql, onRunSql }) => {
    return (
        <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-lg p-2.5 text-xs leading-relaxed select-text cursor-text ${msg.role === 'user'
                    ? 'bg-violet-500/20 text-foreground ml-4'
                    : msg.error
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-muted/30 text-foreground/80 border border-border/30'
                }`}>
                {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0 prose-td:border prose-th:border prose-table:border-collapse prose-table:w-full prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2 prose-a:text-violet-400 select-text">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
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
                            <span className="text-[9px] text-muted-foreground font-mono">SQL</span>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-green-500/20" onClick={() => onInsertSql(msg.sql!)} title="Insert vào Editor">
                                    <ChevronDown className="w-3 h-3 text-green-400" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-blue-500/20" onClick={() => { onInsertSql(msg.sql!); onRunSql(msg.sql!); }} title="Chạy ngay">
                                    <Play className="w-3 h-3 text-blue-400" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted/50" onClick={() => navigator.clipboard.writeText(msg.sql!)} title="Copy SQL">
                                    <Copy className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                        <pre className="p-2 text-[11px] font-mono text-cyan-400 overflow-x-auto whitespace-pre-wrap">{msg.sql}</pre>
                    </div>
                )}
            </div>
        </div>
    );
};
