import { Types } from 'mongoose';
import { Nawa, NawaTargetType } from './nawa.model';
import { Post } from '../posts/post.model';
import { Comment } from '../comments/comment.model';
import { PostingIdentity } from '../posting-identities/identity.model';
import { AppError } from '../../shared/errors/AppError';
import { eventBus, Events, NawaAddedPayload } from '../../shared/events';

export interface NawaState {
  count: number;
  hasNawa: boolean;
}

async function getTargetDocument(targetType: NawaTargetType, targetId: string) {
  if (!Types.ObjectId.isValid(targetId)) {
    throw new AppError('Invalid target id', 400, 'INVALID_ID');
  }
  if (targetType === 'post') {
    const post = await Post.findOne({ _id: targetId, deletedAt: null });
    if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
    return post;
  }
  const comment = await Comment.findOne({ _id: targetId, deletedAt: null });
  if (!comment) throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
  return comment;
}

export async function addNawa(
  userId: string,
  targetType: NawaTargetType,
  targetId: string
): Promise<NawaState> {
  const target = await getTargetDocument(targetType, targetId);

  try {
    await Nawa.create({ userId, targetType, targetId });
    if (targetType === 'post') {
      await Post.updateOne({ _id: targetId }, { $inc: { nawaCount: 1 } });
    } else {
      await Comment.updateOne({ _id: targetId }, { $inc: { nawaCount: 1 } });
    }
  } catch (err: any) {
    if (err?.code === 11000) {
      // Already Nawa'd — idempotent success
      return { count: target.nawaCount, hasNawa: true };
    }
    throw err;
  }

  // Emit for Session 7 notification listener
  try {
    const authorIdentity = await PostingIdentity.findById(target.authorIdentityId).select('+ownerUserId');
    if (authorIdentity) {
      const payload: NawaAddedPayload = {
        targetType,
        targetId,
        targetAuthorIdentityId: target.authorIdentityId.toString(),
        targetAuthorUserId: authorIdentity.ownerUserId?.toString() ?? null,
        nawaUserId: userId,
      };
      eventBus.emit(Events.NawaAdded, payload);
    }
  } catch {
    // Notification emission is best-effort, never fail the Nawa itself
  }

  const updated = targetType === 'post'
    ? await Post.findById(targetId)
    : await Comment.findById(targetId);
  return { count: updated?.nawaCount ?? 0, hasNawa: true };
}

export async function removeNawa(
  userId: string,
  targetType: NawaTargetType,
  targetId: string
): Promise<NawaState> {
  await getTargetDocument(targetType, targetId);

  const result = await Nawa.deleteOne({ userId, targetType, targetId });
  if (result.deletedCount > 0) {
    if (targetType === 'post') {
      await Post.updateOne({ _id: targetId }, { $inc: { nawaCount: -1 } });
    } else {
      await Comment.updateOne({ _id: targetId }, { $inc: { nawaCount: -1 } });
    }
  }

  const updated = targetType === 'post'
    ? await Post.findById(targetId)
    : await Comment.findById(targetId);
  return { count: Math.max(updated?.nawaCount ?? 0, 0), hasNawa: false };
}

export async function getNawaState(
  targetType: NawaTargetType,
  targetId: string,
  userId?: string
): Promise<NawaState> {
  const target = await getTargetDocument(targetType, targetId);

  let hasNawa = false;
  if (userId) {
    const existing = await Nawa.findOne({ userId, targetType, targetId });
    hasNawa = !!existing;
  }

  return { count: target.nawaCount ?? 0, hasNawa };
}

export async function getNawaedTargetIds(
  userId: string,
  targetType: NawaTargetType,
  targetIds: string[]
): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set();
  const rows = await Nawa.find({
    userId,
    targetType,
    targetId: { $in: targetIds },
  }).select('targetId');
  return new Set(rows.map((r) => r.targetId.toString()));
}

// Backwards-compat shim used by post.service.ts (post-only convenience)
export async function getNawaedPostIds(
  userId: string,
  postIds: string[]
): Promise<Set<string>> {
  return getNawaedTargetIds(userId, 'post', postIds);
}