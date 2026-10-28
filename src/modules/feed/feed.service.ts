import { Post, PostDocument } from '../posts/post.model';
import { PostingIdentity } from '../posting-identities/identity.model';
import { getNawaedTargetIds } from '../nawas/nawa.service';
import { getHiddenUserIds } from '../blocks/block.service';
import { toPublicPost } from '../posts/post.service';

export type FeedSort = 'recent' | 'popular';

export interface FeedOptions {
  limit: number;
  before?: string;
  viewerUserId?: string;
  sort?: FeedSort;
}

export interface FeedResult {
  posts: ReturnType<typeof toPublicPost>[];
  nextCursor: string | null;
}

async function getHiddenIdentityIds(viewerUserId: string | undefined): Promise<string[]> {
  if (!viewerUserId) return [];
  const hiddenUsers = await getHiddenUserIds(viewerUserId);
  if (hiddenUsers.size === 0) return [];
  const identities = await PostingIdentity.find({
    ownerUserId: { $in: Array.from(hiddenUsers).map((id) => id) },
  }).select('_id');
  return identities.map((i) => i._id.toString());
}

export async function getFeed(options: FeedOptions): Promise<FeedResult> {
  const sort: FeedSort = options.sort ?? 'recent';
  const limit = Math.min(Math.max(options.limit, 1), 50);

  const query: Record<string, unknown> = { deletedAt: null };

  // Block filter
  const hiddenIdentities = await getHiddenIdentityIds(options.viewerUserId);
  if (hiddenIdentities.length > 0) {
    query.authorIdentityId = { $nin: hiddenIdentities };
  }

  // Cursor
  if (options.before && sort === 'recent') {
    const beforeDate = new Date(options.before);
    if (!isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }
  // Popular sort doesn't support cursor pagination in MVP — uses offset-style limit only.
  // If you need infinite scroll on popular, add a $or on (nawaCount, _id) later.

  const sortSpec: Record<string, 1 | -1> = sort === 'popular'
    ? { nawaCount: -1, createdAt: -1 }
    : { createdAt: -1 };

  const rows = await Post.find(query).sort(sortSpec).limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = sort === 'recent' && hasMore
    ? page[page.length - 1]!.createdAt.toISOString()
    : null;

  // Batched hasNawa enrichment
  let nawaedSet = new Set<string>();
  if (options.viewerUserId && page.length > 0) {
    nawaedSet = await getNawaedTargetIds(
      options.viewerUserId,
      'post',
      page.map((p) => p._id.toString())
    );
  }

  return {
    posts: page.map((p) => toPublicPost(p, nawaedSet.has(p._id.toString()))),
    nextCursor,
  };
}