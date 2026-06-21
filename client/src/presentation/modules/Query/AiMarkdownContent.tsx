import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AiMarkdownContentProps {
    content: string;
}

type CodeProps = React.ComponentProps<'code'> & {
    inline?: boolean;
};

export const AiMarkdownContent: React.FC<AiMarkdownContentProps> = ({ content }) => (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-2 prose-ol:my-3 prose-ul:my-3 prose-li:my-1 prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-muted/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:text-foreground prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0 prose-td:border prose-th:border prose-table:w-full prose-table:border-collapse prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2 prose-a:text-violet-400 select-text">
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            skipHtml
            components={{
                a: ({ className, ...props }: React.ComponentProps<'a'>) => (
                    <a
                        className={className || 'text-violet-400 hover:underline'}
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"
                    />
                ),
                code({ inline, className, children, ...props }: CodeProps) {
                    const text = String(children).replace(/\n$/, '');
                    const isBlockCode = inline === false || Boolean(className) || text.includes('\n');

                    return isBlockCode ? (
                        <pre className="my-3 overflow-x-auto rounded-xl border border-border/70 bg-slate-950 p-0">
                            <code
                                className="block px-4 py-3 text-[12px] leading-relaxed text-slate-100"
                                {...props}
                            >
                                {text}
                            </code>
                        </pre>
                    ) : (
                        <code className={className} {...props}>
                            {children}
                        </code>
                    );
                },
            }}
        >
            {content}
        </ReactMarkdown>
    </div>
);
