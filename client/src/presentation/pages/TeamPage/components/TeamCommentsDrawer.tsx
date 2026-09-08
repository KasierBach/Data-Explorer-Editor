import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/presentation/components/ui/dialog';
import { Input } from '@/presentation/components/ui/input';
import {
  Loader2,
  MessageSquare,
  Reply,
  CheckCircle2,
  RotateCcw,
  Pencil,
  Trash2,
  FileText,
} from 'lucide-react';
import {
  CollaborationService,
  type CollaborationThread,
  type CollaborationReply,
  type CollaborationResourceType,
  type CollaborationReactionGroup,
} from '@/core/services/CollaborationService';
import { OrganizationService } from '@/core/services/OrganizationService';
import { useAppStore } from '@/core/services/store';
import { getTeamText } from '../teamI18n';
import { CommentReactionBar } from './CommentReactionBar';
import { MentionText } from './MentionText';
import { CommentComposer, type ComposerMember } from './CommentComposer';
import { toast } from 'sonner';


interface TeamCommentsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  resourceType: CollaborationResourceType | null;
  resourceId: string | null;
  resourceName: string | null;
}

function isImage(dataUrl: string): boolean {
  return /^data:image\//.test(dataUrl);
}

function findReactionGroups(
  threads: CollaborationThread[],
  commentId: string,
): CollaborationReactionGroup[] {
  for (const thread of threads) {
    if (thread.commentId === commentId) return thread.reactions ?? [];
    const reply = thread.replies.find((item) => item.commentId === commentId);
    if (reply) return reply.reactions ?? [];
  }
  return [];
}

/** Flips the current user's reaction optimistically, without a server round-trip. */
function computeOptimisticGroups(
  groups: CollaborationReactionGroup[],
  userId: string,
  emoji: string,
): CollaborationReactionGroup[] {
  const existing = groups.find((group) => group.emoji === emoji);
  if (existing && existing.userIds.includes(userId)) {
    // Remove my reaction.
    const userIds = existing.userIds.filter((id) => id !== userId);
    if (userIds.length === 0) {
      return groups.filter((group) => group.emoji !== emoji);
    }
    return groups.map((group) =>
      group.emoji === emoji
        ? {
          ...group,
          userIds,
          count: userIds.length,
          users: group.users.filter((user) => user.id !== userId),
        }
        : group,
    );
  }

  // Add my reaction.
  if (existing) {
    return groups.map((group) =>
      group.emoji === emoji
        ? { ...group, count: group.count + 1, userIds: [...group.userIds, userId] }
        : group,
    );
  }
  return [...groups, { emoji, count: 1, userIds: [userId], users: [] }];
}

