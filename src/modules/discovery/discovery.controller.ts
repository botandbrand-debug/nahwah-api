import { Request, Response, NextFunction } from 'express';
import { User } from '../auth/auth.model';
import { getHiddenUserIds } from '../blocks/block.service';
import { generateAvatarSvg } from '../../shared/avatar/generate';

export async function searchUsersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 1) {
      res.status(200).json({ users: [] });
      return;
    }

    const viewerId = req.user?.id;
    const hidden = viewerId ? await getHiddenUserIds(viewerId) : new Set<string>();

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const users = await User.find({
      _id: { $nin: Array.from(hidden) },
      $or: [{ username: regex }, { displayName: regex }],
    })
      .limit(20)
      .select('username displayName bio avatarSeed');

    res.status(200).json({
      users: users.map((u) => ({
        userId: u._id.toString(),
        username: u.username,
        displayName: u.displayName ?? null,
        bio: u.bio ?? null,
        avatar: generateAvatarSvg(u.avatarSeed || u.username),
      })),
    });
  } catch (err) { next(err); }
}