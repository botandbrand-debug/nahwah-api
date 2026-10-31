import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { PasswordReset } from './password-reset.model';
import { RefreshToken } from './refresh-token.model';
import { User } from './auth.model';
import { AppError } from '../../shared/errors/AppError';
import { revokeAllSessions } from './refresh-token.service';
import { sendPasswordResetEmail } from './email.service';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_RESET_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes between requests
const SALT_ROUNDS = 12;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Request a password reset.
 * ALWAYS succeeds from the caller's perspective — never reveals whether
 * the email is registered (defeats account-enumeration attacks).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    // User doesn't exist — do nothing, but don't reveal
    return;
  }

  // Rate-limit: if a token was created in the last 5 minutes, don't create another.
  const recent = await PasswordReset.findOne({
    userId: user._id,
    createdAt: { $gte: new Date(Date.now() - MIN_RESET_INTERVAL_MS) },
    used: false,
  });
  if (recent) {
    // Already requested recently — silently succeed
    return;
  }

  // Generate token
  const raw = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await PasswordReset.create({
    userId: user._id,
    tokenHash,
    used: false,
    expiresAt,
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${raw}`;

  // Fire-and-forget — email failure must not fail the request
  void sendPasswordResetEmail(user.email, resetUrl);
}

/**
 * Consume a reset token and set a new password.
 * Revokes ALL refresh tokens for the user (all devices logged out).
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const record = await PasswordReset.findOne({ tokenHash });

  if (!record) {
    throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
  }
  if (record.used) {
    throw new AppError('Reset token already used', 400, 'RESET_TOKEN_USED');
  }
  if (record.expiresAt < new Date()) {
    throw new AppError('Reset token expired', 400, 'RESET_TOKEN_EXPIRED');
  }

  const user = await User.findById(record.userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Update password
  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();

  // Mark this token used
  record.used = true;
  await record.save();

  // Invalidate every other unused token for this user
  await PasswordReset.updateMany(
    { userId: user._id, used: false },
    { $set: { used: true } }
  );

  // Revoke all refresh tokens — every device logged out
  await revokeAllSessions(user._id.toString());
}

/**
 * Change password while logged in.
 * Requires the current password to prove the caller is the real user,
 * not an attacker with a stolen access token.
 *
 * Revokes all OTHER sessions but keeps the current one alive
 * (identified by the caller's refresh token cookie).
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentRefreshTokenRaw: string | undefined
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
  }

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();

  // Preserve the current session's family if we can identify it
  if (currentRefreshTokenRaw) {
    const currentHash = hashToken(currentRefreshTokenRaw);
    const current = await RefreshToken.findOne({ tokenHash: currentHash });
    if (current) {
      await RefreshToken.deleteMany({
        userId: new Types.ObjectId(userId),
        familyId: { $ne: current.familyId },
      });
      return;
    }
  }

  // Fallback: no current token identified → revoke everything (conservative)
  await revokeAllSessions(userId);
}