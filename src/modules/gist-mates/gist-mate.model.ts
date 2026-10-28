import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export type RequestStatus = 'pending' | 'declined';

export interface GistMateRequestDoc {
  fromUserId: Types.ObjectId;
  toUserId: Types.ObjectId;
  status: RequestStatus;
  respondedAt: Date | null;
  createdAt: Date;
}

export type GistMateRequestDocument = HydratedDocument<GistMateRequestDoc>;

const requestSchema = new Schema<GistMateRequestDoc>(
  {
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, required: true, enum: ['pending', 'declined'], default: 'pending' },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// One pending request per (from, to) pair
requestSchema.index(
  { fromUserId: 1, toUserId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

// TTL: auto-purge declined requests after 30 days
requestSchema.index(
  { respondedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30, partialFilterExpression: { status: 'declined' } }
);

export const GistMateRequest: Model<GistMateRequestDoc> = model<GistMateRequestDoc>(
  'GistMateRequest',
  requestSchema
);

// The canonical friendship record: ordered pair (userA < userB)
export interface GistMateDoc {
  userA: Types.ObjectId;
  userB: Types.ObjectId;
  createdAt: Date;
}

export type GistMateDocument = HydratedDocument<GistMateDoc>;

const mateSchema = new Schema<GistMateDoc>(
  {
    userA: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userB: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// Uniqueness on the ordered pair — the race-safe friendship constraint
mateSchema.index({ userA: 1, userB: 1 }, { unique: true });

export const GistMate: Model<GistMateDoc> = model<GistMateDoc>('GistMate', mateSchema);

/** Canonicalize a pair so userA < userB, always. */
export function orderedPair(a: Types.ObjectId, b: Types.ObjectId): { userA: Types.ObjectId; userB: Types.ObjectId } {
  return a.toString() < b.toString() ? { userA: a, userB: b } : { userA: b, userB: a };
}