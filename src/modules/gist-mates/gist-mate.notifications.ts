import { eventBus, Events, GistMateRequestPayload, GistMateAcceptedPayload } from '../../shared/events';
import { Notification } from '../notifications/notification.model';
import { User } from '../auth/auth.model';
import { Types } from 'mongoose';

export function registerGistMateNotificationListeners(): void {
  eventBus.on(Events.GistMateRequest, async (payload: GistMateRequestPayload) => {
    try {
      const actor = await User.findById(payload.fromUserId);
      if (!actor) return;
      await Notification.create({
        recipientUserId: new Types.ObjectId(payload.toUserId),
        actorUserId: new Types.ObjectId(payload.fromUserId),
        actorPublicName: actor.username,
        actorAvatarSeed: actor.avatarSeed || actor.username,
        type: 'gist_mate_request',
        targetType: 'user',
        targetId: new Types.ObjectId(payload.fromUserId),
        excerpt: 'sent you a Gist Mate request',
        readAt: null,
      });
    } catch (err) {
      console.error('[notify] gist_mate.request failed:', err);
    }
  });

  eventBus.on(Events.GistMateAccepted, async (payload: GistMateAcceptedPayload) => {
    try {
      const recipientId =
        payload.acceptedByUserId === payload.userAId ? payload.userBId : payload.userAId;
      const actor = await User.findById(payload.acceptedByUserId);
      if (!actor) return;
      await Notification.create({
        recipientUserId: new Types.ObjectId(recipientId),
        actorUserId: new Types.ObjectId(payload.acceptedByUserId),
        actorPublicName: actor.username,
        actorAvatarSeed: actor.avatarSeed || actor.username,
        type: 'gist_mate_accepted',
        targetType: 'user',
        targetId: new Types.ObjectId(payload.acceptedByUserId),
        excerpt: 'accepted your Gist Mate request',
        readAt: null,
      });
    } catch (err) {
      console.error('[notify] gist_mate.accepted failed:', err);
    }
  });

  console.log('[notifications] gist mate listeners registered');
}