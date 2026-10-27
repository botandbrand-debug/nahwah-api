import { PostingIdentity, IdentityDocument } from './identity.model';
import { User } from '../auth/auth.model';
import { Post } from '../posts/post.model';
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
  let identity = await PostingIdentity.findOne({
    ownerUserId: userId,
    isMain: true,
    deletedAt: null,
  });

  if (identity) return identity;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  try {
    identity = await PostingIdentity.create({
      publicName: user.username,
      avatarSeed: user.avatarSeed,
      ownerUserId: userId,
      isMain: true,
      deletedAt: null,
    });
    return identity;
  } catch (err: any) {
    // Race condition — another request created it first. Re-fetch.
    if (err?.code === 11000) {
      const existing = await PostingIdentity.findOne({
        ownerUserId: userId,
        isMain: true,
        deletedAt: null,
      });
      if (existing) return existing;
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
}