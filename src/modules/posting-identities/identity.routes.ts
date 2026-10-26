import { Router } from 'express';
import {
  createIdentityHandler,
  listMyIdentityHandler,
  updateIdentityHandler,
  deleteIdentityHandler,
} from './identity.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.post('/posting-identities', authenticate, createIdentityHandler);
router.get('/posting-identities/mine', authenticate, listMyIdentityHandler);
router.patch('/posting-identities/:id', authenticate, updateIdentityHandler);
router.delete('/posting-identities/:id', authenticate, deleteIdentityHandler);

export default router;