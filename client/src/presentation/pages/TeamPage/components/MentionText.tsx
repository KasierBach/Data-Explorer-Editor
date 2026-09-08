import type { ComposerMember } from './CommentComposer';

/** Matches @username, @firstname, or @email tokens in comment bodies. */
function buildMentionPattern() {
    return /@([\w.+-]+(?:@[\w.-]+\.[a-z]{2,})?)/gi;
}

interface MentionTextProps {
    body: string;
    members?: ComposerMember[];
    className?: string;
}

function findMember(token: string, members?: ComposerMember[]) {
    if (!members) return undefined;
    const lower = token.toLowerCase();
    return members.find((member) => {
        if (member.email.toLowerCase() === lower) return true;
        if (member.username && member.username.toLowerCase() === lower) return true;
        if (member.firstName && member.firstName.toLowerCase() === lower) return true;
        return false;
    });
}

function displayName(token: string, members?: ComposerMember[]) {
    const member = findMember(token, members);
    if (member) {
        const name = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim();
        if (name) return { label: name, title: member.email };
    }
    return { label: token, title: token };
}

/**
 * Renders comment body text with @mentions highlighted as chips —
 * the raw text stays in storage, presentation only.
 */
export function MentionText({ body, members, className }: MentionTextProps) {
    const nodes: Array<string | { token: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const pattern = buildMentionPattern();

    while ((match = pattern.exec(body)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(body.slice(lastIndex, match.index));
        }
        nodes.push({ token: match[1] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < body.length) {
        nodes.push(body.slice(lastIndex));
    }

    if (nodes.length === 0) {
        return <span className={className}>{body}</span>;
    }

    return (
        <span className={className}>
            {nodes.map((node, index) => {
                if (typeof node === 'string') {
                    return <span key={index}>{node}</span>;
                }
                const { label, title } = displayName(node.token, members);
                return (
                    <span
                        key={index}
                        title={title}
                        className="mx-0.5 inline-flex items-center rounded-md bg-primary/15 px-1.5 py-0.5 text-[13px] font-semibold text-primary"
                    >
                        @{label}
                    </span>
                );
            })}
        </span>
    );
}
