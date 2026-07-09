import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AiMarkdownContentProps {
    content: string;
}

type CodeProps = React.ComponentProps<'code'> & {
    inline?: boolean;
};

const getCodeText = (children: React.ReactNode) => String(children).replace(/\n$/, '');

export const AiMarkdownContent: React.FC<AiMarkdownContentProps> = ({ content }) => {
    const [copiedBlock, setCopiedBlock] = useState<string | null>(null);

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedBlock(text);
            window.setTimeout(() => {
                setCopiedBlock((current) => (current === text ? null : current));
            }, 1500);
        } catch (error) {
            console.error('Failed to copy code block', error);
        }
    };

    return (
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
                    pre({ children }: React.ComponentProps<'pre'>) {
                        const codeChild = React.Children.toArray(children)[0];
                        const text = React.isValidElement<{ children?: React.ReactNode }>(codeChild)
                            ? getCodeText(codeChild.props.children)
                            : '';
                        const isCopied = copiedBlock === text;

                        return (
                            <div className="not-prose my-3 overflow-hidden rounded-2xl border border-slate-800 bg-[#050816]">
                                <div className="relative">
                                    <button
                                        type="button"
                                        className="absolute right-2.5 top-2.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                                        onClick={() => void handleCopy(text)}
                                        title={isCopied ? 'Copied' : 'Copy code'}
                                        aria-label={isCopied ? 'Copied' : 'Copy code'}
                                    >
                                        {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                    <pre className="m-0 overflow-x-auto bg-transparent p-4 pr-14">
                                        {children}
                                    </pre>
                                </div>
                            </div>
                        );
                    },
                    code({ inline, className, children, ...props }: CodeProps) {
                        const text = getCodeText(children);
                        const isBlockCode = inline === false || Boolean(className) || text.includes('\n');

                        return isBlockCode ? (
                            <code
                                className={`${className ?? ''} block min-w-max whitespace-pre font-mono text-[12px] leading-relaxed text-slate-100`}
                                {...props}
                            >
                                {text}
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
};
