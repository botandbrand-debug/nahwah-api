import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './modules/auth/auth.routes';
import profileRoutes from './modules/profiles/profile.routes';
import identityRoutes from './modules/posting-identities/identity.routes';
import postRoutes from './modules/posts/post.routes';
import nawaRoutes from './modules/nawas/nawa.routes';
import commentRoutes from './modules/comments/comment.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import gistMateRoutes from './modules/gist-mates/gist-mate.routes';
import blockRoutes from './modules/blocks/block.routes';
import reportRoutes from './modules/reports/report.routes';
import discoveryRoutes from './modules/discovery/discovery.routes';
import adminRoutes from './modules/admin/admin.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN
      ? process.env.FRONTEND_ORIGIN.split(',').map((s) => s.trim())
      : true, // dev: reflect request origin
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nahwah-api' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', profileRoutes);
app.use('/api/v1', identityRoutes);
app.use('/api/v1', postRoutes);
app.use('/api/v1', nawaRoutes);
app.use('/api/v1', commentRoutes);
app.use('/api/v1', notificationRoutes);
app.use('/api/v1', gistMateRoutes);
app.use('/api/v1', blockRoutes);
app.use('/api/v1', reportRoutes);
app.use('/api/v1', discoveryRoutes);
app.use('/api/v1', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;