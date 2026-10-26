import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';
import { AppError } from '../../shared/errors/AppError';
import { User } from './auth.model';

const signupSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscore'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function signupHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new AppError(first?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }

    const result = await authService.signup(parsed.data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new AppError(first?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }

    const result = await authService.login(parsed.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function meHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.status(200).json({
      user: { id: user._id.toString(), email: user.email, username: user.username },
    });
  } catch (err) {
    next(err);
  }
}

export function logoutHandler(_req: Request, res: Response): void {
  res.status(200).json({ ok: true });
}