export function TeamCommentsDrawer({
  open,
  onOpenChange,
  organizationId,
  resourceType,
  resourceId,
  resourceName,
}: TeamCommentsDrawerProps) {
  const { lang, user } = useAppStore();
  const text = getTeamText(lang);
  const [threads, setThreads] = useState<CollaborationThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [body, setBody] = useState('');
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const currentUserId = user?.id ?? '';

  const title = useMemo(() => {
    return text.commentsTitle(resourceName);
  }, [resourceName, text]);

  useEffect(() => {
    if (!open || !organizationId || !resourceType || !resourceId) {
      return;
    }

    let mounted = true;
    setLoading(true);

    void (async () => {
      try {
        const data = await CollaborationService.getResourceComments(organizationId, resourceType, resourceId);
        if (mounted) {
          setThreads(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('[TeamCommentsDrawer] Failed to load comments', error);
        toast.error(text.failedLoadComments);
        if (mounted) {
          setThreads([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, organizationId, resourceType, resourceId, text.failedLoadComments]);

  useEffect(() => {
    setBody('');
    setReplyBodies({});
    setReplyingTo(null);
    setAttachments([]);
    setEditingCommentId(null);
    setEditBody('');
  }, [open, resourceType, resourceId]);

  const [composerMembers, setComposerMembers] = useState<ComposerMember[]>([]);

  useEffect(() => {
    if (!open || !organizationId) return;
    let mounted = true;
    void (async () => {
      try {
        const members = await OrganizationService.getMembers(organizationId);
        if (mounted) {
          setComposerMembers(
            members
              .filter((member) => member.user?.email)
              .map((member) => ({
                userId: member.user.id,
                email: member.user.email,
                firstName: member.user.firstName ?? null,
                lastName: member.user.lastName ?? null,
                username: member.user.username ?? null,
                avatarUrl: member.user.avatarUrl ?? null,
              })),
          );
        }
      } catch {
        // Mention autocomplete is best-effort; comments still work without it.
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, organizationId]);

  const submitRootComment = async () => {
    if (!organizationId || !resourceType || !resourceId || !body.trim()) return;
    setSubmitting(true);
    try {
      await CollaborationService.createComment(organizationId, resourceType, resourceId, {
        body: body.trim(),
        ...(attachments.length > 0 ? { attachments } : {}),
      });
      await reloadThreads();
      setBody('');
      setAttachments([]);
    } catch (error) {
      console.error('[TeamCommentsDrawer] Failed to post comment', error);
      toast.error(text.failedPostComment);
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async (threadId: string) => {
    if (!organizationId) return;
    const replyBody = replyBodies[threadId]?.trim();
    if (!replyBody) return;

    setSubmitting(true);
    try {
      await CollaborationService.replyToComment(organizationId, threadId, {
        body: replyBody,
      });
      await reloadThreads();
      setReplyBodies((prev) => ({ ...prev, [threadId]: '' }));
      setReplyingTo(null);
    } catch (error) {
      console.error('[TeamCommentsDrawer] Failed to post reply', error);
      toast.error(text.failedPostReply);
    } finally {
      setSubmitting(false);
    }
  };

  const resolveThread = async (threadId: string) => {
    if (!organizationId) return;
    setSubmitting(true);
    try {
      await CollaborationService.resolveComment(organizationId, threadId);
      await reloadThreads();
    } catch (error) {
      console.error('[TeamCommentsDrawer] Failed to resolve comment', error);
      toast.error(text.failedResolveThread);
    } finally {
      setSubmitting(false);
    }
  };

  const applyReactionGroups = (
    commentId: string,
    groups: CollaborationReactionGroup[],
  ) => {
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.commentId === commentId) {
          return { ...thread, reactions: groups };
        }
        const reply = thread.replies.find((item) => item.commentId === commentId);
        if (reply) {
          return {
            ...thread,
            replies: thread.replies.map((item) =>
              item.commentId === commentId ? { ...item, reactions: groups } : item,
            ),
          };
        }
        return thread;
      }),
    );
  };

  const toggleReaction = async (commentId: string, emoji: string) => {
    if (!organizationId) return;

    // Optimistic update: flip this user's reaction immediately so the UI
    // feels instant, then reconcile with the server's authoritative groups.
    const snapshot = threads;
    const optimistic = computeOptimisticGroups(
      findReactionGroups(threads, commentId),
      currentUserId,
      emoji,
    );
    applyReactionGroups(commentId, optimistic);

    try {
      const groups = await CollaborationService.toggleReaction(organizationId, commentId, emoji);
      applyReactionGroups(commentId, groups);
    } catch (error) {
      console.error('[TeamCommentsDrawer] Failed to toggle reaction', error);
      setThreads(snapshot);
      toast.error(lang === 'vi' ? 'Không thể thả biểu tượng cảm xúc.' : 'Could not toggle the reaction.');
    }
  };

  const startEditing = (commentId: string, currentBody: string) => {
    setEditingCommentId(commentId);
    setEditBody(currentBody);
  };

  const saveEdit = async () => {
    if (!organizationId || !editingCommentId || !editBody.trim()) return;
    setSubmitting(true);
    try {
      await CollaborationService.editComment(organizationId, editingCommentId, editBody.trim());
      await reloadThreads();
      setEditingCommentId(null);
      setEditBody('');
    } catch (error) {
      console.error('[TeamCommentsDrawer] Failed to edit comment', error);
      toast.error(lang === 'vi' ? 'Không thể sửa bình luận.' : 'Could not edit the comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!organizationId) return;
    if (!window.confirm(lang === 'vi' ? 'Xóa bình luận này?' : 'Delete this comment?')) return;
    setSubmitting(true);
    try {
      await CollaborationService.deleteComment(organizationId, commentId);
      await reloadThreads();
    } catch (error) {
      console.error('[TeamCommentsDrawer] Failed to delete comment', error);
      toast.error(lang === 'vi' ? 'Không thể xóa bình luận.' : 'Could not delete the comment.');
    } finally {
      setSubmitting(false);
    }
  };


  async function reloadThreads() {
    if (!open || !organizationId || !resourceType || !resourceId) {
      setThreads([]);
      return;
    }

    const data = await CollaborationService.getResourceComments(organizationId, resourceType, resourceId);
    setThreads(Array.isArray(data) ? data : []);
  }

  const renderAttachments = (items?: string[]) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item, index) =>
          isImage(item) ? (
            <a key={index} href={item} target="_blank" rel="noreferrer" className="block">
              <img
                src={item}
                alt={`attachment-${index}`}
                className="h-20 max-w-[160px] rounded-md border object-cover"
              />
            </a>
          ) : (
            <a
              key={index}
              href={item}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              <FileText className="h-3.5 w-3.5" />
              {lang === 'vi' ? 'Xem file đính kèm' : 'View attachment'}
            </a>
          ),
        )}
      </div>
    );
  };

  const renderCommentActions = (
    record: CollaborationThread | CollaborationReply,
    isReply: boolean,
  ) => {
    if (record.deleted) return null;
    const isAuthor = record.author.id === currentUserId;
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <CommentReactionBar
          reactions={record.reactions ?? []}
          currentUserId={currentUserId}
          disabled={submitting}
          onToggle={(emoji) => void toggleReaction(record.commentId, emoji)}
        />
        {isAuthor && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              disabled={submitting}
              onClick={() => startEditing(record.commentId, record.body)}
            >
              <Pencil className="mr-1 h-3 w-3" />
              {lang === 'vi' ? 'Sửa' : 'Edit'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-red-500 hover:text-red-600"
              disabled={submitting}
              onClick={() => void deleteComment(record.commentId)}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              {lang === 'vi' ? 'Xóa' : 'Delete'}
            </Button>
          </>
        )}
        {!isReply && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => setReplyingTo((current) => (current === record.threadId ? null : record.threadId))}
          >
            <Reply className="mr-1 h-3 w-3" />
            {text.reply}
          </Button>
        )}
      </div>
    );
  };

  const renderEditBox = () => (
    <div className="mt-2 space-y-2 rounded-md border bg-background p-2">
      <Input
        value={editBody}
        onChange={(e) => setEditBody(e.target.value)}
        className="text-sm"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingCommentId(null)}>
          {text.cancel}
        </Button>
        <Button type="button" size="sm" disabled={submitting || !editBody.trim()} onClick={() => void saveEdit()}>
          {lang === 'vi' ? 'Lưu' : 'Save'}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {text.commentsDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[75vh] flex-col gap-4 overflow-hidden">
          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {text.commentsLoading}
              </div>
            ) : threads.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                {text.commentsEmpty}
              </div>
            ) : (
              threads.map((thread) => (
                <div key={thread.threadId} className="space-y-3 rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        {thread.author.firstName || thread.author.lastName
                          ? `${thread.author.firstName || ''} ${thread.author.lastName || ''}`.trim()
                          : thread.author.email}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(thread.createdAt).toLocaleString()}
                        {thread.editedAt && (
                          <span className="ml-1 italic">
                            ({lang === 'vi' ? 'đã sửa' : 'edited'})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {thread.resolvedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          {text.resolved}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => resolveThread(thread.threadId)}
                          disabled={submitting}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          {text.resolve}
                        </Button>
                      )}
                    </div>
                  </div>

                  {thread.deleted ? (
                    <p className="text-sm italic text-muted-foreground">
                      {lang === 'vi' ? 'Bình luận đã bị xóa.' : 'This comment was deleted.'}
                    </p>
                  ) : editingCommentId === thread.commentId ? (
                    renderEditBox()
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-foreground/90">
                      <MentionText body={thread.body} members={composerMembers} />
                    </p>
                  )}
                  {!thread.deleted && renderAttachments(thread.attachments)}

                  {thread.mentions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {thread.mentions.map((mention) => (
                        <span
                          key={mention.id}
                          className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary"
                        >
                          @{mention.username || mention.email}
                        </span>
                      ))}
                    </div>
                  )}

                  {renderCommentActions(thread, false)}

                  {thread.replies.length > 0 && (
                    <div className="space-y-2 border-l border-border/60 pl-4">
                      {thread.replies.map((reply) => (
                        <div key={reply.commentId} className="rounded-md bg-muted/30 p-3">
                          <div className="text-[11px] font-semibold">
                            {reply.author.firstName || reply.author.lastName
                              ? `${reply.author.firstName || ''} ${reply.author.lastName || ''}`.trim()
                              : reply.author.email}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(reply.createdAt).toLocaleString()}
                            {reply.editedAt && (
                              <span className="ml-1 italic">
                                ({lang === 'vi' ? 'đã sửa' : 'edited'})
                              </span>
                            )}
                          </div>
                          {reply.deleted ? (
                            <p className="mt-1 text-sm italic text-muted-foreground">
                              {lang === 'vi' ? 'Bình luận đã bị xóa.' : 'This comment was deleted.'}
                            </p>
                          ) : editingCommentId === reply.commentId ? (
                            renderEditBox()
                          ) : (
                            <p className="mt-1 whitespace-pre-wrap text-sm">
                              <MentionText body={reply.body} members={composerMembers} />
                            </p>
                          )}
                          {!reply.deleted && renderAttachments(reply.attachments)}
                          {renderCommentActions(reply, true)}
                        </div>
                      ))}
                    </div>
                  )}

                  {replyingTo === thread.threadId && (
                    <div className="rounded-md border bg-background p-3">
                      <CommentComposer
                        value={replyBodies[thread.threadId] ?? ''}
                        onChange={(next) =>
                          setReplyBodies((prev) => ({
                            ...prev,
                            [thread.threadId]: next,
                          }))
                        }
                        members={composerMembers}
                        attachments={[]}
                        onAttachmentsChange={() => undefined}
                        placeholder={text.commentReplyPlaceholder}
                        minRows={3}
                        disabled={submitting}
                        submitLabel={text.reply}
                        cancelLabel={text.cancel}
                        onSubmit={() => void submitReply(thread.threadId)}
                        onCancel={() => setReplyingTo(null)}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <CommentComposer
              value={body}
              onChange={setBody}
              members={composerMembers}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              placeholder={text.commentPlaceholder}
              minRows={4}
              disabled={submitting}
              submitLabel={submitting ? text.commentSubmitting : text.commentSubmit}
              onSubmit={() => void submitRootComment()}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {text.close}
          </Button>
          <Button type="button" onClick={submitRootComment} disabled={submitting || !body.trim()}>
            {submitting ? text.commentSubmitting : text.commentSubmit}
          </Button>
        </DialogFooter>
      </DialogContent >
    </Dialog >
  );
}
