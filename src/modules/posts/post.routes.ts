import { Router } from 'express';
import {
  createPostHandler,
  getPostHandler,
  updatePostHandler,
  deletePostHandler,
  listByIdentityHandler,
  listByUsernameHandler,
  listMineHandler,
  feedHandler,
  popularFeedHandler,   // NEW
} from './post.controller';
import { authenticate } from '../../middleware/authenticate';
import { optionalAuth } from '../../middleware/optionalAuth';

const router = Router();

router.get('/feed', optionalAuth, feedHandler);
router.get('/feed/popular', optionalAuth, popularFeedHandler);   // NEW

router.post('/posts', authenticate, createPostHandler);
router.get('/posts/mine', authenticate, listMineHandler);
router.get('/posts/:id', optionalAuth, getPostHandler);
router.patch('/posts/:id', authenticate, updatePostHandler);
router.delete('/posts/:id', authenticate, deletePostHandler);

router.get('/identities/:publicName/posts', optionalAuth, listByIdentityHandler);
router.get('/users/:username/posts', optionalAuth, listByUsernameHandler);

export default router;