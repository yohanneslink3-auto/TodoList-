const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid ID.');
const fields = {
  name: z.string().trim().min(1).max(32),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
};

const createCategorySchema = z.object({
  body: z.object(fields),
  params: z.object({}),
  query: z.object({}),
});

const updateCategorySchema = z.object({
  body: z.object(fields).partial().refine((value) => Object.keys(value).length > 0),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

const categoryIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

module.exports = { categoryIdSchema, createCategorySchema, updateCategorySchema };
