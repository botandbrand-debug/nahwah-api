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
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      select: false,
    },
    isMain: {
      type: Boolean,
      required: true,
      default: false,
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

// One active identity per (user, isMain) pair.
// Enforces: at most one main + at most one pseudonym per user.
// Deleted identities don't count toward uniqueness.
identitySchema.index(
  { ownerUserId: 1, isMain: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

// Lookup index for "does this user have an active identity of type X?"
identitySchema.index({ ownerUserId: 1, isMain: 1, deletedAt: 1 });

export const PostingIdentity: Model<IdentityDoc> = model<IdentityDoc>(
  'PostingIdentity',
  identitySchema
);