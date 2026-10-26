import { PostingIdentity, IdentityDocument } from './identity.model';
import { User } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';
import { generateAvatarSvg } from '../../shared/avatar/generate';

export interface CreateIdentityInput {
  publicName: string;
  bio?: string;
}

export interface UpdateIdentityInput {
  bio?: string;
}

/**
 * The ONLY serializer for posting identities.
 * Guarantees ownerUserId is never returned. This is the privacy invariant.
 */
export function toPublicIdentity(identity: IdentityDocument) {
  return {
    id: identity._id.toString(),
    publicName: identity.publicName,
    bio: identity.bio,
    avatar: generateAvatarSvg(identity.avatarSeed),
  };
}

export async function createIdentity(
  userId: string,
  input: CreateIdentityInput
): Promise<ReturnType<typeof toPublicIdentity>> {
  const publicName = input.publicName.trim();

  // Check global uniqueness of the name first (friendly error)
  const nameTaken = await PostingIdentity.findOne({ publicName, deletedAt: null });
  if (nameTaken) {
    throw new AppError('This identity name is already taken', 409, 'IDENTITY_NAME_TAKEN');
  }

  // Check the user doesn't already have an active identity
  const existing = await PostingIdentity.findOne({ ownerUserId: userId, deletedAt: null });
  if (existing) {
    throw new AppError('You already have a pseudonymous identity', 409, 'IDENTITY_EXISTS');
  }

  const identity = await PostingIdentity.create({
    publicName,
    bio: input.bio,
    avatarSeed: publicName,
    ownerUserId: userId,
    deletedAt: null,
  });

  return toPublicIdentity(identity);
}

export async function listMyIdentity(
  userId: string
): Promise<ReturnType<typeof toPublicIdentity> | null> {
  const identity = await PostingIdentity.findOne({ ownerUserId: userId, deletedAt: null });
  return identity ? toPublicIdentity(identity) : null;
}

export async function updateIdentity(
  userId: string,
  identityId: string,
  input: UpdateIdentityInput
): Promise<ReturnType<typeof toPublicIdentity>> {
  // Must opt-in to ownerUserId to check ownership.
  const identity = await PostingIdentity.findOne({
    _id: identityId,
    deletedAt: null,
  }).select('+ownerUserId');

  if (!identity) {
    throw new AppError('Identity not found', 404, 'IDENTITY_NOT_FOUND');
  }

  if (identity.ownerUserId.toString() !== userId) {
    throw new AppError('Identity not found', 404, 'IDENTITY_NOT_FOUND');
    // Deliberately 404 not 403 — don't reveal the identity exists to non-owners.
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

  identity.deletedAt = new Date();
  await identity.save();
}