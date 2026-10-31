import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';
import * as refreshService from './refresh-token.service';
import * as passwordResetService from './password-reset.service';
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

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email').max(254),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

function sendAuthResponse(
  res: Response,
  statusCode: number,
  result: authService.AuthResult
): void {
  refreshService.setAuthCookies(res, result.refreshToken, result.csrfToken);
  res.status(statusCode).json({
    user: result.user,
    accessToken: result.accessToken,
  });
}

export async function signupHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }
    const result = await authService.signup(parsed.data);
    sendAuthResponse(res, 201, result);
  } catch (err) { next(err); }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }
    const result = await authService.login(parsed.data);
    sendAuthResponse(res, 200, result);
  } catch (err) { next(err); }
}

export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
      throw new AppError('No refresh token', 401, 'NO_REFRESH');
    }

    const csrfHeader = req.headers['x-csrf-token'];
    const csrfCookie = req.cookies?.csrfToken;

    const result = await refreshService.rotateRefreshToken(
      rawToken,
      typeof csrfHeader === 'string' ? csrfHeader : undefined,
      typeof csrfCookie === 'string' ? csrfCookie : undefined
    );

    refreshService.setAuthCookies(res, result.refreshToken, result.csrfToken);

    res.status(200).json({ accessToken: result.accessToken });
  } catch (err) { next(err); }
}

export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (rawToken) {
      await refreshService.revokeCurrentSession(rawToken);
    }
    refreshService.clearAuthCookies(res);
    res.status(200).json({ ok: true });
  } catch (err) { next(err); }
}

export async function meHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    res.status(200).json({
      user: authService.toPublicUserForProfile(user),
    });
  } catch (err) { next(err); }
}

export async function forgotPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }
    await passwordResetService.requestPasswordReset(parsed.data.email);
    // ALWAYS 200 — never reveal whether the email exists
    res.status(200).json({ ok: true });
  } catch (err) { next(err); }
}

export async function resetPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }
    await passwordResetService.resetPassword(parsed.data.token, parsed.data.newPassword);
    // Sessions are revoked — force the client to log in again
    refreshService.clearAuthCookies(res);
    res.status(200).json({ ok: true });
  } catch (err) { next(err); }
}

export async function changePasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }

    const currentRefresh = req.cookies?.refreshToken;
    await passwordResetService.changePassword(
      userId,
      parsed.data.currentPassword,
      parsed.data.newPassword,
      currentRefresh
    );

    res.status(200).json({ ok: true });
  } catch (err) { next(err); }
}