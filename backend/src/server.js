require('dotenv').config();

const { connectDatabase } = require('./config/database');
const { clientUrl, jwtSecret, mongoUri, nodeEnv, port } = require('./config/env');
const { createApp } = require('./app');
const { startReminderScheduler } = require('./features/notifications/notification.scheduler');

async function startServer() {
  await connectDatabase(mongoUri);

  const app = createApp({ clientUrl, jwtSecret, nodeEnv });
  startReminderScheduler();
  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error(`Backend startup failed: ${error.message}`);
  process.exitCode = 1;
});
