import { Types } from 'mongoose';
import { Notification, NotificationDocument } from './notification.model';
import { AppError } from '../../shared/errors/AppError';
import { eventBus, Events, CommentCreatedPayload, NawaAddedPayload } from '../../shared/events';
import { PostingIdentity } from '../posting-identities/identity.model';
import { Comment } from '../comments/comment.model';
import { Post } from '../posts/post.model';
import { generateAvatarSvg } from '../../shared/avatar/generate';

export function toPublicNotification(notification: NotificationDocument) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    actor: {
      name: notification.actorPublicName,
      avatar: generateAvatarSvg(notification.actorAvatarSeed),
    },
    target: {
      type: notification.targetType,
      id: notification.targetId.toString(),
      postId: notification.postId ? notification.postId.toString() : null,
    },
    excerpt: notification.excerpt,
    read: notification.readAt !== null,
    createdAt: notification.createdAt.toISOString(),
  };
}

interface CreateNotificationInput {
  recipientUserId: string;
  actorUserId: string;
  actorPublicName: string;
  actorAvatarSeed: string;
  type: 'comment_created' | 'nawa_added';
  targetType: 'post' | 'comment';
  targetId: string;
  postId: string;
  excerpt: string;
}

async function createNotification(input: CreateNotificationInput): Promise<void> {
  // Skip self-notifications
  if (input.recipientUserId === input.actorUserId) return;

  await Notification.create({
    recipientUserId: new Types.ObjectId(input.recipientUserId),
    actorUserId: new Types.ObjectId(input.actorUserId),
    actorPublicName: input.actorPublicName,
    actorAvatarSeed: input.actorAvatarSeed,
    type: input.type,
    targetType: input.targetType,
    targetId: new Types.ObjectId(input.targetId),
    postId: new Types.ObjectId(input.postId),
    excerpt: input.excerpt.slice(0, 160),
    readAt: null,
  });
}

/**
 * Called at server startup. Subscribes to events emitted by comment and nawa services.
 * This is the "listener side" of the event bus — no changes needed in those services.
 */
export function registerNotificationListeners(): void {
  eventBus.on(Events.CommentCreated, async (payload: CommentCreatedPayload) => {
    try {
      const actorIdentity = await PostingIdentity.findById(payload.commenterIdentityId);
      if (!actorIdentity) return;

      // The recipient is the post's authoring identity's owner
      const postIdentity = await PostingIdentity.findById(payload.postAuthorIdentityId).select('+ownerUserId');
      if (!postIdentity || !postIdentity.ownerUserId) return;

      // Get the comment's excerpt and its target for the notification body
      const comment = await Comment.findById(payload.commentId);
      if (!comment) return;

      await createNotification({
        recipientUserId: postIdentity.ownerUserId.toString(),
        actorUserId: payload.commenterUserId,
        actorPublicName: actorIdentity.publicName,
        actorAvatarSeed: actorIdentity.avatarSeed || actorIdentity.publicName,
        type: 'comment_created',
        targetType: 'comment',
        targetId: payload.commentId,
        postId: payload.postId,
        excerpt: comment.content,
      });
    } catch (err) {
      console.error('[notify] comment.created failed:', err);
    }
  });

  eventBus.on(Events.NawaAdded, async (payload: NawaAddedPayload) => {
    try {
      if (!payload.targetAuthorUserId) return;

      const actorIdentity = await PostingIdentity.findOne({
        ownerUserId: payload.nawaUserId,
        isMain: true,
        deletedAt: null,
      });
      if (!actorIdentity) return;

      // Get target excerpt (post content or comment content)
      let excerpt = '';
      let postId = '';
      if (payload.targetType === 'post') {
        const post = await Post.findById(payload.targetId);
        if (!post) return;
        excerpt = post.content;
        postId = post._id.toString();
      } else {
        const comment = await Comment.findById(payload.targetId);
        if (!comment) return;
        excerpt = comment.content;
        postId = comment.postId.toString();
      }

      await createNotification({
        recipientUserId: payload.targetAuthorUserId,
        actorUserId: payload.nawaUserId,
        actorPublicName: actorIdentity.publicName,
        actorAvatarSeed: actorIdentity.avatarSeed || actorIdentity.publicName,
        type: 'nawa_added',
        targetType: payload.targetType,
        targetId: payload.targetId,
        postId,
        excerpt,
      });
    } catch (err) {
      console.error('[notify] nawa.added failed:', err);
    }
  });

  console.log('[notifications] listeners registered');
}

export async function listNotifications(
  userId: string,
  options: { limit: number; before?: string }
): Promise<{ notifications: ReturnType<typeof toPublicNotification>[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit, 1), 50);
  const query: Record<string, unknown> = { recipientUserId: new Types.ObjectId(userId) };
  if (options.before) {
    const beforeDate = new Date(options.before);
    if (!isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  const rows = await Notification.find(query).sort({ createdAt: -1 }).limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.createdAt.toISOString() : null;

  return {
    notifications: page.map(toPublicNotification),
    nextCursor,
  };
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  if (!Types.ObjectId.isValid(notificationId)) {
    throw new AppError('Invalid notification id', 400, 'INVALID_ID');
  }
  const result = await Notification.updateOne(
    { _id: notificationId, recipientUserId: new Types.ObjectId(userId) },
    { $set: { readAt: new Date() } }
  );
  if (result.matchedCount === 0) {
    throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
  }
}

export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const result = await Notification.updateMany(
    { recipientUserId: new Types.ObjectId(userId), readAt: null },
    { $set: { readAt: new Date() } }
  );
  return { updated: result.modifiedCount };
}