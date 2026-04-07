import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface AiMarkdownContentProps {
    content: string;
}

export const AiMarkdownContent: React.FC<AiMarkdownContentProps> = ({ content }) => (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0 prose-td:border prose-th:border prose-table:border-collapse prose-table:w-full prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2 prose-a:text-violet-400 select-text">
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            skipHtml
            components={{
                a: ({ node, className, ...props }: any) => (
                    <a
                        className={className || 'text-violet-400 hover:underline'}
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"
                    />
                ),
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
                },
            }}
        >
            {content}
        </ReactMarkdown>
    </div>
);
