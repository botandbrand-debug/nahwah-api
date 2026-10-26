import { Router } from 'express';
import { updateProfileHandler, getPublicProfileHandler } from './profile.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.patch('/profiles/me', authenticate, updateProfileHandler);
router.get('/users/:username', getPublicProfileHandler);

export default router;