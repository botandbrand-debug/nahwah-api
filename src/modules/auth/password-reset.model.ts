import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export interface PasswordResetDoc {
  userId: Types.ObjectId;
  tokenHash: string;
  used: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export type PasswordResetDocument = HydratedDocument<PasswordResetDoc>;

const passwordResetSchema = new Schema<PasswordResetDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    used: { type: Boolean, required: true, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// Auto-purge expired tokens
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordReset: Model<PasswordResetDoc> = model<PasswordResetDoc>(
  'PasswordReset',
  passwordResetSchema
);