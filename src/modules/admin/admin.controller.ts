import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Report } from '../reports/report.model';
import { User } from '../auth/auth.model';
import { Post } from '../posts/post.model';
import { Comment } from '../comments/comment.model';
import { AppError } from '../../shared/errors/AppError';
import { z } from 'zod';

const updateReportSchema = z.object({
  status: z.enum(['reviewed', 'resolved', 'dismissed']),
});

const suspendSchema = z.object({
  suspend: z.boolean(),
  reason: z.string().max(500).optional(),
});

// GET /admin/reports — queue of open reports
export async function listReportsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : 'open';
    const validStatuses = ['open', 'reviewed', 'resolved', 'dismissed'] as const;
    type ValidStatus = (typeof validStatuses)[number];
    const status: ValidStatus = (validStatuses as readonly string[]).includes(statusRaw)
      ? (statusRaw as ValidStatus)
      : 'open';
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);

    const reports = await Report.find({ status })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.status(200).json({
      reports: reports.map((r) => ({
        id: r._id.toString(),
        targetType: r.targetType,
        targetId: r.targetId.toString(),
        reason: r.reason,
        details: r.details ?? null,
        status: r.status,
        reporterUserId: r.reporterUserId.toString(),
        reviewedByAdminId: r.reviewedByAdminId ? r.reviewedByAdminId.toString() : null,
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) { next(err); }
}

// GET /admin/reports/:id — full report with target preview
export async function getReportHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id;
    if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid report id', 400, 'INVALID_ID');
    }

    const report = await Report.findById(id);
    if (!report) throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');

    let targetPreview: unknown = null;
    if (report.targetType === 'post') {
      const p = await Post.findById(report.targetId);
      targetPreview = p ? { content: p.content, author: p.authorPublicName, deletedAt: p.deletedAt } : null;
    } else if (report.targetType === 'comment') {
      const c = await Comment.findById(report.targetId);
      targetPreview = c ? { content: c.content, author: c.authorPublicName, deletedAt: c.deletedAt } : null;
    } else {
      const u = await User.findById(report.targetId);
      targetPreview = u ? { username: u.username, suspendedAt: u.suspendedAt } : null;
    }

    res.status(200).json({
      report: {
        id: report._id.toString(),
        targetType: report.targetType,
        targetId: report.targetId.toString(),
        reason: report.reason,
        details: report.details ?? null,
        status: report.status,
        reporterUserId: report.reporterUserId.toString(),
        createdAt: report.createdAt.toISOString(),
      },
      targetPreview,
    });
  } catch (err) { next(err); }
}

// PATCH /admin/reports/:id — update report status
export async function updateReportHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminId = req.user?.id;
    if (!adminId) throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');

    const id = req.params.id;
    if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid report id', 400, 'INVALID_ID');
    }

    const parsed = updateReportSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }

    const report = await Report.findByIdAndUpdate(
      id,
      {
        $set: {
          status: parsed.data.status,
          reviewedByAdminId: new Types.ObjectId(adminId),
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!report) throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');

    res.status(200).json({
      report: {
        id: report._id.toString(),
        status: report.status,
        reviewedAt: report.reviewedAt?.toISOString(),
      },
    });
  } catch (err) { next(err); }
}

// PATCH /admin/users/:id/status — suspend or reactivate user
export async function suspendUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.params.id;
    if (typeof userId !== 'string' || !Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user id', 400, 'INVALID_ID');
    }

    const parsed = suspendSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR');
    }

    const update = parsed.data.suspend
      ? { $set: { suspendedAt: new Date(), suspendedReason: parsed.data.reason } }
      : { $set: { suspendedAt: null, suspendedReason: null } };

    const user = await User.findByIdAndUpdate(userId, update, { new: true });
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    res.status(200).json({
      user: {
        id: user._id.toString(),
        username: user.username,
        suspendedAt: user.suspendedAt ? user.suspendedAt.toISOString() : null,
        suspendedReason: user.suspendedReason ?? null,
      },
    });
  } catch (err) { next(err); }
}

// PATCH /admin/posts/:id/remove — admin soft-delete any post
export async function removePostHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id;
    if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid post id', 400, 'INVALID_ID');
    }

    const post = await Post.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );
    if (!post) throw new AppError('Post not found', 404, 'POST_NOT_FOUND');

    // Cascade to comments
    await Comment.updateMany(
      { postId: post._id, deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );

    res.status(204).send();
  } catch (err) { next(err); }
}

// PATCH /admin/comments/:id/remove — admin soft-delete any comment
export async function removeCommentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id;
    if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid comment id', 400, 'INVALID_ID');
    }

    const comment = await Comment.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );
    if (!comment) throw new AppError('Comment not found', 404, 'COMMENT_NOT_FOUND');

    // Cascade to replies
    await Comment.updateMany(
      { parentCommentId: comment._id, deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );

    res.status(204).send();
  } catch (err) { next(err); }
}