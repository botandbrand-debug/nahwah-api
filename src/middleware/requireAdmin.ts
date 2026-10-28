import { Request, Response, NextFunction } from 'express';
import { User } from '../modules/auth/auth.model';
import { AppError } from '../shared/errors/AppError';

export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) return next(new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED'));

    const user = await User.findById(userId).select('isAdmin suspendedAt');
    if (!user) return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
    if (user.suspendedAt) return next(new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED'));
    if (!user.isAdmin) return next(new AppError('Admin access required', 403, 'FORBIDDEN'));

    next();
  } catch (err) {
    next(err);
  }
}