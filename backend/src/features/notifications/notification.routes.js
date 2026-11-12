const express = require('express');
const { requireAuth } = require('../../middleware/require-auth');
const { validate } = require('../../middleware/validate');
const { controller } = require('./notification.controller');
const { notificationIdSchema } = require('./notification.validation');

function notificationRoutes(options) {
  const router = express.Router();
  router.use(requireAuth(options));
  router.get('/', controller.list);
  router.patch('/read-all', controller.markAllRead);
  router.patch('/:id/read', validate(notificationIdSchema), controller.markRead);
  router.delete('/:id', validate(notificationIdSchema), controller.dismiss);
  return router;
}

module.exports = notificationRoutes;
