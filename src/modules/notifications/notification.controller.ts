import { Request, Response, NextFunction } from 'express';
import * as notificationService from './notification.service';
import { AppError } from '../../shared/errors/AppError';

function parsePagination(req: Request) {
  const limit = parseInt(String(req.query.limit ?? '20'), 10);
  const before = typeof req.query.before === 'string' ? req.query.before : undefined;
  return { limit: isNaN(limit) ? 20 : limit, before };
}

export async function listNotificationsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const result = await notificationService.listNotifications(userId, parsePagination(req));
    res.status(200).json(result);
  } catch (err) { next(err); }
}

export async function markReadHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const id = req.params.id;
    if (typeof id !== 'string' || !id) throw new AppError('Notification id required', 400, 'INVALID_ID');
    await notificationService.markRead(userId, id);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function markAllReadHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const result = await notificationService.markAllRead(userId);
    res.status(200).json(result);
  } catch (err) { next(err); }
}