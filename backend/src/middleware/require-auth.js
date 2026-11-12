const jwt = require('jsonwebtoken');

function getUser(req, res, jwtSecret, nodeEnv) {
  const token = req.cookies?.todo_session;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret);
    return { id: payload.sub };
  } catch {
    res.clearCookie('todo_session', {
      httpOnly: true,
      secure: nodeEnv === 'production',
      sameSite: 'strict',
      path: '/',
    });
    return null;
  }
}

function requireAuth({ jwtSecret, nodeEnv }) {
  return (req, res, next) => {
    req.user = getUser(req, res, jwtSecret, nodeEnv);
    if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
    return next();
  };
}

function optionalAuth({ jwtSecret, nodeEnv }) {
  return (req, res, next) => {
    req.user = getUser(req, res, jwtSecret, nodeEnv);
    next();
  };
}

module.exports = { optionalAuth, requireAuth };
