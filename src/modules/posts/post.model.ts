import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export interface PostDoc {
  content: string;
  authorIdentityId: Types.ObjectId;
  authorPublicName: string;
  authorAvatarSeed: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PostDocument = HydratedDocument<PostDoc>;

const postSchema = new Schema<PostDoc>(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 500,
    },
    authorIdentityId: {
      type: Schema.Types.ObjectId,
      ref: 'PostingIdentity',
      required: true,
      index: true,
    },
    authorPublicName: {
      type: String,
      required: true,
    },
    authorAvatarSeed: {
      type: String,
      required: true,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Feed query: chronological, exclude deleted
postSchema.index({ deletedAt: 1, createdAt: -1 });
// Identity timeline
postSchema.index({ authorIdentityId: 1, deletedAt: 1, createdAt: -1 });

export const Post: Model<PostDoc> = model<PostDoc>('Post', postSchema);