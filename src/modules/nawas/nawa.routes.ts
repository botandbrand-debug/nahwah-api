import { Router } from 'express';
import {
  addPostNawaHandler,
  removePostNawaHandler,
  getPostNawaHandler,
  addCommentNawaHandler,
  removeCommentNawaHandler,
  getCommentNawaHandler,
} from './nawa.controller';
import { authenticate } from '../../middleware/authenticate';
import { optionalAuth } from '../../middleware/optionalAuth';

const router = Router();

router.put('/posts/:id/nawas', authenticate, addPostNawaHandler);
router.delete('/posts/:id/nawas', authenticate, removePostNawaHandler);
router.get('/posts/:id/nawas', optionalAuth, getPostNawaHandler);

router.put('/comments/:id/nawas', authenticate, addCommentNawaHandler);
router.delete('/comments/:id/nawas', authenticate, removeCommentNawaHandler);
router.get('/comments/:id/nawas', optionalAuth, getCommentNawaHandler);

export default router;