const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid ID.');
const date = z.string().datetime({ offset: true }).transform((value) => new Date(value)).nullable();
const status = z.enum(['todo', 'in-progress', 'completed']);
const priority = z.enum(['low', 'medium', 'high']);

const taskFields = {
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  status: status.optional(),
  priority: priority.optional(),
  category: objectId.nullable().optional(),
  dueDate: date.optional(),
  reminderAt: date.optional(),
};

const createTaskSchema = z.object({
  body: z.object({ ...taskFields, title: taskFields.title }).superRefine((value, context) => {
    if (value.reminderAt && !value.dueDate) {
      context.addIssue({ code: 'custom', path: ['reminderAt'], message: 'A reminder requires a due date.' });
    } else if (value.reminderAt && value.dueDate && value.reminderAt > value.dueDate) {
      context.addIssue({ code: 'custom', path: ['reminderAt'], message: 'Reminder must be before the due date.' });
    }
  }),
  params: z.object({}),
  query: z.object({}),
});

const updateTaskSchema = z.object({
  body: z.object(taskFields).partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required.'),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

const taskIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

const listTasksSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    timezoneOffset: z.coerce.number().int().min(-840).max(840).default(0),
    search: z.string().trim().max(100).default(''),
    status: status.optional(),
    priority: priority.optional(),
    category: z.union([objectId, z.literal('uncategorized')]).optional(),
    due: z.enum(['today', 'upcoming', 'overdue']).optional(),
    sort: z.enum(['createdAt', 'dueDate', 'priority', 'title', 'updatedAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
});

const statisticsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    timezoneOffset: z.coerce.number().int().min(-840).max(840).default(0),
  }),
});

module.exports = { createTaskSchema, listTasksSchema, statisticsSchema, taskIdSchema, updateTaskSchema };
