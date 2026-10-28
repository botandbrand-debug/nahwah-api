import { Router } from 'express';
import { createReportHandler } from './report.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.post('/reports', authenticate, createReportHandler);

export default router;