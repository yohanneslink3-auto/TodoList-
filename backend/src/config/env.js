const port = Number(process.env.PORT || 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const { MONGODB_URI, JWT_SECRET } = process.env;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is required. Add it to backend/.env.');
}

if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET.startsWith('replace-with-')) {
  throw new Error('Set JWT_SECRET to a random secret of at least 32 characters in backend/.env.');
}

module.exports = Object.freeze({
  port,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: MONGODB_URI,
  jwtSecret: JWT_SECRET,
  nodeEnv: process.env.NODE_ENV || 'development',
});
