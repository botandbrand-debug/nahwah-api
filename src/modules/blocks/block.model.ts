import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export interface BlockDoc {
  blockerUserId: Types.ObjectId;
  blockedUserId: Types.ObjectId;
  createdAt: Date;
}

export type BlockDocument = HydratedDocument<BlockDoc>;

const blockSchema = new Schema<BlockDoc>(
  {
    blockerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    blockedUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// One block per (blocker, blocked) pair
blockSchema.index({ blockerUserId: 1, blockedUserId: 1 }, { unique: true });

// Efficient "who has blocked me" lookups for symmetric filtering
blockSchema.index({ blockedUserId: 1, blockerUserId: 1 });

export const Block: Model<BlockDoc> = model<BlockDoc>('Block', blockSchema);