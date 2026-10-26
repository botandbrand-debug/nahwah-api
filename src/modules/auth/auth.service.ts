import bcrypt from 'bcryptjs';
import { User, UserDocument } from './auth.model';
import { AppError } from '../../shared/errors/AppError';
import { signAccessToken } from '../../shared/utils/jwt';

const SALT_ROUNDS = 12;

export interface SignupInput {
  email: string;
  username: string;
  password: string;
}

export interface LoginInput {
  identifier: string; // email or username
  password: string;
}

export interface AuthResult {
  user: { id: string; email: string; username: string };
  token: string;
}

function toAuthResult(user: UserDocument): AuthResult {
  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
    },
    token: signAccessToken(user._id.toString()),
  };
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();
  const username = input.username.trim();

  // Friendly pre-check. The unique index is the real enforcement (handles race conditions),
  // but this gives a cleaner error in the common case.
  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    if (existing.email === email) {
      throw new AppError('Email already registered', 409, 'EMAIL_TAKEN');
    }
    throw new AppError('Username already taken', 409, 'USERNAME_TAKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const user = await User.create({ email, username, passwordHash });

  return toAuthResult(user);
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const identifier = input.identifier.toLowerCase().trim();

  const user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  }).select('+passwordHash');

  // Constant-time-ish: always run a bcrypt compare, even if the user doesn't exist,
  // so timing doesn't reveal whether the account exists.
  const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const passwordMatches = await bcrypt.compare(input.password, hash);

  if (!user || !passwordMatches) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  return toAuthResult(user);
}