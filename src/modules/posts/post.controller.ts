import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as postService from './post.service';
import { AppError } from '../../shared/errors/AppError';

const createSchema = z.object({
  content: z.string().trim().min(1, 'Post cannot be empty').max(500, 'Post must be 500 characters or fewer'),
  identityId: z.string().optional(),
});

const updateSchema = z.object({
  content: z.string().trim().min(1, 'Post cannot be empty').max(500, 'Post must be 500 characters or fewer'),
});

function parsePagination(req: Request) {
  const limit = parseInt(String(req.query.limit ?? '20'), 10);
  const before = typeof req.query.before === 'string' ? req.query.before : undefined;
  return { limit: isNaN(limit) ? 20 : limit, before };
}

export async function createPostHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }
    const post = await postService.createPost(userId, parsed.data);
    res.status(201).json({ post });
  } catch (err) { next(err); }
}

export async function getPostHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id;
    if (typeof id !== 'string' || !id) throw new AppError('Post id required', 400, 'INVALID_ID');
    const post = await postService.getPostById(id);
    res.status(200).json({ post });
  } catch (err) { next(err); }
}

export async function updatePostHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const id = req.params.id;
    if (typeof id !== 'string' || !id) throw new AppError('Post id required', 400, 'INVALID_ID');
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }
    const post = await postService.updatePost(userId, id, parsed.data.content);
    res.status(200).json({ post });
  } catch (err) { next(err); }
}

export async function deletePostHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const id = req.params.id;
    if (typeof id !== 'string' || !id) throw new AppError('Post id required', 400, 'INVALID_ID');
    await postService.deletePost(userId, id);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function listByIdentityHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const publicName = req.params.publicName;
    if (typeof publicName !== 'string' || !publicName) throw new AppError('Identity name required', 400, 'INVALID_NAME');
    const result = await postService.listByIdentity(publicName, parsePagination(req));
    res.status(200).json(result);
  } catch (err) { next(err); }
}

export async function listByUsernameHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const username = req.params.username;
    if (typeof username !== 'string' || !username) throw new AppError('Username required', 400, 'INVALID_NAME');
    const result = await postService.listMainByIdentityName(username, parsePagination(req));
    res.status(200).json(result);
  } catch (err) { next(err); }
}

export async function listMineHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    const result = await postService.listMine(userId, parsePagination(req));
    res.status(200).json(result);
  } catch (err) { next(err); }
}

export async function feedHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await postService.getFeed(parsePagination(req));
    res.status(200).json(result);
  } catch (err) { next(err); }
}