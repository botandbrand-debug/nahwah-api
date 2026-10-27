import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../shared/utils/jwt';

/**
 * Attempts to authenticate if a valid Bearer token is provided.
 * Does NOT reject unauthenticated requests — just leaves req.user undefined.
 * Used for endpoints that work publicly but enrich the response when authenticated.
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header) return next();

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next();

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub };
  } catch {
    // Invalid token — treat as unauthenticated, don't error.
  }
  next();
}