const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { createAuthController } = require('./auth.controller');
const { loginSchema, registerSchema } = require('./auth.validation');
const { optionalAuth } = require('../../middleware/require-auth');
const { validate } = require('../../middleware/validate');

function authRoutes(options) {
  const router = express.Router();
  const controller = createAuthController(options);
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please try again later.' },
  });

  router.post('/register', authLimiter, validate(registerSchema), controller.register);
  router.post('/login', authLimiter, validate(loginSchema), controller.login);
  router.post('/refresh', authLimiter, controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', optionalAuth(options), controller.me);

  return router;
}

module.exports = authRoutes;
