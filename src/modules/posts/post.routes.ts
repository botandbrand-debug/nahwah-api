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
} from './post.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.get('/feed', feedHandler);

router.post('/posts', authenticate, createPostHandler);
router.get('/posts/mine', authenticate, listMineHandler);
router.get('/posts/:id', getPostHandler);
router.patch('/posts/:id', authenticate, updatePostHandler);
router.delete('/posts/:id', authenticate, deletePostHandler);

router.get('/identities/:publicName/posts', listByIdentityHandler);
router.get('/users/:username/posts', listByUsernameHandler);

export default router;