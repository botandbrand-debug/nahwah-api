import { Router } from 'express';
import {
  sendRequestHandler,
  acceptHandler,
  declineHandler,
  cancelHandler,
  listReceivedHandler,
  listSentHandler,
  listMatesHandler,
  removeMateHandler,
} from './gist-mate.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.post('/gist-mates/requests/:userId', authenticate, sendRequestHandler);
router.get('/gist-mates/requests/received', authenticate, listReceivedHandler);
router.get('/gist-mates/requests/sent', authenticate, listSentHandler);
router.patch('/gist-mates/requests/:id/accept', authenticate, acceptHandler);
router.patch('/gist-mates/requests/:id/decline', authenticate, declineHandler);
router.delete('/gist-mates/requests/:id', authenticate, cancelHandler);

router.get('/gist-mates', authenticate, listMatesHandler);
router.delete('/gist-mates/:userId', authenticate, removeMateHandler);

export default router;