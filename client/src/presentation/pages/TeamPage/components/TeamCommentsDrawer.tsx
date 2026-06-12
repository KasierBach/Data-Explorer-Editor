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
import { Loader2, MessageSquare, Reply, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  CollaborationService,
  type CollaborationThread,
  type CollaborationResourceType,
} from '@/core/services/CollaborationService';
import { useAppStore } from '@/core/services/store';
import { getTeamText } from '../teamI18n';
import { toast } from 'sonner';

interface TeamCommentsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  resourceType: CollaborationResourceType | null;
  resourceId: string | null;
  resourceName: string | null;
}

export function TeamCommentsDrawer({
  open,
  onOpenChange,
  organizationId,
  resourceType,
  resourceId,
  resourceName,
}: TeamCommentsDrawerProps) {
  const { lang } = useAppStore();
  const text = getTeamText(lang);
  const [threads, setThreads] = useState<CollaborationThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [body, setBody] = useState('');
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

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
  }, [open, resourceType, resourceId]);

  const submitRootComment = async () => {
    if (!organizationId || !resourceType || !resourceId || !body.trim()) return;
    setSubmitting(true);
    try {
      await CollaborationService.createComment(organizationId, resourceType, resourceId, {
        body: body.trim(),
      });
      await reloadThreads();
      setBody('');
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

  async function reloadThreads() {
    if (!open || !organizationId || !resourceType || !resourceId) {
      setThreads([]);
      return;
    }

    const data = await CollaborationService.getResourceComments(organizationId, resourceType, resourceId);
    setThreads(Array.isArray(data) ? data : []);
  }

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

                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{thread.body}</p>

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
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm">{reply.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setReplyingTo((current) => current === thread.threadId ? null : thread.threadId)}
                    >
                      <Reply className="mr-1 h-3 w-3" />
                      {text.reply}
                    </Button>
                  </div>

                  {replyingTo === thread.threadId && (
                    <div className="space-y-2 rounded-md border bg-background p-3">
                      <textarea
                        className="min-h-[84px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                        placeholder={text.commentReplyPlaceholder}
                        value={replyBodies[thread.threadId] ?? ''}
                        onChange={(e) =>
                          setReplyBodies((prev) => ({
                            ...prev,
                            [thread.threadId]: e.target.value,
                          }))
                        }
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
                          {text.cancel}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => submitReply(thread.threadId)}
                          disabled={submitting}
                        >
                          {text.reply}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <textarea
              className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
              placeholder={text.commentPlaceholder}
              value={body}
              onChange={(e) => setBody(e.target.value)}
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
      </DialogContent>
    </Dialog>
  );
}
