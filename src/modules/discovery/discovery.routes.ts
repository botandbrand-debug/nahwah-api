import { Router } from 'express';
import { searchUsersHandler } from './discovery.controller';
import { optionalAuth } from '../../middleware/optionalAuth';

const router = Router();

router.get('/discovery/users', optionalAuth, searchUsersHandler);

export default router;