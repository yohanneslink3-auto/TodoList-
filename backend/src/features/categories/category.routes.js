const express = require('express');
const { requireAuth } = require('../../middleware/require-auth');
const { validate } = require('../../middleware/validate');
const { controller } = require('./category.controller');
const { categoryIdSchema, createCategorySchema, updateCategorySchema } = require('./category.validation');

function categoryRoutes(options) {
  const router = express.Router();
  router.use(requireAuth(options));
  router.get('/', controller.list);
  router.post('/', validate(createCategorySchema), controller.create);
  router.patch('/:id', validate(updateCategorySchema), controller.update);
  router.delete('/:id', validate(categoryIdSchema), controller.remove);
  return router;
}

module.exports = categoryRoutes;
