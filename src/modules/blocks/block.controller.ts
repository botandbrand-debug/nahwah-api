import { Request, Response, NextFunction } from 'express';
import * as service from './block.service';
import { AppError } from '../../shared/errors/AppError';

export async function blockHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const target = req.params.userId;
    if (typeof target !== 'string' || !target) throw new AppError('User id required', 400, 'INVALID_ID');
    await service.blockUser(userId, target);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function unblockHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const target = req.params.userId;
    if (typeof target !== 'string' || !target) throw new AppError('User id required', 400, 'INVALID_ID');
    await service.unblockUser(userId, target);
    res.status(204).send();
  } catch (err) { next(err); }
}