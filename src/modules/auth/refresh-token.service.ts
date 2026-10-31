import crypto from 'crypto';
import { Types } from 'mongoose';
import { Response } from 'express';
import { RefreshToken } from './refresh-token.model';
import { User } from './auth.model';
import { AppError } from '../../shared/errors/AppError';
import { signAccessToken } from '../../shared/utils/jwt';
import { env } from '../../config/env';

const REFRESH_TTL_DAYS = 60;
const REFRESH_COOKIE = 'refreshToken';
const CSRF_COOKIE = 'csrfToken';
const COOKIE_PATH = '/api/v1/auth';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(48).toString('hex'); // 96 hex chars
}

function generateCsrf(): string {
  return crypto.randomBytes(24).toString('hex');
}

function isProduction(): boolean {
  return env.nodeEnv === 'production';
}

/**
 * Set refresh + CSRF cookies. Shared between login, signup, and refresh.
 */
export function setAuthCookies(res: Response, refreshToken: string, csrfToken: string): void {
  const maxAge = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge,
  });

  // CSRF cookie is readable by JS (double-submit pattern)
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: isProduction(),
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  res.clearCookie(CSRF_COOKIE, { path: COOKIE_PATH });
}

/**
 * Issue a fresh refresh token for a user (new family).
 * Called at login/signup. Returns the raw token and CSRF token for cookie-setting.
 */
export async function issueNewFamily(userId: string): Promise<{
  refreshToken: string;
  csrfToken: string;
}> {
  const raw = generateToken();
  const tokenHash = hashToken(raw);
  const familyId = crypto.randomUUID();
  const csrfToken = generateCsrf();

  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId: new Types.ObjectId(userId),
    tokenHash,
    familyId,
    used: false,
    expiresAt,
  });

  return { refreshToken: raw, csrfToken };
}

/**
 * Rotate a refresh token.
 * - Validates CSRF (caller must pass through csrfHeader and csrfCookie)
 * - Detects reuse and revokes the family if found
 * - Issues a new access token + new refresh token in the same family
 * - Returns the new access token and new raw refresh token for cookie-setting
 */
export async function rotateRefreshToken(
  rawRefreshToken: string,
  csrfHeader: string | undefined,
  csrfCookie: string | undefined
): Promise<{
  userId: string;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}> {
  // CSRF: header must match cookie
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    throw new AppError('CSRF token mismatch', 403, 'CSRF_MISMATCH');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const record = await RefreshToken.findOne({ tokenHash });
  if (!record) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH');
  }

  // Expiry check (Mongo TTL isn't instantaneous)
  if (record.expiresAt < new Date()) {
    await RefreshToken.deleteOne({ _id: record._id });
    throw new AppError('Refresh token expired', 401, 'REFRESH_EXPIRED');
  }

  // Reuse detection — CRITICAL
  if (record.used) {
    // Someone is replaying an old token. Revoke the entire family.
    await RefreshToken.deleteMany({ familyId: record.familyId });
    throw new AppError(
      'Refresh token reuse detected; all sessions revoked',
      401,
      'REFRESH_REUSE_DETECTED'
    );
  }

  // Verify user still exists and isn't suspended
  const user = await User.findById(record.userId).select('suspendedAt');
  if (!user) {
    await RefreshToken.deleteMany({ familyId: record.familyId });
    throw new AppError('User not found', 401, 'USER_NOT_FOUND');
  }
  if (user.suspendedAt) {
    await RefreshToken.deleteMany({ userId: record.userId });
    throw new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED');
  }

  // Mark old token used
  record.used = true;
  await record.save();

  // Issue new token in same family
  const raw = generateToken();
  const newHash = hashToken(raw);
  const csrfToken = generateCsrf();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId: record.userId,
    tokenHash: newHash,
    familyId: record.familyId,
    used: false,
    expiresAt,
  });

  return {
    userId: record.userId.toString(),
    accessToken: signAccessToken(record.userId.toString()),
    refreshToken: raw,
    csrfToken,
  };
}

/**
 * Logout: revoke the current refresh token (and its family).
 * The user's other device sessions stay alive.
 */
export async function revokeCurrentSession(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken);
  const record = await RefreshToken.findOne({ tokenHash });
  if (record) {
    await RefreshToken.deleteMany({ familyId: record.familyId });
  }
}

/**
 * Revoke ALL sessions for a user. Called on password change, suspension, etc.
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await RefreshToken.deleteMany({ userId: new Types.ObjectId(userId) });
}