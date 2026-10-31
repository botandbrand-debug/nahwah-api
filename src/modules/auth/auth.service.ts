import bcrypt from 'bcryptjs';
import { User, UserDocument } from './auth.model';
import { PostingIdentity } from '../posting-identities/identity.model';
import { AppError } from '../../shared/errors/AppError';
import { signAccessToken } from '../../shared/utils/jwt';
import { generateAvatarSvg } from '../../shared/avatar/generate';
import { issueNewFamily } from './refresh-token.service';

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
    isAdmin: boolean;
  };
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

function toPublicUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatar: generateAvatarSvg(user.avatarSeed || user._id.toString()),
    isAdmin: !!user.isAdmin,
  };
}

async function buildAuthResult(user: UserDocument): Promise<AuthResult> {
  const { refreshToken, csrfToken } = await issueNewFamily(user._id.toString());
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user._id.toString()),
    refreshToken,
    csrfToken,
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
  const isAdminBootstrap =
    !!process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase();

  const user = await User.create({
    email,
    username,
    passwordHash,
    avatarSeed: username,
    isAdmin: isAdminBootstrap,
  });

  try {
    await PostingIdentity.create({
      publicName: username,
      avatarSeed: username,
      ownerUserId: user._id,
      isMain: true,
      deletedAt: null,
    });
  } catch (err) {
    console.error('[signup] main identity creation failed for user', user._id.toString(), err);
  }

  return buildAuthResult(user);
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

  if (user.suspendedAt) {
    throw new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED');
  }

  return buildAuthResult(user);
}

export function toPublicUserForProfile(user: UserDocument) {
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatar: generateAvatarSvg(user.avatarSeed || user._id.toString()),
  };
}