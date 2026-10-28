import { Types } from 'mongoose';
import { Post, PostDocument } from './post.model';
import { PostingIdentity } from '../posting-identities/identity.model';
import { getOrCreateMainIdentity } from '../posting-identities/identity.service';
import { getNawaedPostIds } from '../nawas/nawa.service';
import { AppError } from '../../shared/errors/AppError';
import { generateAvatarSvg } from '../../shared/avatar/generate';
import { Comment } from '../comments/comment.model';

export interface CreatePostInput {
  content: string;
  identityId?: string;
}

export interface ListOptions {
  limit: number;
  before?: string;
  viewerUserId?: string;
}

export function toPublicPost(post: PostDocument, hasNawa = false) {
  return {
    id: post._id.toString(),
    content: post.content,
    author: {
      name: post.authorPublicName,
      avatar: generateAvatarSvg(post.authorAvatarSeed),
    },
    nawaCount: post.nawaCount ?? 0,
    hasNawa,
    createdAt: post.createdAt.toISOString(),
    editedAt: post.editedAt ? post.editedAt.toISOString() : null,
  };
}

export async function createPost(
  userId: string,
  input: CreatePostInput
): Promise<ReturnType<typeof toPublicPost>> {
  let identity;

  if (input.identityId) {
    if (!Types.ObjectId.isValid(input.identityId)) {
      throw new AppError('Invalid identity id', 400, 'INVALID_ID');
    }
    identity = await PostingIdentity.findOne({
      _id: input.identityId,
      deletedAt: null,
    }).select('+ownerUserId');

    if (!identity) {
      throw new AppError('Identity not found', 404, 'IDENTITY_NOT_FOUND');
    }
    if (identity.ownerUserId.toString() !== userId) {
      throw new AppError('Identity not found', 404, 'IDENTITY_NOT_FOUND');
    }
  } else {
    identity = await getOrCreateMainIdentity(userId);
  }

  const post = await Post.create({
    content: input.content,
    authorIdentityId: identity._id,
    authorPublicName: identity.publicName,
    authorAvatarSeed: identity.avatarSeed || identity.publicName,
    authorIdentityIsPseudonymous: !identity.isMain,
    nawaCount: 0,
    editedAt: null,
    deletedAt: null,
  });

  return toPublicPost(post);
}

export async function getPostById(
  postId: string,
  viewerUserId?: string
): Promise<ReturnType<typeof toPublicPost>> {
  if (!Types.ObjectId.isValid(postId)) {
    throw new AppError('Invalid post id', 400, 'INVALID_ID');
  }
  const post = await Post.findOne({ _id: postId, deletedAt: null });
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }

  let hasNawa = false;
  if (viewerUserId) {
    const set = await getNawaedPostIds(viewerUserId, [postId]);
    hasNawa = set.has(postId);
  }

  return toPublicPost(post, hasNawa);
}

export async function updatePost(
  userId: string,
  postId: string,
  content: string
): Promise<ReturnType<typeof toPublicPost>> {
  if (!Types.ObjectId.isValid(postId)) {
    throw new AppError('Invalid post id', 400, 'INVALID_ID');
  }
  const post = await Post.findOne({ _id: postId, deletedAt: null });
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }

  const identity = await PostingIdentity.findById(post.authorIdentityId).select('+ownerUserId');
  if (!identity || identity.ownerUserId.toString() !== userId) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }

  post.content = content;
  post.editedAt = new Date();
  await post.save();

  return toPublicPost(post);
}

export async function deletePost(userId: string, postId: string): Promise<void> {
  if (!Types.ObjectId.isValid(postId)) {
    throw new AppError('Invalid post id', 400, 'INVALID_ID');
  }
  const post = await Post.findOne({ _id: postId, deletedAt: null });
  if (!post) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }

  const identity = await PostingIdentity.findById(post.authorIdentityId).select('+ownerUserId');
  if (!identity || identity.ownerUserId.toString() !== userId) {
    throw new AppError('Post not found', 404, 'POST_NOT_FOUND');
  }

  post.deletedAt = new Date();
  await post.save();

  await Comment.updateMany(
    { postId: post._id, deletedAt: null },
    { $set: { deletedAt: new Date() } }
  );
}

async function paginate(
  filter: Record<string, unknown>,
  options: ListOptions
): Promise<{ posts: ReturnType<typeof toPublicPost>[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit, 1), 50);
  const query: Record<string, unknown> = { ...filter, deletedAt: null };
  if (options.before) {
    const beforeDate = new Date(options.before);
    if (!isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  const rows = await Post.find(query).sort({ createdAt: -1 }).limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.createdAt.toISOString() : null;

  let nawaedSet = new Set<string>();
  if (options.viewerUserId && page.length > 0) {
    nawaedSet = await getNawaedPostIds(
      options.viewerUserId,
      page.map((p) => p._id.toString())
    );
  }

  return {
    posts: page.map((p) => toPublicPost(p, nawaedSet.has(p._id.toString()))),
    nextCursor,
  };
}

export async function listByIdentity(
  publicName: string,
  options: ListOptions
): Promise<{ posts: ReturnType<typeof toPublicPost>[]; nextCursor: string | null }> {
  const identity = await PostingIdentity.findOne({ publicName, deletedAt: null });
  if (!identity) {
    throw new AppError('Identity not found', 404, 'IDENTITY_NOT_FOUND');
  }
  return paginate({ authorIdentityId: identity._id }, options);
}

export async function listMainByIdentityName(
  publicName: string,
  options: ListOptions
): Promise<{ posts: ReturnType<typeof toPublicPost>[]; nextCursor: string | null }> {
  const identity = await PostingIdentity.findOne({
    publicName,
    isMain: true,
    deletedAt: null,
  }).select('+ownerUserId');
  if (!identity) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Block check
  if (options.viewerUserId && identity.ownerUserId) {
    const { isBlockedBetween } = await import('../blocks/block.service');
    const blocked = await isBlockedBetween(options.viewerUserId, identity.ownerUserId.toString());
    if (blocked) return { posts: [], nextCursor: null };
  }

  return paginate({ authorIdentityId: identity._id }, options);
}

export async function listMine(
  userId: string,
  options: ListOptions
): Promise<{ posts: ReturnType<typeof toPublicPost>[]; nextCursor: string | null }> {
  const identities = await PostingIdentity.find({
    ownerUserId: userId,
    deletedAt: null,
  }).select('_id');

  const identityIds = identities.map((i) => i._id);
  if (identityIds.length === 0) {
    return { posts: [], nextCursor: null };
  }

  return paginate({ authorIdentityId: { $in: identityIds } }, options);
}

export async function getFeed(
  options: ListOptions
): Promise<{ posts: ReturnType<typeof toPublicPost>[]; nextCursor: string | null }> {
  return paginate({}, options);
}