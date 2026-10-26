import { Router } from 'express';
import { signupHandler, loginHandler, meHandler, logoutHandler } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.post('/signup', signupHandler);
router.post('/login', loginHandler);

router.get('/me', authenticate, meHandler);
router.post('/logout', authenticate, logoutHandler);

export default router;