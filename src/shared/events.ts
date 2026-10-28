import { EventEmitter } from 'events';

class NahwahEventBus extends EventEmitter {}

export const eventBus = new NahwahEventBus();

export const Events = {
  CommentCreated: 'comment.created',
  NawaAdded: 'nawa.added',
  GistMateRequest: 'gist_mate.request',
  GistMateAccepted: 'gist_mate.accepted',
} as const;

export interface CommentCreatedPayload {
  commentId: string;
  postId: string;
  parentCommentId: string | null;
  postAuthorIdentityId: string;
  commenterIdentityId: string;
  commenterUserId: string;
}

export interface NawaAddedPayload {
  targetType: 'post' | 'comment';
  targetId: string;
  targetAuthorIdentityId: string;
  targetAuthorUserId: string | null;
  nawaUserId: string;
}

export interface GistMateRequestPayload {
  requestId: string;
  fromUserId: string;
  toUserId: string;
}

export interface GistMateAcceptedPayload {
  userAId: string;
  userBId: string;
  acceptedByUserId: string;
}