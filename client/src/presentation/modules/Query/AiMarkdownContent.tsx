import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Globe2, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AiMarkdownContentProps {
    content: string;
}

type CodeProps = React.ComponentProps<'code'> & {
    inline?: boolean;
};

const getCodeText = (children: React.ReactNode) => String(children).replace(/\n$/, '');

const normalizeLegacySourceLabels = (content: string) => {
    let index = 0;
    return content.replace(
        /\[(?:https:\/\/vertexaisearch\.cloud\.google\.com\/[^\]]+|Google Search (?:result|source))\]\((https:\/\/vertexaisearch\.cloud\.google\.com\/[^)]+)\)/g,
        (_match, href: string) => `[Google Search source ${++index}](${href})`,
    );
};

const getLinkDetails = (href: string | undefined, children: React.ReactNode) => {
    const raw = String(children);
    if (!href) return { title: raw };
    try {
        const url = new URL(href);
        if (url.hostname.includes('vertexaisearch.cloud.google.com')) {
            const suffix = ` - ${url.hostname}`;
            return { title: raw.endsWith(suffix) ? raw.slice(0, -suffix.length) : raw, site: 'Google Search' };
        }
        const suffix = ` - ${url.hostname}`;
        if (raw.endsWith(suffix)) {
            return { title: raw.slice(0, -suffix.length), site: url.hostname, favicon: url.hostname };
        }
        if (raw.length < 80) return { title: raw, site: url.hostname, favicon: url.hostname };
        const path = url.pathname.split('/').filter(Boolean).slice(-2).join(' / ');
        return { title: path || url.hostname, site: url.hostname, favicon: url.hostname };
    } catch {
        return { title: raw.slice(0, 64) + (raw.length > 64 ? '...' : '') };
    }
};

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
                    a: ({ className, children, ...props }: React.ComponentProps<'a'>) => {
                        const details = getLinkDetails(props.href, children);
                        const isGoogleRedirect = props.href?.includes('vertexaisearch.cloud.google.com');
                        return (
                            <a
                                className={`${className ?? ''} inline-flex max-w-full items-center gap-2.5 rounded-lg border border-violet-400/20 bg-violet-400/5 px-2.5 py-2 align-bottom text-violet-200 no-underline transition-colors hover:border-violet-300/40 hover:bg-violet-400/10`}
                                {...props}
                                title={props.href}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-400/10">
                                    {isGoogleRedirect ? <Search className="h-3.5 w-3.5" /> : <Globe2 className="h-3.5 w-3.5" />}
                                    {details.favicon ? (
                                        <img
                                            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(details.favicon)}&sz=32`}
                                            alt=""
                                            className="absolute h-4 w-4 rounded-sm"
                                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                                        />
                                    ) : null}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-semibold leading-4">{details.title}</span>
                                    {details.site ? <span className="block truncate text-[10px] leading-4 text-slate-400">{details.site}</span> : null}
                                </span>
                                <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
                            </a>
                        );
                    },
                    li: ({ children, ...props }: React.ComponentProps<'li'>) => {
                        const linkOnly = React.Children.toArray(children).some(
                            (child) => React.isValidElement(child) && child.type === 'a',
                        );
                        return <li className={linkOnly ? 'not-prose -ml-5 list-none py-1' : undefined} {...props}>{children}</li>;
                    },
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
                {normalizeLegacySourceLabels(content)}
            </ReactMarkdown>
        </div>
    );
};
