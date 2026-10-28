import { Types } from 'mongoose';
import {
  GistMate,
  GistMateRequest,
  orderedPair,
  GistMateDocument,
} from './gist-mate.model';
import { User } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';
import { eventBus, Events } from '../../shared/events';
import { generateAvatarSvg } from '../../shared/avatar/generate';

export function toPublicMate(
  mate: GistMateDocument,
  otherUser: { _id: Types.ObjectId; username: string; displayName?: string; bio?: string; avatarSeed: string }
) {
  return {
    userId: otherUser._id.toString(),
    username: otherUser.username,
    displayName: otherUser.displayName ?? null,
    bio: otherUser.bio ?? null,
    avatar: generateAvatarSvg(otherUser.avatarSeed || otherUser.username),
    since: mate.createdAt.toISOString(),
  };
}

export function toPublicRequest(req: any, counterpart: any) {
  return {
    id: req._id.toString(),
    status: req.status,
    counterpart: {
      userId: counterpart._id.toString(),
      username: counterpart.username,
      displayName: counterpart.displayName ?? null,
      avatar: generateAvatarSvg(counterpart.avatarSeed || counterpart.username),
    },
    createdAt: req.createdAt.toISOString(),
    respondedAt: req.respondedAt ? req.respondedAt.toISOString() : null,
  };
}

function orderedIds(a: string, b: string): { userA: Types.ObjectId; userB: Types.ObjectId } {
  const oa = new Types.ObjectId(a);
  const ob = new Types.ObjectId(b);
  return orderedPair(oa, ob);
}

export async function sendRequest(
  fromUserId: string,
  toUserId: string
): Promise<{ autoAccepted: boolean; requestId?: string }> {
  if (!Types.ObjectId.isValid(toUserId)) throw new AppError('Invalid user id', 400, 'INVALID_ID');
  if (fromUserId === toUserId) throw new AppError('Cannot send a request to yourself', 400, 'SELF_REQUEST');

  const target = await User.findById(toUserId);
  if (!target) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  // Already mates?
  const { userA, userB } = orderedIds(fromUserId, toUserId);
  const existingMate = await GistMate.findOne({ userA, userB });
  if (existingMate) throw new AppError('Already Gist Mates', 409, 'ALREADY_MATES');

  // Did the other user already send us a pending request? Auto-accept.
  const reverse = await GistMateRequest.findOne({
    fromUserId: new Types.ObjectId(toUserId),
    toUserId: new Types.ObjectId(fromUserId),
    status: 'pending',
  });
  if (reverse) {
    await GistMate.create({ userA, userB });
    await GistMateRequest.deleteOne({ _id: reverse._id });

    eventBus.emit(Events.GistMateAccepted, {
      userAId: fromUserId,
      userBId: toUserId,
      acceptedByUserId: fromUserId,
    });

    return { autoAccepted: true };
  }

  // Do we already have a pending request to them?
  const existing = await GistMateRequest.findOne({
    fromUserId: new Types.ObjectId(fromUserId),
    toUserId: new Types.ObjectId(toUserId),
    status: 'pending',
  });
  if (existing) throw new AppError('Request already pending', 409, 'REQUEST_EXISTS');

  const created = await GistMateRequest.create({
    fromUserId: new Types.ObjectId(fromUserId),
    toUserId: new Types.ObjectId(toUserId),
    status: 'pending',
    respondedAt: null,
  });

  eventBus.emit(Events.GistMateRequest, {
    requestId: created._id.toString(),
    fromUserId,
    toUserId,
  });

  return { autoAccepted: false, requestId: created._id.toString() };
}

