const express = require('express');
const { requireAuth } = require('../../middleware/require-auth');
const { validate } = require('../../middleware/validate');
const { controller } = require('./task.controller');
const { createTaskSchema, listTasksSchema, statisticsSchema, taskIdSchema, updateTaskSchema } = require('./task.validation');

function taskRoutes(options) {
  const router = express.Router();
  router.use(requireAuth(options));
  router.get('/statistics', validate(statisticsSchema), controller.statistics);
  router.get('/', validate(listTasksSchema), controller.list);
  router.post('/', validate(createTaskSchema), controller.create);
  router.get('/:id', validate(taskIdSchema), controller.get);
  router.patch('/:id', validate(updateTaskSchema), controller.update);
  router.delete('/:id', validate(taskIdSchema), controller.remove);
  return router;
}

module.exports = taskRoutes;
