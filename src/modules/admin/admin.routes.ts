import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/requireAdmin';
import {
  listReportsHandler,
  getReportHandler,
  updateReportHandler,
  suspendUserHandler,
  removePostHandler,
  removeCommentHandler,
} from './admin.controller';

const router = Router();

// All admin routes require auth + admin check
router.use('/admin', authenticate, requireAdmin);

router.get('/admin/reports', listReportsHandler);
router.get('/admin/reports/:id', getReportHandler);
router.patch('/admin/reports/:id', updateReportHandler);

router.patch('/admin/users/:id/status', suspendUserHandler);

router.patch('/admin/posts/:id/remove', removePostHandler);
router.patch('/admin/comments/:id/remove', removeCommentHandler);

export default router;