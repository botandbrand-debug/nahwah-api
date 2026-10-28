import { Router } from 'express';
import { blockHandler, unblockHandler } from './block.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.put('/blocks/:userId', authenticate, blockHandler);
router.delete('/blocks/:userId', authenticate, unblockHandler);

export default router;