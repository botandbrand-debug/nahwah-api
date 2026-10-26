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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const User: Model<UserDoc> = model<UserDoc>('User', userSchema);