import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as service from './report.service';
import { AppError } from '../../shared/errors/AppError';

const createSchema = z.object({
  targetType: z.enum(['post', 'comment', 'user']),
  targetId: z.string(),
  reason: z.enum(['spam', 'harassment', 'hate_speech', 'misinformation', 'violence', 'nudity', 'impersonation', 'other']),
  details: z.string().max(1000).optional(),
});

export async function createReportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }
    const result = await service.createReport(userId, parsed.data);
    res.status(201).json(result);
  } catch (err) { next(err); }
}