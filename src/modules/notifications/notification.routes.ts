import { Router } from 'express';
import {
  listNotificationsHandler,
  markReadHandler,
  markAllReadHandler,
} from './notification.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.get('/notifications', authenticate, listNotificationsHandler);
router.patch('/notifications/read-all', authenticate, markAllReadHandler);
router.patch('/notifications/:id/read', authenticate, markReadHandler);

export default router;