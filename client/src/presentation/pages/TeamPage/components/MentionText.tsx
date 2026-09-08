import type { CollaborationParticipant } from '@/core/services/CollaborationService';
import type { ComposerMember } from './CommentComposer';

function buildMentionPattern() {
    return /@([\w.+-]+@[\w.-]+\.[a-z]{2,})/gi;
}

interface MentionTextProps {
    body: string;
    members?: ComposerMember[];
    className?: string;
}

function displayName(
    email: string,
    members?: ComposerMember[],
): { label: string; title: string } {
    const member = members?.find(
        (candidate) => candidate.email.toLowerCase() === email.toLowerCase(),
    );
    if (member) {
        const name = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim();
        if (name) return { label: name, title: email };
    }
    return { label: email, title: email };
}

/**
 * Renders comment body text with @email mentions highlighted as chips,
 * like Slack/Discord — the raw text stays in storage, presentation only.
 */
export function MentionText({ body, members, className }: MentionTextProps) {
    const nodes: Array<string | { mention: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const pattern = buildMentionPattern();

    while ((match = pattern.exec(body)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(body.slice(lastIndex, match.index));
        }
        nodes.push({ mention: match[1] });
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
                const { label, title } = displayName(node.mention, members);
                return (
                    <span
                        key={index}
                        title={title}
                        className="mx-0.5 inline-flex items-center rounded-md bg-primary/15 px-1.5 py-0.5 text-[13px] font-medium text-primary"
                    >
                        @{label}
                    </span>
                );
            })}
        </span>
    );
}

export type { CollaborationParticipant };
