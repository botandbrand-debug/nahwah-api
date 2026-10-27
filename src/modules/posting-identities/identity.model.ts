import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export interface IdentityDoc {
  publicName: string;
  bio?: string;
  avatarSeed: string;
  ownerUserId: Types.ObjectId;
  isMain: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type IdentityDocument = HydratedDocument<IdentityDoc>;

const identitySchema = new Schema<IdentityDoc>(
  {
    publicName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true,
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
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      select: false,
      index: true,
    },
    isMain: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// One active main identity per user
identitySchema.index(
  { ownerUserId: 1 },
  { unique: true, partialFilterExpression: { isMain: true, deletedAt: null } }
);

// One active pseudonymous identity per user
identitySchema.index(
  { ownerUserId: 1 },
  { unique: true, partialFilterExpression: { isMain: false, deletedAt: null } }
);

export const PostingIdentity: Model<IdentityDoc> = model<IdentityDoc>(
  'PostingIdentity',
  identitySchema
);