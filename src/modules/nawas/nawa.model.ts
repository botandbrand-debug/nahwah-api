import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export type NawaTargetType = 'post' | 'comment';

export interface NawaDoc {
  userId: Types.ObjectId;
  targetType: NawaTargetType;
  targetId: Types.ObjectId;
  createdAt: Date;
}

export type NawaDocument = HydratedDocument<NawaDoc>;

const nawaSchema = new Schema<NawaDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      enum: ['post', 'comment'],
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// One Nawa per user per target
nawaSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });

export const Nawa: Model<NawaDoc> = model<NawaDoc>('Nawa', nawaSchema);