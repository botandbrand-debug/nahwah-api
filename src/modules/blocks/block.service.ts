import { Types } from 'mongoose';
import { Block } from './block.model';
import { User } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';

export async function blockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  if (!Types.ObjectId.isValid(blockedUserId)) {
    throw new AppError('Invalid user id', 400, 'INVALID_ID');
  }
  if (blockerUserId === blockedUserId) {
    throw new AppError('Cannot block yourself', 400, 'SELF_BLOCK');
  }

  const target = await User.findById(blockedUserId);
  if (!target) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  try {
    await Block.create({
      blockerUserId: new Types.ObjectId(blockerUserId),
      blockedUserId: new Types.ObjectId(blockedUserId),
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      // Already blocked — idempotent success
      return;
    }
    throw err;
  }
}

export async function unblockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  if (!Types.ObjectId.isValid(blockedUserId)) {
    throw new AppError('Invalid user id', 400, 'INVALID_ID');
  }

  const result = await Block.deleteOne({
    blockerUserId: new Types.ObjectId(blockerUserId),
    blockedUserId: new Types.ObjectId(blockedUserId),
  });
  if (result.deletedCount === 0) {
    throw new AppError('Not blocked', 404, 'NOT_BLOCKED');
  }
}

/**
 * Returns the set of user IDs that should be hidden from `userId`'s view.
 * Symmetric: includes users `userId` blocked AND users who blocked `userId`.
 */
export async function getHiddenUserIds(userId: string): Promise<Set<string>> {
  const uid = new Types.ObjectId(userId);
  const rows = await Block.find({
    $or: [{ blockerUserId: uid }, { blockedUserId: uid }],
  });
  const set = new Set<string>();
  for (const r of rows) {
    const blocker = r.blockerUserId.toString();
    const blocked = r.blockedUserId.toString();
    set.add(blocker === userId ? blocked : blocker);
  }
  return set;
}

/**
 * True if either side has blocked the other.
 * Used to gate interactions (gist-mate requests, comments on each other's posts).
 */
export async function isBlockedBetween(aUserId: string, bUserId: string): Promise<boolean> {
  if (aUserId === bUserId) return false;
  const a = new Types.ObjectId(aUserId);
  const b = new Types.ObjectId(bUserId);
  const exists = await Block.findOne({
    $or: [
      { blockerUserId: a, blockedUserId: b },
      { blockerUserId: b, blockedUserId: a },
    ],
  });
  return exists !== null;
}