import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AiMarkdownContentProps {
    content: string;
}

export const AiMarkdownContent: React.FC<AiMarkdownContentProps> = ({ content }) => (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0 prose-td:border prose-th:border prose-table:border-collapse prose-table:w-full prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2 prose-a:text-violet-400 select-text">
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            skipHtml
            components={{
                a: ({ className, ...props }: any) => (
                    <a
                        className={className || 'text-violet-400 hover:underline'}
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"
                    />
                ),
                code({ inline, className, children, ...props }: any) {
                    return !inline ? (
                        <code
                            className="block overflow-x-auto rounded-md border border-border bg-slate-950 px-3 py-2 text-[12px] leading-relaxed text-slate-100"
                            {...props}
                        >
                            {String(children).replace(/\n$/, '')}
                        </code>
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
