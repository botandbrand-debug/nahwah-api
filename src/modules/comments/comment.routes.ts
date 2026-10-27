import { Router } from 'express';
import {
  createCommentHandler,
  listCommentsHandler,
  updateCommentHandler,
  deleteCommentHandler,
} from './comment.controller';
import { authenticate } from '../../middleware/authenticate';
import { optionalAuth } from '../../middleware/optionalAuth';

const router = Router();

router.post('/posts/:id/comments', authenticate, createCommentHandler);
router.get('/posts/:id/comments', optionalAuth, listCommentsHandler);

router.patch('/comments/:id', authenticate, updateCommentHandler);
router.delete('/comments/:id', authenticate, deleteCommentHandler);

export default router;