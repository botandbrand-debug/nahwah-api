import { Schema, model, Model, HydratedDocument, Types } from 'mongoose';

export type NotificationType = 'comment_created' | 'nawa_added';

export interface NotificationDoc {
  recipientUserId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  actorPublicName: string;
  actorAvatarSeed: string;
  type: NotificationType;
  targetType: 'post' | 'comment';
  targetId: Types.ObjectId;
  postId: Types.ObjectId;
  excerpt: string;
  readAt: Date | null;
  createdAt: Date;
}

export type NotificationDocument = HydratedDocument<NotificationDoc>;

const notificationSchema = new Schema<NotificationDoc>(
  {
    recipientUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorPublicName: { type: String, required: true },
    actorAvatarSeed: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['comment_created', 'nawa_added'],
    },
    targetType: {
      type: String,
      required: true,
      enum: ['post', 'comment'],
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    excerpt: { type: String, required: true, maxlength: 160 },
    readAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// Feed query: recipient's unread + read notifications, newest first
notificationSchema.index({ recipientUserId: 1, createdAt: -1 });
notificationSchema.index({ recipientUserId: 1, readAt: 1 });

export const Notification: Model<NotificationDoc> = model<NotificationDoc>(
  'Notification',
  notificationSchema
);