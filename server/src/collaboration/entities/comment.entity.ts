import { ResourceType } from '../../permissions/enums/resource-type.enum';

export interface CommentParticipant {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}

export interface CommentReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
  users: CommentParticipant[];
}

export interface CommentReply {
  commentId: string;
  threadId: string;
  parentCommentId: string | null;
  body: string;
  author: CommentParticipant;
  mentions: CommentParticipant[];
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deleted: boolean;
  attachments?: string[];
  reactions?: CommentReactionGroup[];
}

export interface CommentThread {
  commentId: string;
  threadId: string;
  parentCommentId: null;
  resourceType: ResourceType;
  resourceId: string;
  organizationId: string;
  body: string;
  author: CommentParticipant;
  mentions: CommentParticipant[];
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deleted: boolean;
  resolvedAt: string | null;
  resolvedBy: CommentParticipant | null;
  replies: CommentReply[];
  attachments?: string[];
  reactions?: CommentReactionGroup[];
}
