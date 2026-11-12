const { z } = require('zod');

const notificationIdSchema = z.object({
  body: z.object({}),
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }),
  query: z.object({}),
});

module.exports = { notificationIdSchema };
