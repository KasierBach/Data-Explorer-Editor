import { ResourceType } from '../../permissions/enums/resource-type.enum';

export interface CommentParticipant {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
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
  resolvedAt: string | null;
  resolvedBy: CommentParticipant | null;
  replies: CommentReply[];
}
