import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export type ReportTargetType = 'post' | 'comment' | 'user';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'misinformation'
  | 'violence'
  | 'nudity'
  | 'impersonation'
  | 'other';
export type ReportStatus = 'open' | 'reviewed' | 'resolved' | 'dismissed';

export interface ReportDoc {
  reporterUserId: Types.ObjectId;
  targetType: ReportTargetType;
  targetId: Types.ObjectId;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  reviewedByAdminId: Types.ObjectId | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export type ReportDocument = HydratedDocument<ReportDoc>;

const reportSchema = new Schema<ReportDoc>(
  {
    reporterUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, required: true, enum: ['post', 'comment', 'user'], index: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    reason: {
      type: String,
      required: true,
      enum: ['spam', 'harassment', 'hate_speech', 'misinformation', 'violence', 'nudity', 'impersonation', 'other'],
    },
    details: { type: String, maxlength: 1000 },
    status: { type: String, required: true, enum: ['open', 'reviewed', 'resolved', 'dismissed'], default: 'open', index: true },
    reviewedByAdminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// Admin queue: open reports newest first
reportSchema.index({ status: 1, createdAt: -1 });

export const Report: Model<ReportDoc> = model<ReportDoc>('Report', reportSchema);