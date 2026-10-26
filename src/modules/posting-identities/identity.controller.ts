import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as identityService from './identity.service';
import { AppError } from '../../shared/errors/AppError';

const createSchema = z.object({
  publicName: z
    .string()
    .trim()
    .min(3, 'Identity name must be at least 3 characters')
    .max(30, 'Identity name must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscore'),
  bio: z.string().trim().max(300, 'Bio must be 300 characters or fewer').optional(),
});

const updateSchema = z.object({
  bio: z.string().trim().max(300, 'Bio must be 300 characters or fewer').optional(),
});

export async function createIdentityHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }

    const identity = await identityService.createIdentity(userId, parsed.data);
    res.status(201).json({ identity });
  } catch (err) {
    next(err);
  }
}

export async function listMyIdentityHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

    const identity = await identityService.listMyIdentity(userId);
    res.status(200).json({ identity });
  } catch (err) {
    next(err);
  }
}

export async function updateIdentityHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

    const identityId = req.params.id;
    if (typeof identityId !== 'string' || !identityId) {
      throw new AppError('Identity id required', 400, 'INVALID_ID');
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }

    const identity = await identityService.updateIdentity(userId, identityId, parsed.data);
    res.status(200).json({ identity });
  } catch (err) {
    next(err);
  }
}

export async function deleteIdentityHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

    const identityId = req.params.id;
    if (typeof identityId !== 'string' || !identityId) {
      throw new AppError('Identity id required', 400, 'INVALID_ID');
    }

    await identityService.deleteIdentity(userId, identityId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}