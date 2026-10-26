import { User, UserDocument } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';
import { toPublicUser } from '../auth/auth.service';

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<ReturnType<typeof toPublicUser>> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  if (input.displayName !== undefined) user.displayName = input.displayName;
  if (input.bio !== undefined) user.bio = input.bio;

  await user.save();
  return toPublicUser(user);
}

export async function getPublicProfile(
  username: string
): Promise<ReturnType<typeof toPublicUser>> {
  const user = await User.findOne({ username: username.toLowerCase().trim() });
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  return toPublicUser(user);
}