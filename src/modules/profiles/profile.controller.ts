import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as profileService from './profile.service';
import { AppError } from '../../shared/errors/AppError';

const updateProfileSchema = z.object({
  displayName: z.string().trim().max(50, 'Display name must be 50 characters or fewer').optional(),
  bio: z.string().trim().max(300, 'Bio must be 300 characters or fewer').optional(),
});

export async function updateProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }

    const profile = await profileService.updateProfile(userId, parsed.data);
    res.status(200).json({ user: profile });
  } catch (err) {
    next(err);
  }
}

export async function getPublicProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const username = req.params.username;
if (typeof username !== 'string' || !username) {
  throw new AppError('Username required', 400, 'INVALID_USERNAME');
}
    const profile = await profileService.getPublicProfile(username);
    res.status(200).json({ user: profile });
  } catch (err) {
    next(err);
  }
}