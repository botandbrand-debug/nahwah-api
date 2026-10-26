import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';

const ALGORITHM = 'HS256' as const;
const ISSUER = 'nahwah-api';
const AUDIENCE = 'nahwah-client';
const EXPIRES_IN = '15m';

export interface TokenPayload {
  sub: string; // user id
}

export function signAccessToken(userId: string): string {
  const payload: TokenPayload = { sub: userId };
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: EXPIRES_IN,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    // jwt.verify can return a string if the token itself is a string payload;
    // our tokens always carry an object, so narrow it here.
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new AppError('Invalid token payload', 401, 'INVALID_TOKEN');
    }

    return { sub: decoded.sub };
  } catch (err) {
    if (err instanceof AppError) throw err;
    // jsonwebtoken throws its own errors (TokenExpiredError, JsonWebTokenError, NotBeforeError);
    // collapse them all to one 401 so we don't leak which specific check failed.
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }
}