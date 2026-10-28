import { Schema, model, Model, HydratedDocument } from 'mongoose';

export interface UserAttrs {
  email: string;
  username: string;
  passwordHash: string;
}

export interface UserDoc extends UserAttrs {
  displayName?: string;
  bio?: string;
  avatarSeed: string;
  isAdmin: boolean;
  suspendedAt: Date | null;
  suspendedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserDoc>;

const userSchema = new Schema<UserDoc>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    avatarSeed: {
      type: String,
      required: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    suspendedAt: {
      type: Date,
      default: null,
      index: true,
    },
    suspendedReason: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const User: Model<UserDoc> = model<UserDoc>('User', userSchema);