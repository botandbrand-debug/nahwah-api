import { Router } from 'express';
import {
  signupHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  changePasswordHandler,
} from './auth.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.post('/signup', signupHandler);
router.post('/login', loginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);

router.post('/forgot-password', forgotPasswordHandler);
router.post('/reset-password', resetPasswordHandler);

router.post('/change-password', authenticate, changePasswordHandler);

router.get('/me', authenticate, meHandler);

export default router;