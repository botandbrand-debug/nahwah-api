import bcrypt from 'bcryptjs';
import { User, UserDocument } from './auth.model';
import { AppError } from '../../shared/errors/AppError';
import { signAccessToken } from '../../shared/utils/jwt';
import { generateAvatarSvg } from '../../shared/avatar/generate';

const SALT_ROUNDS = 12;

export interface SignupInput {
  email: string;
  username: string;
  password: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    username: string;
    displayName?: string;
    bio?: string;
    avatar: string;
  };
  token: string;
}

function toAuthResult(user: UserDocument): AuthResult {
  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatar: generateAvatarSvg(user.avatarSeed || user._id.toString()),
    },
    token: signAccessToken(user._id.toString()),
  };
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();
  const username = input.username.trim();

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    if (existing.email === email) {
      throw new AppError('Email already registered', 409, 'EMAIL_TAKEN');
    }
    throw new AppError('Username already taken', 409, 'USERNAME_TAKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await User.create({
    email,
    username,
    passwordHash,
    avatarSeed: username,
  });

  return toAuthResult(user);
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const identifier = input.identifier.toLowerCase().trim();

  const user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  }).select('+passwordHash');

  const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const passwordMatches = await bcrypt.compare(input.password, hash);

  if (!user || !passwordMatches) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  return toAuthResult(user);
}

export function toPublicUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatar: generateAvatarSvg(user.avatarSeed || user._id.toString()),
  };
}