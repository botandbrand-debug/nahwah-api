import app from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { registerNotificationListeners } from './modules/notifications/notification.service';

async function start(): Promise<void> {
  await connectDatabase();
  registerNotificationListeners();

  app.listen(env.port, () => {
    console.log(`Nahwah API running on http://localhost:${env.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});