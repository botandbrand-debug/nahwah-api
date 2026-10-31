import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export interface RefreshTokenDoc {
  userId: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  used: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export type RefreshTokenDocument = HydratedDocument<RefreshTokenDoc>;

const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    familyId: { type: String, required: true, index: true },
    used: { type: Boolean, required: true, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// Auto-purge expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<RefreshTokenDoc> = model<RefreshTokenDoc>(
  'RefreshToken',
  refreshTokenSchema
);