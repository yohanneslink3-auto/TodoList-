const {
  authenticate,
  createSession,
  createToken,
  publicUser,
  register,
  revokeSession,
  rotateSession,
} = require('./auth.service');
const User = require('./user.model');

function accessCookieOptions(nodeEnv) {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60 * 1000,
  };
}

function refreshCookieOptions(nodeEnv) {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function clearAuthCookies(res, nodeEnv) {
  res.clearCookie('todo_session', accessCookieOptions(nodeEnv));
  res.clearCookie('todo_refresh', refreshCookieOptions(nodeEnv));
}

function createAuthController({ jwtSecret, nodeEnv }) {
  async function signIn(req, res, next, user) {
    try {
      const refreshToken = await createSession(user);
      res.cookie('todo_session', createToken(user, jwtSecret), accessCookieOptions(nodeEnv));
      res.cookie('todo_refresh', refreshToken, refreshCookieOptions(nodeEnv));
      res.json({ user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  }

  return {
    async register(req, res, next) {
      try {
        const user = await register(req.validated.body);
        const refreshToken = await createSession(user);
        res.cookie('todo_session', createToken(user, jwtSecret), accessCookieOptions(nodeEnv));
        res.cookie('todo_refresh', refreshToken, refreshCookieOptions(nodeEnv));
        res.status(201).json({ user: publicUser(user) });
      } catch (error) {
        next(error);
      }
    },
    async login(req, res, next) {
      try {
        const user = await authenticate(req.validated.body);
        await signIn(req, res, next, user);
      } catch (error) {
        next(error);
      }
    },
    async refresh(req, res, next) {
      try {
        const session = await rotateSession(req.cookies?.todo_refresh);
        if (!session) {
          clearAuthCookies(res, nodeEnv);
          return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
        }
        res.cookie('todo_session', createToken(session.user, jwtSecret), accessCookieOptions(nodeEnv));
        res.cookie('todo_refresh', session.refreshToken, refreshCookieOptions(nodeEnv));
        return res.json({ user: publicUser(session.user) });
      } catch (error) {
        return next(error);
      }
    },
    async logout(req, res, next) {
      try {
        await revokeSession(req.cookies?.todo_refresh);
        clearAuthCookies(res, nodeEnv);
        return res.status(204).end();
      } catch (error) {
        return next(error);
      }
    },
    async me(req, res, next) {
      if (!req.user) {
        if (req.cookies?.todo_refresh) return res.status(401).json({ error: 'Session refresh required.' });
        return res.json({ user: null });
      }
      try {
        const user = await User.findById(req.user.id);
        if (!user) {
          clearAuthCookies(res, nodeEnv);
          return res.json({ user: null });
        }
        res.json({ user: publicUser(user) });
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { createAuthController };
