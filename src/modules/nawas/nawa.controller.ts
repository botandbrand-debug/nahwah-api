import { Request, Response, NextFunction } from 'express';
import * as nawaService from './nawa.service';
import { AppError } from '../../shared/errors/AppError';

function getTargetId(req: Request): string {
  const id = req.params.id;
  if (typeof id !== 'string' || !id) throw new AppError('Target id required', 400, 'INVALID_ID');
  return id;
}

export async function addPostNawaHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    res.status(200).json(await nawaService.addNawa(userId, 'post', getTargetId(req)));
  } catch (err) { next(err); }
}

export async function removePostNawaHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    res.status(200).json(await nawaService.removeNawa(userId, 'post', getTargetId(req)));
  } catch (err) { next(err); }
}

export async function getPostNawaHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await nawaService.getNawaState('post', getTargetId(req), req.user?.id));
  } catch (err) { next(err); }
}

export async function addCommentNawaHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    res.status(200).json(await nawaService.addNawa(userId, 'comment', getTargetId(req)));
  } catch (err) { next(err); }
}

export async function removeCommentNawaHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    res.status(200).json(await nawaService.removeNawa(userId, 'comment', getTargetId(req)));
  } catch (err) { next(err); }
}

export async function getCommentNawaHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await nawaService.getNawaState('comment', getTargetId(req), req.user?.id));
  } catch (err) { next(err); }
}