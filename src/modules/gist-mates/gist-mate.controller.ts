import { Request, Response, NextFunction } from 'express';
import * as service from './gist-mate.service';
import { AppError } from '../../shared/errors/AppError';

export async function sendRequestHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const toUserId = req.params.userId;
    if (typeof toUserId !== 'string' || !toUserId) throw new AppError('User id required', 400, 'INVALID_ID');
    const result = await service.sendRequest(userId, toUserId);
    res.status(201).json(result);
  } catch (err) { next(err); }
}

export async function acceptHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const id = req.params.id;
    if (typeof id !== 'string' || !id) throw new AppError('Request id required', 400, 'INVALID_ID');
    await service.acceptRequest(userId, id);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function declineHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const id = req.params.id;
    if (typeof id !== 'string' || !id) throw new AppError('Request id required', 400, 'INVALID_ID');
    await service.declineRequest(userId, id);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function cancelHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const id = req.params.id;
    if (typeof id !== 'string' || !id) throw new AppError('Request id required', 400, 'INVALID_ID');
    await service.cancelRequest(userId, id);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function listReceivedHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const requests = await service.listReceived(userId);
    res.status(200).json({ requests });
  } catch (err) { next(err); }
}

export async function listSentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const requests = await service.listSent(userId);
    res.status(200).json({ requests });
  } catch (err) { next(err); }
}

export async function listMatesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const mates = await service.listMates(userId);
    res.status(200).json({ mates });
  } catch (err) { next(err); }
}

export async function removeMateHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const otherId = req.params.userId;
    if (typeof otherId !== 'string' || !otherId) throw new AppError('User id required', 400, 'INVALID_ID');
    await service.removeMate(userId, otherId);
    res.status(204).send();
  } catch (err) { next(err); }
}