import { Types } from 'mongoose';
import { Report, ReportTargetType, ReportReason } from './report.model';
import { Post } from '../posts/post.model';
import { Comment } from '../comments/comment.model';
import { User } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

export async function createReport(
  reporterUserId: string,
  input: CreateReportInput
): Promise<{ id: string }> {
  if (!Types.ObjectId.isValid(input.targetId)) {
    throw new AppError('Invalid target id', 400, 'INVALID_ID');
  }

  // Verify the target exists
  let target;
  if (input.targetType === 'post') {
    target = await Post.findOne({ _id: input.targetId, deletedAt: null });
  } else if (input.targetType === 'comment') {
    target = await Comment.findOne({ _id: input.targetId, deletedAt: null });
  } else {
    target = await User.findById(input.targetId);
  }
  if (!target) {
    throw new AppError('Target not found', 404, 'TARGET_NOT_FOUND');
  }

  const report = await Report.create({
    reporterUserId: new Types.ObjectId(reporterUserId),
    targetType: input.targetType,
    targetId: new Types.ObjectId(input.targetId),
    reason: input.reason,
    details: input.details,
    status: 'open',
    reviewedByAdminId: null,
    reviewedAt: null,
  });

  return { id: report._id.toString() };
}