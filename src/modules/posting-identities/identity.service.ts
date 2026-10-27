import { PostingIdentity, IdentityDocument } from './identity.model';
import { User } from '../auth/auth.model';
import { Post } from '../posts/post.model';
import { Comment } from '../comments/comment.model';
import { AppError } from '../../shared/errors/AppError';
import { generateAvatarSvg } from '../../shared/avatar/generate';

export interface CreateIdentityInput {
  publicName: string;
  bio?: string;
}

export interface UpdateIdentityInput {
  bio?: string;
}

export function toPublicIdentity(identity: IdentityDocument) {
  return {
    id: identity._id.toString(),
    publicName: identity.publicName,
    bio: identity.bio,
    avatar: generateAvatarSvg(identity.avatarSeed),
    isMain: identity.isMain,
  };
}

export async function createIdentity(
  userId: string,
  input: CreateIdentityInput
): Promise<ReturnType<typeof toPublicIdentity>> {
  const publicName = input.publicName.trim();

  const nameTaken = await PostingIdentity.findOne({ publicName, deletedAt: null });
  if (nameTaken) {
    throw new AppError('This identity name is already taken', 409, 'IDENTITY_NAME_TAKEN');
  }

  const existing = await PostingIdentity.findOne({
    ownerUserId: userId,
    isMain: false,
    deletedAt: null,
  });
  if (existing) {
    throw new AppError('You already have a pseudonymous identity', 409, 'IDENTITY_EXISTS');
  }

  const identity = await PostingIdentity.create({
    publicName,
    bio: input.bio,
    avatarSeed: publicName,
    ownerUserId: userId,
    isMain: false,
    deletedAt: null,
  });

  return toPublicIdentity(identity);
}

export async function listMyIdentity(
  userId: string
): Promise<ReturnType<typeof toPublicIdentity> | null> {
  const identity = await PostingIdentity.findOne({
    ownerUserId: userId,
    isMain: false,
    deletedAt: null,
  });
  return identity ? toPublicIdentity(identity) : null;
}

/**
 * Returns the user's main identity, creating it if missing.
 * Self-heals users who signed up while identity creation failed.
 */
export async function getOrCreateMainIdentity(userId: string): Promise<IdentityDocument> {
    // Step 1: find the identity ID only.
    // (Querying by `ownerUserId` — a `select: false` field — can confuse Mongoose's
    // projection, silently dropping other fields like `avatarSeed`. So we do a
    // minimal-select lookup and then a clean findById below.)
    const found = await PostingIdentity.findOne({
      ownerUserId: userId,
      isMain: true,
      deletedAt: null,
    }).select('_id');
  
    if (found) {
      const full = await PostingIdentity.findById(found._id);
      if (full) return full;
    }
  
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
  
    try {
      const created = await PostingIdentity.create({
        publicName: user.username,
        avatarSeed: user.avatarSeed,
        ownerUserId: userId,
        isMain: true,
        deletedAt: null,
      });
      const full = await PostingIdentity.findById(created._id);
      return full ?? created;
    } catch (err: any) {
      if (err?.code === 11000) {
        // Race — another request created it. Re-fetch cleanly.
        const existing = await PostingIdentity.findOne({
          ownerUserId: userId,
          isMain: true,
          deletedAt: null,
        }).select('_id');
        if (existing) {
          const full = await PostingIdentity.findById(existing._id);
          if (full) return full;
        }
      }
      throw err;
    }
  }

export async function updateIdentity(
  userId: string,
  identityId: string,
  input: UpdateIdentityInput
): Promise<ReturnType<typeof toPublicIdentity>> {
  const identity = await PostingIdentity.findOne({
    _id: identityId,
    deletedAt: null,
  }).select('+ownerUserId');

  if (!identity) {
    throw new AppError('Identity not found', 404, 'IDENTITY_NOT_FOUND');
  }
  if (identity.ownerUserId.toString() !== userId) {
    throw new AppError('Identity not found', 404, 'IDENTITY_NOT_FOUND');
  }
  if (identity.isMain) {
    throw new AppError('Main identity cannot be edited', 400, 'MAIN_IDENTITY_IMMUTABLE');
  }

  if (input.bio !== undefined) identity.bio = input.bio;
  await identity.save();

  return toPublicIdentity(identity);
}

export async function deleteIdentity(userId: string, identityId: string): Promise<void> {
  const identity = await PostingIdentity.findOne({
    _id: identityId,
    deletedAt: null,
  }).select('+ownerUserId');

  if (!identity) {
    throw new AppError('Identity not found', 404, 'IDENTITY_NOT_FOUND');
  }
  if (identity.ownerUserId.toString() !== userId) {
    throw new AppError('Identity not found', 404, 'IDENTITY_NOT_FOUND');
  }
  if (identity.isMain) {
    throw new AppError('Main identity cannot be deleted', 400, 'MAIN_IDENTITY_IMMUTABLE');
  }

  identity.deletedAt = new Date();
  await identity.save();

  // Cascade: soft-delete all posts by this identity
  await Post.updateMany(
    { authorIdentityId: identity._id, deletedAt: null },
    { $set: { deletedAt: new Date() } }
  );

  await Comment.updateMany(
    { authorIdentityId: identity._id, deletedAt: null },
    { $set: { deletedAt: new Date() } }
  );
}