export async function acceptRequest(
  userId: string,
  requestId: string
): Promise<void> {
  if (!Types.ObjectId.isValid(requestId)) throw new AppError('Invalid request id', 400, 'INVALID_ID');

  const req = await GistMateRequest.findOne({
    _id: requestId,
    toUserId: new Types.ObjectId(userId),
    status: 'pending',
  });
  if (!req) throw new AppError('Request not found', 404, 'REQUEST_NOT_FOUND');

  const { userA, userB } = orderedIds(req.fromUserId.toString(), req.toUserId.toString());

  try {
    await GistMate.create({ userA, userB });
  } catch (err: any) {
    if (err?.code === 11000) {
      // Race: both accepted simultaneously or one auto-accepted. Fine — mates exist.
      await GistMateRequest.deleteOne({ _id: req._id });
      return;
    }
    throw err;
  }

  await GistMateRequest.deleteOne({ _id: req._id });

  eventBus.emit(Events.GistMateAccepted, {
    userAId: req.fromUserId.toString(),
    userBId: req.toUserId.toString(),
    acceptedByUserId: userId,
  });
}

export async function declineRequest(userId: string, requestId: string): Promise<void> {
  if (!Types.ObjectId.isValid(requestId)) throw new AppError('Invalid request id', 400, 'INVALID_ID');

  const result = await GistMateRequest.updateOne(
    { _id: requestId, toUserId: new Types.ObjectId(userId), status: 'pending' },
    { $set: { status: 'declined', respondedAt: new Date() } }
  );
  if (result.matchedCount === 0) throw new AppError('Request not found', 404, 'REQUEST_NOT_FOUND');
}

export async function cancelRequest(userId: string, requestId: string): Promise<void> {
  if (!Types.ObjectId.isValid(requestId)) throw new AppError('Invalid request id', 400, 'INVALID_ID');

  const result = await GistMateRequest.deleteOne({
    _id: requestId,
    fromUserId: new Types.ObjectId(userId),
    status: 'pending',
  });
  if (result.deletedCount === 0) throw new AppError('Request not found', 404, 'REQUEST_NOT_FOUND');
}

export async function listReceived(userId: string) {
  const requests = await GistMateRequest.find({
    toUserId: new Types.ObjectId(userId),
    status: 'pending',
  }).sort({ createdAt: -1 }).limit(100);

  const fromIds = requests.map((r) => r.fromUserId);
  const users = await User.find({ _id: { $in: fromIds } });
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  return requests
    .map((r) => {
      const counterpart = byId.get(r.fromUserId.toString());
      return counterpart ? toPublicRequest(r, counterpart) : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export async function listSent(userId: string) {
  const requests = await GistMateRequest.find({
    fromUserId: new Types.ObjectId(userId),
    status: 'pending',
  }).sort({ createdAt: -1 }).limit(100);

  const toIds = requests.map((r) => r.toUserId);
  const users = await User.find({ _id: { $in: toIds } });
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  return requests
    .map((r) => {
      const counterpart = byId.get(r.toUserId.toString());
      return counterpart ? toPublicRequest(r, counterpart) : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export async function listMates(userId: string) {
  const uid = new Types.ObjectId(userId);
  const mates = await GistMate.find({
    $or: [{ userA: uid }, { userB: uid }],
  }).sort({ createdAt: -1 }).limit(200);

  const otherIds = mates.map((m) =>
    m.userA.toString() === userId ? m.userB : m.userA
  );
  const users = await User.find({ _id: { $in: otherIds } });
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  return mates
    .map((m) => {
      const otherId = m.userA.toString() === userId ? m.userB.toString() : m.userA.toString();
      const other = byId.get(otherId);
      return other ? toPublicMate(m, other) : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export async function removeMate(userId: string, otherUserId: string): Promise<void> {
  if (!Types.ObjectId.isValid(otherUserId)) throw new AppError('Invalid user id', 400, 'INVALID_ID');

  const { userA, userB } = orderedIds(userId, otherUserId);
  const result = await GistMate.deleteOne({ userA, userB });
  if (result.deletedCount === 0) throw new AppError('Not Gist Mates', 404, 'NOT_MATES');
}