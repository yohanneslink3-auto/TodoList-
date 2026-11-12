const { z } = require('zod');

const credentials = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

const registerSchema = z.object({
  body: credentials.extend({
    name: z.string().trim().min(2).max(60),
    confirmPassword: z.string().min(8).max(128),
  }).refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  }),
  params: z.object({}),
  query: z.object({}),
});

const loginSchema = z.object({
  body: credentials,
  params: z.object({}),
  query: z.object({}),
});

module.exports = { loginSchema, registerSchema };
