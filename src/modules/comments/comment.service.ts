import { Types } from 'mongoose';
import { Comment, CommentDocument } from './comment.model';
import { Post } from '../posts/post.model';
import { PostingIdentity, IdentityDocument } from '../posting-identities/identity.model';
import { getOrCreateMainIdentity } from '../posting-identities/identity.service';
import { getNawaedTargetIds } from '../nawas/nawa.service';
import { AppError } from '../../shared/errors/AppError';
import { generateAvatarSvg } from '../../shared/avatar/generate';
import { eventBus, Events, CommentCreatedPayload } from '../../shared/events';

export interface CreateCommentInput {
  content: string;
  identityId?: string;
  parentCommentId?: string;
}

export interface ListOptions {
  limit: number;
  after?: string;
  viewerUserId?: string;
}

export function toPublicComment(comment: CommentDocument, hasNawa = false) {
  return {
    id: comment._id.toString(),
    postId: comment.postId.toString(),
    parentCommentId: comment.parentCommentId ? comment.parentCommentId.toString() : null,
    content: comment.content,
    author: {
      name: comment.authorPublicName,
      avatar: generateAvatarSvg(comment.authorAvatarSeed),
    },
    nawaCount: comment.nawaCount ?? 0,
    hasNawa,
    createdAt: comment.createdAt.toISOString(),
    editedAt: comment.editedAt ? comment.editedAt.toISOString() : null,
  };
}

async function resolveAuthorIdentity(
    userId: string,
    requestedIdentityId: string | undefined,
    post: { authorIdentityId: Types.ObjectId }
  ): Promise<IdentityDocument> {
    let requestedIdentity: IdentityDocument;
  
    if (requestedIdentityId) {
      if (!Types.ObjectId.isValid(requestedIdentityId)) {
        throw new AppError('Invalid identity id', 400, 'INVALID_ID');
      }
      const found = await PostingIdentity.findOne({
        _id: requestedIdentityId,
        deletedAt: null,
      }).select('+ownerUserId');
      if (!found) throw new AppError('Identity not found', 404, 'IDENTITY_NOT_FOUND');
      if (found.ownerUserId.toString() !== userId) {
        throw new AppError('Identity not found', 404, 'IDENTITY_NOT_FOUND');
      }
      requestedIdentity = found;
    } else {
      requestedIdentity = await getOrCreateMainIdentity(userId);
    }
  
    // Privacy override: comment on your own post must use the post's authoring identity,
    // regardless of main or pseudonymous. Prevents accidentally exposing a pseudonym link.
    const postIdentity = await PostingIdentity.findById(post.authorIdentityId).select('+ownerUserId');
    if (postIdentity && postIdentity.ownerUserId?.toString() === userId) {
      if (postIdentity._id.toString() !== requestedIdentity._id.toString()) {
        console.warn(
          `[privacy-override] user ${userId} tried ${requestedIdentity.publicName} on own ` +
          `${postIdentity.isMain ? 'main' : 'pseudonymous'} post ${postIdentity.publicName}; ` +
          `forced to ${postIdentity.publicName}`
        );
      }
      return postIdentity;
    }
  
    return requestedIdentity;
  }

export async function createComment(
  userId: string,
  postId: string,
  input: CreateCommentInput
): Promise<ReturnType<typeof toPublicComment>> {
  if (!Types.ObjectId.isValid(postId)) {
    throw new AppError('Invalid post id', 400, 'INVALID_ID');
  }

  const post = await Post.findOne({ _id: postId, deletedAt: null });
  if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');

  let parentCommentId: Types.ObjectId | null = null;
  if (input.parentCommentId) {
    if (!Types.ObjectId.isValid(input.parentCommentId)) {
      throw new AppError('Invalid parent comment id', 400, 'INVALID_ID');
    }
    const parent = await Comment.findOne({
      _id: input.parentCommentId,
      postId,
      deletedAt: null,
    });
    if (!parent) throw new AppError('Parent comment not found', 404, 'PARENT_NOT_FOUND');
    if (parent.parentCommentId) {
      throw new AppError('Cannot reply to a reply', 400, 'NESTED_REPLY_NOT_ALLOWED');
    }
    parentCommentId = parent._id;
  }

  const identity = await resolveAuthorIdentity(userId, input.identityId, post);

  

  const comment = await Comment.create({
    postId: post._id,
    authorIdentityId: identity._id,
    authorPublicName: identity.publicName,
    authorAvatarSeed: identity.avatarSeed || identity.publicName,
    parentCommentId,
    content: input.content,
    nawaCount: 0,
    editedAt: null,
    deletedAt: null,
  });

  const payload: CommentCreatedPayload = {
    commentId: comment._id.toString(),
    postId: post._id.toString(),
    parentCommentId: comment.parentCommentId?.toString() ?? null,
    postAuthorIdentityId: post.authorIdentityId.toString(),
    commenterIdentityId: identity._id.toString(),
    commenterUserId: userId,
  };
  eventBus.emit(Events.CommentCreated, payload);

  return toPublicComment(comment);
}

export async function listComments(
  postId: string,
  options: ListOptions
): Promise<{ comments: ReturnType<typeof toPublicComment>[]; nextCursor: string | null }> {
  if (!Types.ObjectId.isValid(postId)) {
    throw new AppError('Invalid post id', 400, 'INVALID_ID');
  }

  const post = await Post.findOne({ _id: postId, deletedAt: null });
  if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');

  const limit = Math.min(Math.max(options.limit, 1), 100);
  const query: Record<string, unknown> = { postId, deletedAt: null };
  if (options.after) {
    const afterDate = new Date(options.after);
    if (!isNaN(afterDate.getTime())) {
      query.createdAt = { $gt: afterDate };
    }
  }

  const rows = await Comment.find(query).sort({ createdAt: 1 }).limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.createdAt.toISOString() : null;

  let nawaedSet = new Set<string>();
  if (options.viewerUserId && page.length > 0) {
    nawaedSet = await getNawaedTargetIds(
      options.viewerUserId,
      'comment',
      page.map((c) => c._id.toString())
    );
  }

  return {
    comments: page.map((c) => toPublicComment(c, nawaedSet.has(c._id.toString()))),
    nextCursor,
  };
}

export async function updateComment(
  userId: string,
  commentId: string,
  content: string
): Promise<ReturnType<typeof toPublicComment>> {
  if (!Types.ObjectId.isValid(commentId)) {
    throw new AppError('Invalid comment id', 400, 'INVALID_ID');
  }
  const comment = await Comment.findOne({ _id: commentId, deletedAt: null });
  if (!comment) throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');

  const identity = await PostingIdentity.findById(comment.authorIdentityId).select('+ownerUserId');
  if (!identity || identity.ownerUserId.toString() !== userId) {
    throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
  }

  comment.content = content;
  comment.editedAt = new Date();
  await comment.save();

  return toPublicComment(comment);
}

export async function deleteComment(userId: string, commentId: string): Promise<void> {
  if (!Types.ObjectId.isValid(commentId)) {
    throw new AppError('Invalid comment id', 400, 'INVALID_ID');
  }
  const comment = await Comment.findOne({ _id: commentId, deletedAt: null });
  if (!comment) throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');

  const identity = await PostingIdentity.findById(comment.authorIdentityId).select('+ownerUserId');
  if (!identity || identity.ownerUserId.toString() !== userId) {
    throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');
  }

  comment.deletedAt = new Date();
  await comment.save();

  await Comment.updateMany(
    { parentCommentId: comment._id, deletedAt: null },
    { $set: { deletedAt: new Date() } }
  );
}