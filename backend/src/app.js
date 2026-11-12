const cors = require('cors');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const openApiSpec = require('../openapi.json');
const authRoutes = require('./features/auth/auth.routes');
const categoryRoutes = require('./features/categories/category.routes');
const healthRoutes = require('./features/health/health.routes');
const notificationRoutes = require('./features/notifications/notification.routes');
const taskRoutes = require('./features/tasks/task.routes');
const { errorHandler } = require('./middleware/error-handler');
const { notFound } = require('./middleware/not-found');

function createApp({ clientUrl, jwtSecret, nodeEnv = 'development' }) {
  const app = express();

  app.use(helmet({ strictTransportSecurity: nodeEnv === 'production' ? undefined : false }));
  app.use(cors({ origin: clientUrl, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes({ jwtSecret, nodeEnv }));
  app.use('/api/tasks', taskRoutes({ jwtSecret, nodeEnv }));
  app.use('/api/categories', categoryRoutes({ jwtSecret, nodeEnv }));
  app.use('/api/notifications', notificationRoutes({ jwtSecret, nodeEnv }));
  app.get('/api/docs/openapi.json', (_req, res) => res.json(openApiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
