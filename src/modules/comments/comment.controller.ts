import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as commentService from './comment.service';
import { AppError } from '../../shared/errors/AppError';

const createSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(300, 'Comment must be 300 characters or fewer'),
  identityId: z.string().optional(),
  parentCommentId: z.string().optional(),
});

const updateSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(300, 'Comment must be 300 characters or fewer'),
});

function parsePagination(req: Request) {
  const limit = parseInt(String(req.query.limit ?? '20'), 10);
  const after = typeof req.query.after === 'string' ? req.query.after : undefined;
  return { limit: isNaN(limit) ? 20 : limit, after };
}

export async function createCommentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const postId = req.params.id;
    if (typeof postId !== 'string' || !postId) throw new AppError('Post id required', 400, 'INVALID_ID');

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }

    const comment = await commentService.createComment(userId, postId, parsed.data);
    res.status(201).json({ comment });
  } catch (err) { next(err); }
}

export async function listCommentsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const postId = req.params.id;
    if (typeof postId !== 'string' || !postId) throw new AppError('Post id required', 400, 'INVALID_ID');

    const result = await commentService.listComments(postId, {
      ...parsePagination(req),
      viewerUserId: req.user?.id,
    });
    res.status(200).json(result);
  } catch (err) { next(err); }
}

export async function updateCommentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const id = req.params.id;
    if (typeof id !== 'string' || !id) throw new AppError('Comment id required', 400, 'INVALID_ID');

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }

    const comment = await commentService.updateComment(userId, id, parsed.data.content);
    res.status(200).json({ comment });
  } catch (err) { next(err); }
}

export async function deleteCommentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const id = req.params.id;
    if (typeof id !== 'string' || !id) throw new AppError('Comment id required', 400, 'INVALID_ID');

    await commentService.deleteComment(userId, id);
    res.status(204).send();
  } catch (err) { next(err); }
}