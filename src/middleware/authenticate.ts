import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../shared/utils/jwt';
import { AppError } from '../shared/errors/AppError';

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header) {
    return next(new AppError('Authorization header required', 401, 'NO_TOKEN'));
  }

  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(
      new AppError('Authorization header must be "Bearer <token>"', 401, 'BAD_TOKEN_FORMAT')
    );
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    next(err);
  }
}