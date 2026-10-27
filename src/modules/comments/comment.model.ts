import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export interface CommentDoc {
  postId: Types.ObjectId;
  authorIdentityId: Types.ObjectId;
  authorPublicName: string;
  authorAvatarSeed: string;
  parentCommentId: Types.ObjectId | null;
  content: string;
  nawaCount: number;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CommentDocument = HydratedDocument<CommentDoc>;

const commentSchema = new Schema<CommentDoc>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    authorIdentityId: {
      type: Schema.Types.ObjectId,
      ref: 'PostingIdentity',
      required: true,
      index: true,
    },
    authorPublicName: { type: String, required: true },
    authorAvatarSeed: { type: String, required: true },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 300,
    },
    nawaCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

commentSchema.index({ postId: 1, deletedAt: 1, createdAt: 1 });
commentSchema.index({ parentCommentId: 1, deletedAt: 1, createdAt: 1 });

export const Comment: Model<CommentDoc> = model<CommentDoc>('Comment', commentSchema);